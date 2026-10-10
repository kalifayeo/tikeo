import { requireUser } from '~/server/utils/userAuth'
import { requireCsrf } from '~/server/utils/csrf'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { requireScanAccess } from '~/server/utils/scanAccess'

/**
 * POST /api/scan/validate — contrôle d'accès à l'entrée.
 * Corps : { eventId, code, deviceId? } où `code` est le contenu du QR code
 * (tickets.qr_token) ou, en saisie manuelle, le numéro du billet.
 *
 * Résultats : valid (entrée acceptée, billet passé à « used »), already_used,
 * cancelled (annulé / remboursé / expiré), invalid (code inconnu),
 * wrong_event (billet d'un autre événement), not_paid (commande non payée).
 *
 * Le passage valid → used est atomique (`update … where status = 'valid'`) :
 * deux agents qui scannent le même billet au même instant ne peuvent pas
 * tous les deux obtenir « valid ».
 */
export default defineEventHandler(async (event) => {
  requireCsrf(event)
  const { userId } = await requireUser(event)
  await checkRateLimit(event, { key: 'scan-validate', max: 240, windowMs: 60 * 1000 })

  const body = await readBody<{ eventId?: string; code?: string; deviceId?: string }>(event)
  const eventId = String(body?.eventId ?? '')
  const code = String(body?.code ?? '').trim().slice(0, 200)
  if (!eventId || !code) throw createError({ statusCode: 400, statusMessage: 'INVALID_REQUEST' })

  const { admin, ev } = await requireScanAccess(event, userId, eventId)

  // QR code d'abord, puis numéro de billet (saisie manuelle, insensible à la casse)
  let { data: ticket } = await admin
    .from('tickets')
    .select('id, event_id, user_id, ticket_number, status, used_at, ticket_type:ticket_types(name)')
    .eq('qr_token', code)
    .maybeSingle()
  if (!ticket) {
    const res = await admin
      .from('tickets')
      .select('id, event_id, user_id, ticket_number, status, used_at, ticket_type:ticket_types(name)')
      .ilike('ticket_number', code.replace(/[%_]/g, ''))
      .maybeSingle()
    ticket = res.data
  }

  if (!ticket) return { result: 'invalid' as const }

  const info = async (usedAt: string | null) => {
    const { data: holder } = await admin.from('profiles').select('full_name').eq('user_id', ticket!.user_id).maybeSingle()
    return {
      number: ticket!.ticket_number,
      typeName: (ticket as any).ticket_type?.name ?? '',
      holder: holder?.full_name ?? '',
      usedAt,
    }
  }

  const log = async (result: 'valid' | 'already_used' | 'cancelled' | 'invalid') => {
    await admin.from('ticket_scans').insert({
      ticket_id: ticket!.id,
      event_id: eventId,
      agent_id: userId,
      result,
      device_id: body?.deviceId ? String(body.deviceId).slice(0, 80) : null,
    })
  }

  if (ticket.event_id !== eventId) {
    await log('invalid')
    return { result: 'wrong_event' as const, ticket: { number: ticket.ticket_number, typeName: '', holder: '', usedAt: null } }
  }

  if (ticket.status === 'used') {
    await log('already_used')
    return { result: 'already_used' as const, ticket: await info(ticket.used_at) }
  }
  if (ticket.status === 'cancelled' || ticket.status === 'refunded' || ticket.status === 'expired') {
    await log('cancelled')
    return { result: 'cancelled' as const, ticket: await info(null) }
  }
  if (ticket.status !== 'valid') {
    await log('invalid')
    return { result: 'not_paid' as const, ticket: await info(null) }
  }

  const usedAt = new Date().toISOString()
  const { data: updated } = await admin
    .from('tickets')
    .update({ status: 'used', used_at: usedAt, used_by: userId })
    .eq('id', ticket.id)
    .eq('status', 'valid')
    .select('id')
    .maybeSingle()

  if (!updated) {
    // Un autre agent vient de le valider : on relit l'heure réelle.
    const { data: fresh } = await admin.from('tickets').select('used_at').eq('id', ticket.id).maybeSingle()
    await log('already_used')
    return { result: 'already_used' as const, ticket: await info(fresh?.used_at ?? null) }
  }

  await log('valid')
  return { result: 'valid' as const, ticket: await info(usedAt), eventTitle: ev.title }
})
