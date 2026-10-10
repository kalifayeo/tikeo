import { requireCsrf } from '~/server/utils/csrf'
import { checkRateLimit } from '~/server/utils/rateLimit'

const TOKEN_RE = /^[0-9a-f]{64}$/i

const ERROR_STATUS: Record<string, number> = {
  TRANSFER_NOT_FOUND: 404,
  TRANSFER_WRONG_RECIPIENT: 403,
  TRANSFER_NOT_PENDING: 409,
}

/** POST /api/transfers/:token/respond — Corps : { accept: boolean }. */
export default defineEventHandler(async (event) => {
  requireCsrf(event)
  await checkRateLimit(event, { key: 'transfer-respond', max: 20, windowMs: 10 * 60 * 1000 })

  const { userId } = await requireUser(event)

  const token = getRouterParam(event, 'token') ?? ''
  if (!TOKEN_RE.test(token)) {
    throw createError({ statusCode: 404, statusMessage: 'TRANSFER_NOT_FOUND', data: { code: 'TRANSFER_NOT_FOUND' } })
  }

  const body = await readBody<{ accept?: unknown }>(event)
  const accept = body?.accept === true

  const supabaseAdmin = useSupabaseAdmin()
  const { data, error } = await supabaseAdmin.rpc('respond_ticket_transfer', {
    p_user_id: userId,
    p_token: token,
    p_accept: accept,
  })

  if (error) {
    const code = String(error.message ?? '').trim()
    if (code in ERROR_STATUS) {
      throw createError({ statusCode: ERROR_STATUS[code], statusMessage: code, data: { code } })
    }
    console.error('[api/transfers/respond] échec respond_ticket_transfer :', error)
    throw createError({ statusCode: 500, statusMessage: 'TRANSFER_RESPOND_FAILED', data: { code: 'TRANSFER_RESPOND_FAILED' } })
  }

  return { result: data }
})
