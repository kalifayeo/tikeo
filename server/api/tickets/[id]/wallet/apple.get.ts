import { buildApplePkpass, isAppleWalletConfigured } from '~/server/utils/appleWallet'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** GET /api/tickets/:id/wallet/apple — renvoie le fichier .pkpass du billet (Content-Type: application/vnd.apple.pkpass). */
export default defineEventHandler(async (event) => {
  if (!isAppleWalletConfigured()) {
    throw createError({ statusCode: 501, statusMessage: 'APPLE_WALLET_NOT_CONFIGURED', data: { code: 'APPLE_WALLET_NOT_CONFIGURED' } })
  }

  const { userId } = await requireUser(event)
  const ticketId = getRouterParam(event, 'id') ?? ''
  if (!UUID_RE.test(ticketId)) {
    throw createError({ statusCode: 404, statusMessage: 'TICKET_NOT_FOUND', data: { code: 'TICKET_NOT_FOUND' } })
  }

  const supabaseAdmin = useSupabaseAdmin()
  const { data: ticket, error } = await supabaseAdmin
    .from('tickets')
    .select(
      `id, ticket_number, qr_token, status, user_id,
       ticket_type:ticket_types ( name ),
       event:events ( title, start_date, location_name, address, city )`
    )
    .eq('id', ticketId)
    .maybeSingle()

  if (error) {
    console.error('[api/tickets/wallet/apple] échec de lecture :', error)
    throw createError({ statusCode: 500, statusMessage: 'TICKET_FETCH_FAILED', data: { code: 'TICKET_FETCH_FAILED' } })
  }
  if (!ticket || ticket.user_id !== userId) {
    throw createError({ statusCode: 404, statusMessage: 'TICKET_NOT_FOUND', data: { code: 'TICKET_NOT_FOUND' } })
  }
  if (ticket.status !== 'valid' && ticket.status !== 'used') {
    throw createError({ statusCode: 409, statusMessage: 'TICKET_NOT_ACTIVE', data: { code: 'TICKET_NOT_ACTIVE' } })
  }

  const row = ticket as any
  const pkpass = await buildApplePkpass({
    ticketId: row.id,
    ticketNumber: row.ticket_number,
    qrToken: row.qr_token,
    eventTitle: row.event?.title || 'Événement',
    eventStartDate: row.event?.start_date,
    venueName: row.event?.location_name,
    address: [row.event?.address, row.event?.city].filter(Boolean).join(', '),
    ticketTypeName: row.ticket_type?.name || 'Billet',
  })

  setResponseHeader(event, 'Content-Type', 'application/vnd.apple.pkpass')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${row.ticket_number}.pkpass"`)
  return pkpass
})
