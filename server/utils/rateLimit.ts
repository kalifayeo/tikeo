import type { H3Event } from 'h3'

/**
 * Limiteur de débit basique, en mémoire, par IP — pour les endpoints
 * publics (formulaire de contact, etc.) exposés sans authentification.
 *
 * Limite connue : ce compteur vit dans la mémoire du processus Node. Sur un
 * déploiement multi-instances (plusieurs conteneurs derrière un load
 * balancer), chaque instance a son propre compteur — la limite globale
 * réelle est alors (limite × nombre d'instances). Suffisant pour dissuader
 * un script naïf ; si Tikeo grossit, remplacer par un compteur partagé
 * (Redis/Upstash) pour une limite strictement globale.
 */
const buckets = new Map<string, { count: number; resetAt: number }>()

// Purge périodique pour ne pas laisser grossir la Map indéfiniment.
setInterval(
  () => {
    const now = Date.now()
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt < now) buckets.delete(key)
    }
  },
  10 * 60 * 1000
).unref?.()

export function checkRateLimit(event: H3Event, opts: { key: string; max: number; windowMs: number }) {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const bucketKey = `${opts.key}:${ip}`
  const now = Date.now()

  const bucket = buckets.get(bucketKey)
  if (!bucket || bucket.resetAt < now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + opts.windowMs })
    return
  }

  bucket.count += 1
  if (bucket.count > opts.max) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Trop de tentatives. Merci de patienter quelques minutes avant de réessayer.',
    })
  }
}
