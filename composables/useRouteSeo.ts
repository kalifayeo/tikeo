/**
 * SEO par défaut de chaque page, dérivé de la route courante (appelé une
 * seule fois dans app.vue). Une page qui définit elle-même son titre
 * (accueil, événements, recherche, fiche événement) garde la main : son
 * `useSeoMeta` est enregistré après celui-ci et l'emporte.
 *
 * - Titres et descriptions : clés i18n `seo.pages.*` / `seo.desc.*`.
 * - Zones privées (espace membre, organisateur, admin) et pages d'auth :
 *   `noindex, nofollow` (en plus de l'en-tête X-Robots-Tag posé par
 *   nuxt.config.ts pour les zones privées).
 * - URL canonique : sans paramètres de requête (?redirect=…), sur l'origine
 *   canonique du site.
 */
const PAGE_KEYS: Record<string, string> = {
  '/connexion': 'login',
  '/inscription': 'register',
  '/mot-de-passe-oublie': 'forgotPassword',
  '/conditions': 'terms',
  '/confidentialite': 'privacy',
  '/contact': 'contact',
  '/faq': 'faq',
  '/qui-sommes-nous': 'about',
  '/organisateur': 'organizerLanding',
  '/organisateur/tarifs': 'pricing',
  '/mon-espace': 'account',
  '/mon-espace/tableau-de-bord': 'account',
  '/mon-espace/mes-billets': 'myTickets',
  '/mon-espace/mes-commandes': 'myOrders',
  '/mon-espace/mes-favoris': 'favorites',
  '/mon-espace/notifications': 'notifications',
  '/mon-espace/profil': 'profile',
  '/mon-espace/parametres': 'settings',
  '/mon-espace/portefeuille': 'wallet',
  '/organisateur/dashboard': 'organizerDashboard',
  '/organisateur/evenements': 'organizerEvents',
  '/organisateur/evenements/nouveau': 'organizerNew',
  '/organisateur/evenements/scanner': 'organizerScanner',
  '/organisateur/parametres': 'organizerSettings',
  '/organisateur/revenus': 'organizerRevenue',
  '/admin': 'admin',
  '/admin/utilisateurs': 'adminUsers',
  '/admin/organisateurs': 'adminOrganizers',
  '/admin/evenements': 'adminEvents',
  '/admin/demandes': 'adminRequests',
  '/admin/billets': 'adminTickets',
  '/admin/commandes': 'adminOrders',
  '/admin/paiements': 'adminPayments',
  '/admin/categories': 'adminCategories',
  '/admin/accueil': 'adminHome',
  '/admin/messages': 'adminMessages',
}

// Pages qui ont une description dédiée (seo.desc.<clé>).
const DESCRIPTION_KEYS = new Set(['login', 'register', 'terms', 'privacy', 'contact', 'faq', 'about', 'pricing'])

// Publiques mais sans intérêt pour les moteurs de recherche.
const NOINDEX_PUBLIC = new Set(['/connexion', '/inscription', '/mot-de-passe-oublie'])

const PUBLIC_ORGANIZER_PATHS = new Set(['/organisateur', '/organisateur/tarifs'])

function normalize(path: string) {
  return path.length > 1 ? path.replace(/\/+$/, '') : path
}

function isPrivatePath(path: string) {
  if (PUBLIC_ORGANIZER_PATHS.has(path)) return false
  return path.startsWith('/admin') || path.startsWith('/mon-espace') || path.startsWith('/organisateur')
}

export function useRouteSeo() {
  const { t, te, locale } = useI18n()
  const route = useRoute()
  const origin = useSiteOrigin()

  const path = computed(() => normalize(route.path))

  const pageKey = computed(() => {
    if (PAGE_KEYS[path.value]) return PAGE_KEYS[path.value]
    if (/^\/organisateur\/evenements\/[^/]+\/modifier$/.test(path.value)) return 'organizerEdit'
    return undefined
  })

  const noindex = computed(() => isPrivatePath(path.value) || NOINDEX_PUBLIC.has(path.value) || path.value.startsWith('/api'))

  const title = computed(() => (pageKey.value ? t(`seo.pages.${pageKey.value}`) : t('seo.defaultTitle')))
  const description = computed(() => {
    const key = pageKey.value
    return key && DESCRIPTION_KEYS.has(key) && te(`seo.desc.${key}`) ? t(`seo.desc.${key}`) : t('seo.defaultDescription')
  })

  const LOCALES: Record<string, string> = { fr: 'fr_FR', en: 'en_US', es: 'es_ES', pt: 'pt_PT' }

  useHead(() => ({
    htmlAttrs: { lang: locale.value },
    // Ajoute « — Tikeo » sauf si le titre le contient déjà.
    titleTemplate: (pageTitle?: string) => (!pageTitle || pageTitle.includes('Tikeo') ? pageTitle : `${pageTitle} — Tikeo`),
    link: noindex.value ? [] : [{ rel: 'canonical', href: `${origin}${path.value}` }],
  }))

  useSeoMeta({
    title: () => title.value,
    description: () => description.value,
    ogTitle: () => title.value,
    ogDescription: () => description.value,
    ogSiteName: 'Tikeo',
    ogType: 'website',
    ogLocale: () => LOCALES[locale.value] ?? 'fr_FR',
    ogImage: `${origin}/og-default.jpg`,
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageAlt: 'Tikeo',
    twitterCard: 'summary_large_image',
    robots: () => (noindex.value ? 'noindex, nofollow' : 'index, follow'),
  })
}
