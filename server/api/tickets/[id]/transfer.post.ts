import { requireCsrf } from '~/server/utils/csrf'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { sendTransactionalEmail } from '~/server/utils/brevo'
import { getSiteOrigin } from '~/server/utils/siteOrigin'
import { escapeHtml } from '~/server/utils/escapeHtml'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ERROR_STATUS: Record<string, number> = {
  INVALID_EMAIL: 400,
  TICKET_NOT_FOUND: 404,
  TICKET_NOT_TRANSFERABLE: 409,
  TRANSFERS_DISABLED: 403,
  EVENT_STARTED: 409,
  TRANSFER_LIMIT_REACHED: 409,
  SELF_TRANSFER: 400,
  TRANSFER_ALREADY_PENDING: 409,
}

/**
 * POST /api/tickets/:id/transfer — envoie une invitation à transférer un
 * billet valide vers une autre adresse email. Corps : { toEmail, message? }.
 *
 * La fonction SQL create_ticket_transfer() (migration 0032) crée l'invitation
 * et, si le destinataire a déjà un compte, une notification en base ; cette
 * route envoie EN PLUS un email dédié avec le lien à ouvrir (le destinataire
 * n'a pas forcément de compte pour recevoir une notification interne).
 */
export default defineEventHandler(async (event) => {
  requireCsrf(event)
  await checkRateLimit(event, { key: 'ticket-transfer', max: 10, windowMs: 60 * 60 * 1000 })

  const { userId } = await requireUser(event)

  const ticketId = getRouterParam(event, 'id') ?? ''
  if (!UUID_RE.test(ticketId)) {
    throw createError({ statusCode: 400, statusMessage: 'TICKET_NOT_FOUND', data: { code: 'TICKET_NOT_FOUND' } })
  }

  const body = await readBody<{ toEmail?: unknown; message?: unknown }>(event)
  const toEmail = typeof body?.toEmail === 'string' ? body.toEmail.trim() : ''
  const message = typeof body?.message === 'string' ? body.message.slice(0, 300) : null

  const supabaseAdmin = useSupabaseAdmin()
  const { data, error } = await supabaseAdmin.rpc('create_ticket_transfer', {
    p_user_id: userId,
    p_ticket_id: ticketId,
    p_to_email: toEmail,
    p_message: message,
  })

  if (error) {
    const code = String(error.message ?? '').trim()
    if (code in ERROR_STATUS) {
      throw createError({ statusCode: ERROR_STATUS[code], statusMessage: code, data: { code } })
    }
    console.error('[api/tickets/transfer] échec create_ticket_transfer :', error)
    throw createError({ statusCode: 500, statusMessage: 'TRANSFER_CREATE_FAILED', data: { code: 'TRANSFER_CREATE_FAILED' } })
  }

  const summary = data as {
    token: string
    to_email: string
    sender_name: string
    message: string | null
    ticket_number: string
    ticket_type: string
    event: { title: string; slug: string; start_date: string; location_name: string | null; city: string | null }
  }

  const siteOrigin = getSiteOrigin(event)
  const link = `${siteOrigin}/transfert/${summary.token}`

  try {
    await sendTransactionalEmail({
      to: summary.to_email,
      subject: `${summary.sender_name} vous offre un billet pour ${summary.event.title}`,
      htmlContent: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#B05400">Un billet vous attend</h2>
        <p><strong>${escapeHtml(summary.sender_name)}</strong> souhaite vous transférer son billet <strong>${escapeHtml(summary.ticket_type)}</strong>
        pour <strong>${escapeHtml(summary.event.title)}</strong>.</p>
        ${summary.message ? `<p style="font-style:italic;color:#555">« ${escapeHtml(summary.message)} »</p>` : ''}
        <p><a href="${escapeHtml(link)}" style="display:inline-block;background:#FF7A00;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px">Voir l'invitation</a></p>
        <p style="font-size:12px;color:#888">Ce lien expire dans 7 jours. Si vous n'avez pas de compte Tikeo avec cette adresse, créez-en un pour accepter le billet.</p>
      </div>`,
    })
  } catch (e) {
    console.error('[api/tickets/transfer] échec envoi email invitation :', e)
  }

  return { transfer: { token: summary.token, toEmail: summary.to_email, expiresAt: (data as any).expires_at } }
})
