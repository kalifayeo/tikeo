import { requireCsrf } from '~/server/utils/csrf'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { requireUser } from '~/server/utils/userAuth'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST /api/promo/validate — aperçu d'un code promo (sans le consommer).
 * Corps : { eventId, code }.
 *
 * Passe par le serveur (et non plus par un appel direct du navigateur à la
 * fonction SQL) pour que les essais soient LIMITÉS : sinon n'importe quel
 * compte pouvait tester des milliers de codes à la seconde via l'API Supabase
 * (la fonction SQL n'est désormais accordée qu'au serveur, migration 0043).
 * Le code n'est réellement appliqué et décompté que dans create_order().
 */
export default defineEventHandler(async (event) => {
  requireCsrf(event)
  await checkRateLimit(event, { key: 'promo-validate', max: 20, windowMs: 10 * 60 * 1000 })
  await requireUser(event)

  const body = await readBody<{ eventId?: unknown; code?: unknown }>(event).catch(() => ({}) as any)
  const eventId = typeof body?.eventId === 'string' ? body.eventId : ''
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase().slice(0, 40) : ''
  if (!UUID_RE.test(eventId) || !code) return { valid: false, error: 'PROMO_INVALID' }

  const { data, error } = await useSupabaseAdmin().rpc('validate_promo_code', { p_event_id: eventId, p_code: code })
  if (error) {
    console.error('[api/promo/validate] échec validate_promo_code :', error.message)
    return { valid: false, error: 'PROMO_INVALID' }
  }
  return data
})
