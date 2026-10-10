import webpush from 'web-push'

let configured = false

function ensureConfigured() {
  if (configured) return true
  const config = useRuntimeConfig()
  if (!config.public.vapidPublicKey || !config.vapidPrivateKey) return false
  webpush.setVapidDetails(config.vapidSubject || 'mailto:support@tikeo.app', config.public.vapidPublicKey, config.vapidPrivateKey)
  configured = true
  return true
}

export function isPushConfigured(): boolean {
  const config = useRuntimeConfig()
  return !!(config.public.vapidPublicKey && config.vapidPrivateKey)
}

export interface PushSubscriptionRow {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

/**
 * Envoie une notification push à un appareil précis. Retourne `false` (sans
 * lancer d'exception) si l'abonnement n'est plus valide (410/404) : à
 * l'appelant de supprimer la ligne correspondante en base.
 */
export async function sendPushToSubscription(
  sub: PushSubscriptionRow,
  payload: { title: string; body: string; url?: string }
): Promise<boolean> {
  if (!ensureConfigured()) return false
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    )
    return true
  } catch (e: any) {
    const status = e?.statusCode
    if (status === 404 || status === 410) return false // abonnement expiré : nettoyage à faire par l'appelant
    console.error('[webPush] échec d\'envoi :', status, e?.body || e?.message)
    return false
  }
}
