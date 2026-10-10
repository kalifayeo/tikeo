/**
 * Mesure d'audience (Plausible) — chargée UNIQUEMENT si :
 *   1. NUXT_PUBLIC_PLAUSIBLE_DOMAIN est renseigné (sinon rien n'est chargé), et
 *   2. le visiteur a accepté les cookies (bannière CookieBanner.vue).
 *
 * Plausible ne dépose pas de cookie et reste très léger ; on le conditionne
 * quand même au consentement, en cohérence avec la politique de
 * confidentialité. Si le visiteur retire son accord, le script est retiré
 * et la mesure s'arrête dès cet instant.
 *
 * Auto-hébergé ? Renseignez NUXT_PUBLIC_PLAUSIBLE_SRC (ex. https://stats.tikeo.com/js/script.js).
 */
const SCRIPT_ID = 'tikeo-analytics'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const domain = config.public.plausibleDomain as string
  if (!domain) return

  const src = (config.public.plausibleSrc as string) || 'https://plausible.io/js/script.js'
  const { analyticsAllowed } = useCookieConsent()

  function enable() {
    if (document.getElementById(SCRIPT_ID)) return
    const s = document.createElement('script')
    s.id = SCRIPT_ID
    s.defer = true
    s.src = src
    s.setAttribute('data-domain', domain)
    document.head.appendChild(s)
  }

  function disable() {
    document.getElementById(SCRIPT_ID)?.remove()
  }

  watch(analyticsAllowed, (allowed) => (allowed ? enable() : disable()), { immediate: true })
})
