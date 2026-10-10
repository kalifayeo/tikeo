import { requireCsrf } from '~/server/utils/csrf'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** POST /api/reviews/:id/reply — Corps : { reply: string | null }. Réservé à l'organisateur de l'événement noté. */
export default defineEventHandler(async (event) => {
  requireCsrf(event)
  const { userId } = await requireUser(event)

  const id = getRouterParam(event, 'id') ?? ''
  if (!UUID_RE.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'REVIEW_NOT_FOUND', data: { code: 'REVIEW_NOT_FOUND' } })
  }

  const body = await readBody<{ reply?: unknown }>(event)
  const reply = typeof body?.reply === 'string' ? body.reply.slice(0, 2000) : null

  const supabaseAdmin = useSupabaseAdmin()
  const { error } = await supabaseAdmin.rpc('reply_to_review', { p_user_id: userId, p_review_id: id, p_reply: reply })

  if (error) {
    const code = String(error.message ?? '').trim()
    if (code === 'NOT_EVENT_ORGANIZER') {
      throw createError({ statusCode: 403, statusMessage: code, data: { code } })
    }
    console.error('[api/reviews/reply] échec reply_to_review :', error)
    throw createError({ statusCode: 500, statusMessage: 'REVIEW_REPLY_FAILED', data: { code: 'REVIEW_REPLY_FAILED' } })
  }

  return { ok: true }
})
