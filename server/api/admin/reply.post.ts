import { requireCsrf } from '~/server/utils/csrf'
import { requirePermission } from '~/server/utils/adminAuth'
import { sendTransactionalEmail } from '~/server/utils/brevo'

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * POST /api/admin/reply
 * Réponse de l'administration, depuis le pop-up de /admin/messages (kind
 * « message », permission support.manage) ou de /admin/avis (kind « feedback »,
 * permission moderation.manage).
 *  - La réponse est enregistrée (visible dans le pop-up, et sur la page
 *    publique /avis pour un avis publié).
 *  - Un email est envoyé via Brevo quand le destinataire a laissé une adresse.
 */
export default defineEventHandler(async (event) => {
  requireCsrf(event)
  const body = await readBody<{ kind?: string; id?: string; reply?: string }>(event)

  const kind = body.kind === 'feedback' ? 'feedback' : body.kind === 'message' ? 'message' : null
  const reply = body.reply?.trim() ?? ''
  if (!kind || !body.id) throw createError({ statusCode: 400, statusMessage: 'Requête invalide.' })
  if (reply.length < 2) throw createError({ statusCode: 400, statusMessage: 'Écrivez votre réponse.' })
  if (reply.length > (kind === 'message' ? 5000 : 2000)) throw createError({ statusCode: 400, statusMessage: 'Réponse trop longue.' })

  const { adminUserId } = await requirePermission(event, kind === 'message' ? 'support.manage' : 'moderation.manage')
  const supabaseAdmin = useSupabaseAdmin()
  const table = kind === 'message' ? 'contact_messages' : 'site_feedback'

  const { data: row, error: readError } = await supabaseAdmin.from(table).select('*').eq('id', body.id).maybeSingle()
  if (readError || !row) throw createError({ statusCode: 404, statusMessage: 'Élément introuvable.' })

  const to: string | null = (row as any).email || null
  const name: string = (row as any).full_name || (row as any).display_name || ''
  const subject: string = kind === 'message' ? `Re: ${(row as any).subject}` : 'Merci pour votre avis sur Tikeo'
  const original: string = (row as any).message || ''

  let emailSent = false
  if (to) {
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#111827">
      <div style="height:4px;background:linear-gradient(90deg,#FF7A00,#0057B8)"></div>
      <div style="padding:24px 8px">
        <p style="font-size:16px">Bonjour ${esc(name || '')},</p>
        <p style="font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(reply)}</p>
        <p style="font-size:15px">L'équipe Tikeo</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="font-size:12px;color:#6b7280">Votre message :</p>
        <p style="font-size:13px;color:#6b7280;white-space:pre-wrap">${esc(original.slice(0, 1200))}</p>
      </div></div>`
    try {
      await sendTransactionalEmail({ to, toName: name || undefined, subject, htmlContent: html })
      emailSent = !!useRuntimeConfig(event).brevoApiKey
    } catch (err) {
      console.error('[api/admin/reply] email non envoyé :', err)
      throw createError({ statusCode: 502, statusMessage: "La réponse n'a pas pu être envoyée par email. Réessayez." })
    }
  }

  const patch: Record<string, unknown> = { admin_reply: reply, replied_at: new Date().toISOString() }
  if (kind === 'message') patch.replied_by = adminUserId
  if ((row as any).status === 'new') patch.status = 'read'
  const { error: updError } = await supabaseAdmin.from(table).update(patch).eq('id', body.id)
  if (updError) {
    console.error('[api/admin/reply] enregistrement :', updError)
    throw createError({ statusCode: 500, statusMessage: "Impossible d'enregistrer la réponse." })
  }

  return { success: true, emailSent, hasEmail: !!to, repliedAt: patch.replied_at }
})
