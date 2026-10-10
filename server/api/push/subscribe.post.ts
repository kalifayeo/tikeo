import { requireCsrf } from '~/server/utils/csrf'
import { checkRateLimit } from '~/server/utils/rateLimit'

/**
 * POST /api/push/subscribe — enregistre l'abonnement Web Push créé par le
 * navigateur (PushManager.subscribe). Corps : { endpoint, keys: { p256dh, auth } }.
 * `endpoint` doit être une URL https d'un service de push connu du navigateur ;
 * on ne peut pas en vérifier davantage côté serveur, mais un abonnement bidon
 * échouerait de toute façon silencieusement à l'envoi (voir server/utils/webPush.ts).
 */
export default defineEventHandler(async (event) => {
  requireCsrf(event)
  await checkRateLimit(event, { key: 'push-subscribe', max: 20, windowMs: 60 * 60 * 1000 })

  const { userId } = await requireUser(event)

  const body = await readBody<{ endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }>(event)
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : ''
  const p256dh = typeof body?.keys?.p256dh === 'string' ? body.keys.p256dh : ''
  const authKey = typeof body?.keys?.auth === 'string' ? body.keys.auth : ''

  if (!endpoint.startsWith('https://') || endpoint.length > 2048 || !p256dh || !authKey) {
    throw createError({ statusCode: 400, statusMessage: 'INVALID_SUBSCRIPTION', data: { code: 'INVALID_SUBSCRIPTION' } })
  }

  const supabaseAdmin = useSupabaseAdmin()
  const { error } = await supabaseAdmin.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint,
      p256dh,
      auth: authKey,
      user_agent: (getHeader(event, 'user-agent') || '').slice(0, 300),
      last_used_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  )

  if (error) {
    console.error('[api/push/subscribe] échec enregistrement :', error)
    throw createError({ statusCode: 500, statusMessage: 'SUBSCRIBE_FAILED', data: { code: 'SUBSCRIBE_FAILED' } })
  }

  return { ok: true }
})
