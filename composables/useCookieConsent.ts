/**
 * Consentement aux cookies non essentiels (mesure d'audience).
 *
 * Les cookies "nécessaires" (session, langue, thème, pays) ne demandent pas
 * de consentement ; seule la mesure d'audience (plugins/analytics.client.ts)
 * est conditionnée à ce choix. Le choix est mémorisé 6 mois puis redemandé.
 *
 * `null` = pas encore de choix → la bannière s'affiche.
 * Refuser doit être aussi simple qu'accepter : les deux boutons ont le même
 * poids visuel dans CookieBanner.vue.
 */
export type CookieConsent = 'accepted' | 'refused'

export function useCookieConsent() {
  const consent = useCookie<CookieConsent | null>('tikeo_consent', {
    default: () => null,
    maxAge: 60 * 60 * 24 * 180,
    sameSite: 'lax',
    path: '/',
    secure: !import.meta.dev,
  })

  // Permet de rouvrir la bannière depuis « Gérer les cookies » (footer / menu mobile).
  const preferencesOpen = useState<boolean>('tikeo-cookie-preferences-open', () => false)

  const bannerVisible = computed(() => consent.value === null || preferencesOpen.value)
  const analyticsAllowed = computed(() => consent.value === 'accepted')

  function setConsent(value: CookieConsent) {
    consent.value = value
    preferencesOpen.value = false
  }

  function openPreferences() {
    preferencesOpen.value = true
  }

  return { consent, bannerVisible, analyticsAllowed, setConsent, openPreferences }
}
