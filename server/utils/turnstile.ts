import type { H3Event } from 'h3'

/**
 * Vérifie un jeton Cloudflare Turnstile (composants TurnstileWidget.vue /
 * composables/useCaptcha.ts) auprès de l'API `siteverify`.
 *
 * Contrairement aux écrans d'authentification (où Supabase Auth vérifie le
 * jeton lui-même si "CAPTCHA protection" est activé dans le dashboard), les
 * routes serveur "maison" (ex. /api/contact) n'ont personne pour valider ce
 * jeton à leur place : c'est le rôle de cette fonction.
 *
 * Désactivé (aucun effet) tant que TURNSTILE_SECRET_KEY n'est pas
 * renseignée côté serveur — cohérent avec useCaptcha() qui désactive déjà
 * le widget côté client tant que NUXT_PUBLIC_TURNSTILE_SITE_KEY est vide.
 * Les deux clés doivent être configurées ensemble.
 */
export async function verifyTurnstile(event: H3Event, token?: string) {
  const config = useRuntimeConfig(event)
  const secret = config.turnstileSecretKey

  if (!secret) return // Anti-robot non configuré sur cet environnement.

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Vérification anti-robot manquante. Rechargez la page et réessayez.',
    })
  }

  const body = new URLSearchParams({ secret, response: token })
  const ip = getRequestIP(event, { xForwardedFor: true })
  if (ip) body.set('remoteip', ip)

  try {
    const result = await $fetch<{ success: boolean }>('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    })
    if (!result?.success) {
      throw createError({ statusCode: 400, statusMessage: 'Vérification anti-robot invalide. Réessayez.' })
    }
  } catch (err: any) {
    // Si l'erreur vient déjà de notre createError ci-dessus, on la relance telle quelle.
    if (err?.statusCode === 400) throw err
    // Panne réseau / Cloudflare indisponible : on refuse par prudence plutôt
    // que de laisser passer silencieusement un formulaire non vérifié.
    console.error('[turnstile] échec de la vérification :', err)
    throw createError({ statusCode: 502, statusMessage: "Vérification anti-robot indisponible pour le moment. Réessayez dans un instant." })
  }
}
