import { requireUser } from '~/server/utils/userAuth'
import { requireScanAccess } from '~/server/utils/scanAccess'

/**
 * GET /api/scan/stats?eventId=… — compteurs d'entrée et derniers scans,
 * affichés en direct sur la page Scanner. Mêmes droits que la validation.
 */
export default defineEventHandler(async (event) => {
  const { userId } = await requireUser(event)
  const eventId = String(getQuery(event).eventId ?? '')
  if (!eventId) throw createError({ statusCode: 400, statusMessage: 'INVALID_REQUEST' })

  const { admin, ev } = await requireScanAccess(event, userId, eventId)

  const countBy = async (status: string[]) => {
    const { count } = await admin.from('tickets').select('id', { count: 'exact', head: true }).eq('event_id', eventId).in('status', status)
    return count ?? 0
  }
  const [used, valid] = await Promise.all([countBy(['used']), countBy(['valid'])])

  const { data: scans } = await admin
    .from('ticket_scans')
    .select('id, result, scanned_at, ticket:tickets(ticket_number, ticket_type:ticket_types(name))')
    .eq('event_id', eventId)
    .order('scanned_at', { ascending: false })
    .limit(20)

  return {
    event: { id: ev.id, title: ev.title },
    total: used + valid,
    used,
    remaining: valid,
    scans: (scans ?? []).map((s: any) => ({
      id: s.id,
      result: s.result,
      at: s.scanned_at,
      number: s.ticket?.ticket_number ?? '',
      typeName: s.ticket?.ticket_type?.name ?? '',
    })),
  }
})
