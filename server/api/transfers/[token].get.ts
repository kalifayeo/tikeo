import { checkRateLimit } from '~/server/utils/rateLimit'
const TOKEN_RE = /^[0-9a-f]{64}$/i

/**
 * GET /api/transfers/:token — aperçu d'une invitation de transfert, pour la
 * page /transfert/[token] AVANT connexion (le token, non devinable, tient
 * lieu de preuve de possession du lien reçu par email). Ne renvoie que des
 * informations déjà présentes dans l'email d'invitation : jamais l'identité
 * complète des deux parties, jamais de quoi accepter sans être connecté.
 */
export default defineEventHandler(async (event) => {
  await checkRateLimit(event, { key: 'transfer-preview', max: 60, windowMs: 10 * 60 * 1000 })
  const token = getRouterParam(event, 'token') ?? ''
  if (!TOKEN_RE.test(token)) {
    throw createError({ statusCode: 404, statusMessage: 'TRANSFER_NOT_FOUND', data: { code: 'TRANSFER_NOT_FOUND' } })
  }

  const supabaseAdmin = useSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('ticket_transfers')
    .select(
      `status, to_email, expires_at, message,
       ticket:tickets ( ticket_number, ticket_type:ticket_types ( name ),
         event:events ( title, slug, start_date, cover_image, location_name, city ) ),
       sender:profiles!ticket_transfers_from_user_id_fkey ( full_name )`
    )
    .eq('token', token)
    .maybeSingle()

  if (error) {
    console.error('[api/transfers/:token] échec de lecture :', error)
    throw createError({ statusCode: 500, statusMessage: 'TRANSFER_FETCH_FAILED', data: { code: 'TRANSFER_FETCH_FAILED' } })
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'TRANSFER_NOT_FOUND', data: { code: 'TRANSFER_NOT_FOUND' } })
  }

  const row = data as any
  // L'email complet du destinataire n'est pas renvoyé, seule une version
  // masquée (pour confirmer "oui c'est bien vous" sans exposer l'adresse
  // à quiconque tomberait sur le lien).
  const maskedEmail = row.to_email.replace(/^(.{2}).+(@.+)$/, (_: string, a: string, b: string) => `${a}${'•'.repeat(4)}${b}`)

  return {
    status: row.status,
    expiresAt: row.expires_at,
    message: row.message,
    toEmailMasked: maskedEmail,
    senderName: row.sender?.full_name || 'Un ami',
    ticketNumber: row.ticket?.ticket_number,
    ticketType: row.ticket?.ticket_type?.name,
    event: row.ticket?.event
      ? {
          title: row.ticket.event.title,
          slug: row.ticket.event.slug,
          startDate: row.ticket.event.start_date,
          coverImage: row.ticket.event.cover_image,
          location: row.ticket.event.location_name || row.ticket.event.city,
        }
      : null,
  }
})
