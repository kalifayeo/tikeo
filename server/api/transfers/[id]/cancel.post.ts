import { requireCsrf } from '~/server/utils/csrf'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ERROR_STATUS: Record<string, number> = {
  TRANSFER_NOT_FOUND: 404,
  TRANSFER_NOT_PENDING: 409,
}

/** POST /api/transfers/:id/cancel — l'expéditeur annule une invitation en attente. */
export default defineEventHandler(async (event) => {
  requireCsrf(event)
  const { userId } = await requireUser(event)

  const id = getRouterParam(event, 'id') ?? ''
  if (!UUID_RE.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'TRANSFER_NOT_FOUND', data: { code: 'TRANSFER_NOT_FOUND' } })
  }

  const supabaseAdmin = useSupabaseAdmin()
  const { data, error } = await supabaseAdmin.rpc('cancel_ticket_transfer', { p_user_id: userId, p_transfer_id: id })

  if (error) {
    const code = String(error.message ?? '').trim()
    if (code in ERROR_STATUS) {
      throw createError({ statusCode: ERROR_STATUS[code], statusMessage: code, data: { code } })
    }
    console.error('[api/transfers/cancel] échec cancel_ticket_transfer :', error)
    throw createError({ statusCode: 500, statusMessage: 'TRANSFER_CANCEL_FAILED', data: { code: 'TRANSFER_CANCEL_FAILED' } })
  }

  return { result: data }
})
