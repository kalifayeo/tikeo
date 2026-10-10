/**
 * Au démarrage du serveur en production, signale dans les logs les protections
 * de sécurité qui ne sont pas configurées (rien n'est bloqué : c'est un rappel).
 * Guide de configuration : SECURITE.md.
 */
export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV !== 'production') return
  const config = useRuntimeConfig()
  const missing: string[] = []
  if (!config.turnstileSecretKey || !config.public.turnstileSiteKey) {
    missing.push('Anti-robot Turnstile désactivé (TURNSTILE_SECRET_KEY / NUXT_PUBLIC_TURNSTILE_SITE_KEY vides) : inscription, connexion, contact et liste d\'attente sont ouverts aux robots.')
  }
  if (!config.cronSecret) missing.push('CRON_SECRET vide : les tâches planifiées (/api/cron/tick) sont désactivées.')
  if (!config.jekoWebhookSecret) missing.push('JEKO_WEBHOOK_SECRET vide : les webhooks de paiement seront rejetés (401).')
  for (const m of missing) console.warn(`[sécurité] ${m}`)
})
