import { requireCsrf } from '~/server/utils/csrf'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { verifyTurnstile } from '~/server/utils/turnstile'

/**
 * POST /api/waitlist/join — rejoindre la liste d'attente d'un événement complet.
 *
 * Accessible sans connexion (un visiteur non authentifié doit pouvoir
 * laisser son email), donc protégé comme le formulaire de contact plutôt
 * que comme une commande : CSRF, limite de débit par IP, honeypot,
 * Turnstile. Écrit via service_role — voir supabase/migrations/0031_waitlist.sql
 * pour pourquoi aucune policy d'insertion cliente n'existe.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  requireCsrf(event)
  await checkRateLimit(event, { key: 'waitlist-join', max: 5, windowMs: 10 * 60 * 1000 })

  const body = await readBody<{
    eventId?: string
    email?: string
    quantity?: number
    website?: string // honeypot
    captchaToken?: string
  }>(event)

  if (body.website) {
    // Bot détecté : on répond succès sans rien écrire, sans le révéler.
    return { success: true }
  }

  await verifyTurnstile(event, body.captchaToken)

  const eventId = body.eventId
  const email = body.email?.trim().toLowerCase()
  const quantity = Math.min(Math.max(Math.trunc(Number(body.quantity) || 1), 1), 10)

  if (!eventId || !UUID_RE.test(eventId)) {
    throw createError({ statusCode: 400, statusMessage: 'INVALID_EVENT' })
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'INVALID_EMAIL' })
  }

  const supabaseAdmin = useSupabaseAdmin()

  const { data: ev, error: evErr } = await supabaseAdmin.from('events').select('id, status').eq('id', eventId).maybeSingle()
  if (evErr || !ev || ev.status !== 'published') {
    throw createError({ statusCode: 404, statusMessage: 'EVENT_NOT_AVAILABLE' })
  }

  // Si l'appelant est connecté, on rattache l'inscription à son compte
  // (facultatif — le champ user_id reste nullable pour un visiteur anonyme).
  let userId: string | null = null
  const authHeader = getHeader(event, 'authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const { data } = await supabaseAdmin.auth.getUser(authHeader.slice(7))
    userId = data.user?.id ?? null
  }

  const { error } = await supabaseAdmin.from('waitlist_entries').insert({
    event_id: eventId,
    user_id: userId,
    email,
    quantity_wanted: quantity,
  })

  if (error) {
    if (error.code === '23505') {
      // Déjà inscrit avec cet email pour cet événement : pas une erreur pour l'utilisateur.
      return { success: true, alreadyJoined: true }
    }
    console.error('[api/waitlist/join] échec inscription :', error)
    throw createError({ statusCode: 500, statusMessage: 'JOIN_FAILED' })
  }

  return { success: true }
})
