import { requireCsrf } from '~/server/utils/csrf'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { verifyTurnstile } from '~/server/utils/turnstile'
import { requireUser } from '~/server/utils/userAuth'

/**
 * POST /api/feedback
 * Avis d'un visiteur (connecté ou non) sur la plateforme, depuis /avis.
 * Mêmes protections que /api/contact : CSRF, limite de débit par IP,
 * honeypot, Turnstile. Si un jeton de session valide est fourni, l'avis est
 * rattaché au compte (user_id lu depuis le jeton, jamais depuis le corps).
 */
export default defineEventHandler(async (event) => {
  requireCsrf(event)
  await checkRateLimit(event, { key: 'feedback', max: 4, windowMs: 10 * 60 * 1000 })

  const body = await readBody<{
    rating?: number
    category?: string
    message?: string
    displayName?: string
    email?: string
    allowPublic?: boolean
    website?: string
    captchaToken?: string
  }>(event)

  if (body.website) return { success: true } // honeypot : on fait semblant

  await verifyTurnstile(event, body.captchaToken)

  const rating = Number(body.rating)
  const category = ['praise', 'idea', 'bug', 'other'].includes(String(body.category)) ? String(body.category) : 'other'
  const message = body.message?.trim() ?? ''
  const email = body.email?.trim().toLowerCase() || null
  let displayName = body.displayName?.trim().slice(0, 60) || ''

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw createError({ statusCode: 400, statusMessage: 'Choisissez une note de 1 à 5.' })
  }
  if (message.length < 5 || message.length > 1000) {
    throw createError({ statusCode: 400, statusMessage: 'Votre message doit contenir entre 5 et 1000 caractères.' })
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Adresse email invalide.' })
  }

  let userId: string | null = null
  if (getHeader(event, 'authorization')) {
    try {
      userId = (await requireUser(event)).userId
    } catch {
      userId = null // session expirée : l'avis reste valable en anonyme
    }
  }
  if (!displayName) displayName = 'Visiteur'

  try {
    const supabaseAdmin = useSupabaseAdmin()
    const { error } = await supabaseAdmin.from('site_feedback').insert({
      user_id: userId,
      display_name: displayName,
      email,
      rating,
      category,
      message,
      allow_public: body.allowPublic === true,
    })
    if (error) throw error
    return { success: true }
  } catch (err) {
    console.error('[api/feedback] échec enregistrement :', err)
    throw createError({ statusCode: 500, statusMessage: "Impossible d'enregistrer votre avis pour le moment." })
  }
})
