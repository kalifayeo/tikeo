import { requireCsrf } from '~/server/utils/csrf'
import { checkRateLimit } from '~/server/utils/rateLimit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ERROR_STATUS: Record<string, number> = {
  TICKET_NOT_AVAILABLE: 404,
  EVENT_NOT_AVAILABLE: 404,
  SALE_CLOSED: 409,
  INVALID_QUANTITY: 400,
  NOT_SOLD_OUT: 409,
  ALREADY_ON_WAITLIST: 409,
  ACCOUNT_SUSPENDED: 403,
}

/**
 * POST /api/waitlist/join — rejoint la liste d'attente d'un type de billet
 * épuisé. Corps : { ticketTypeId: uuid, quantity?: 1..10 }.
 */
export default defineEventHandler(async (event) => {
  requireCsrf(event)
  await checkRateLimit(event, { key: 'waitlist-join', max: 20, windowMs: 10 * 60 * 1000 })

  const { userId } = await requireUser(event)

  const body = await readBody<{ ticketTypeId?: unknown; quantity?: unknown }>(event)
  const ticketTypeId = body?.ticketTypeId
  const quantity = typeof body?.quantity === 'number' && Number.isInteger(body.quantity) ? body.quantity : 1

  if (typeof ticketTypeId !== 'string' || !UUID_RE.test(ticketTypeId)) {
    throw createError({ statusCode: 400, statusMessage: 'TICKET_NOT_AVAILABLE', data: { code: 'TICKET_NOT_AVAILABLE' } })
  }

  const supabaseAdmin = useSupabaseAdmin()

  const { data: profile } = await supabaseAdmin.from('profiles').select('status').eq('user_id', userId).maybeSingle()
  if (profile?.status === 'suspended') {
    throw createError({ statusCode: 403, statusMessage: 'ACCOUNT_SUSPENDED', data: { code: 'ACCOUNT_SUSPENDED' } })
  }

  const { data, error } = await supabaseAdmin.rpc('join_waitlist', {
    p_user_id: userId,
    p_ticket_type_id: ticketTypeId,
    p_quantity: quantity,
  })

  if (error) {
    const code = String(error.message ?? '').trim()
    if (code in ERROR_STATUS) {
      throw createError({ statusCode: ERROR_STATUS[code], statusMessage: code, data: { code } })
    }
    console.error('[api/waitlist/join] échec join_waitlist :', error)
    throw createError({ statusCode: 500, statusMessage: 'WAITLIST_JOIN_FAILED', data: { code: 'WAITLIST_JOIN_FAILED' } })
  }

  return { entry: data }
})
