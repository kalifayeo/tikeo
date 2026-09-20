// https://nuxt.com/docs/api/configuration/nuxt-config
const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap'

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },

  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt', '@nuxtjs/i18n'],

  css: ['~/assets/css/main.css'],

  i18n: {
    lazy: true,
    // Nos fichiers de langue sont déjà dans i18n/locales/ (racine du projet),
    // donc on désactive la restructuration automatique de @nuxtjs/i18n v9+
    // (qui préfixerait "i18n/" une seconde fois).
    restructureDir: false,
    langDir: 'i18n/locales',
    defaultLocale: 'fr',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'tikeo_locale',
      redirectOn: 'root',
    },
    locales: [
      { code: 'fr', name: 'Français', file: 'fr.json' },
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'es', name: 'Español', file: 'es.json' },
      { code: 'pt', name: 'Português', file: 'pt.json' },
    ],
  },

  app: {
    // Transition douce entre les pages (fondu + léger glissement), déclinée
    // en CSS dans assets/css/main.css (.page-enter-active, etc.) — visible
    // sur toute navigation du site, sans rien changer par page.
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      title: 'Tikeo - La billetterie simple et intelligente pour vos événements',
      meta: [
        { charset: 'utf-8' },
        // Pas de maximum-scale=1 : bloquer le zoom est un défaut d'accessibilité (WCAG 1.4.4).
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            "Tikeo est la plateforme de billetterie en ligne pour découvrir, acheter et gérer vos billets d'événements en Côte d'Ivoire et en Afrique.",
        },
        { name: 'theme-color', content: '#FF7A00' },
      ],
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
        // Polices : préconnexion + chargement non bloquant (avant : @import CSS,
        // qui retardait tout le rendu). Le texte s'affiche tout de suite avec
        // la police système puis bascule sur Poppins (display=swap).
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: FONTS_URL, media: 'print', onload: "this.media='all'" },
      ],
      noscript: [{ innerHTML: `<link rel="stylesheet" href="${FONTS_URL}">` }],
    },
  },

  runtimeConfig: {
    // Clés serveur uniquement (jamais exposées au client)
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    // "true" = autoriser l'indexation même hors domaine racine (voir server/routes/robots.txt.ts).
    allowIndexing: process.env.ALLOW_INDEXING || '',
    // Brevo : conservé pour les futurs emails transactionnels applicatifs
    // (confirmation de commande, billet, etc. — voir cahier des charges §37).
    // L'authentification, elle, passe désormais par Supabase Auth, dont le
    // SMTP est configuré directement dans le dashboard Supabase.
    brevoApiKey: process.env.BREVO_API_KEY || '',
    brevoSenderEmail: process.env.BREVO_SENDER_EMAIL || 'no-reply@tikeo.app',
    brevoSenderName: process.env.BREVO_SENDER_NAME || 'Tikeo',
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || '',
      supabaseAnonKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY || '',
      // Domaine racine de production, utilisé par server/middleware/subdomain.ts
      // pour reconnaître un sous-domaine d'événement (himra.tikeo.com) et le
      // distinguer d'un sous-domaine réservé (www/app/admin/api) ou d'un accès
      // direct par IP/localhost en développement (voir §14-16 du cahier des charges).
      rootDomain: process.env.NUXT_PUBLIC_ROOT_DOMAIN || 'tikeo.com',
      // Mesure d'audience (Plausible) — chargée seulement si renseignée ET
      // si le visiteur a accepté les cookies (plugins/analytics.client.ts).
      plausibleDomain: process.env.NUXT_PUBLIC_PLAUSIBLE_DOMAIN || '',
      plausibleSrc: process.env.NUXT_PUBLIC_PLAUSIBLE_SRC || '',
      // Anti-robots (Cloudflare Turnstile) sur inscription / connexion /
      // mot de passe oublié. Vide = désactivé. Le même captcha doit être
      // activé dans Supabase (Authentication > Attack Protection).
      turnstileSiteKey: process.env.NUXT_PUBLIC_TURNSTILE_SITE_KEY || '',
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },

  // Mobile-first: généré ensuite en app native via Capacitor (voir /capacitor)
  ssr: true,

  // ------------------------------------------------------------------
  // Zones protégées (admin / organisateur / espace membre) :
  // la session Supabase ne vit que côté client (plugins/supabase.client.ts
  // est un plugin ".client", donc useSupabase() renvoie undefined pendant
  // le SSR). Les middlewares admin.ts / organizer.ts / auth.ts le savent
  // et font `if (import.meta.server) return`, ce qui veut dire qu'en accès
  // direct (URL tapée, F5) le serveur envoyait tout le HTML de la page
  // protégée SANS AUCUNE vérification, puis le client, une fois hydraté,
  // se rendait compte que l'utilisateur n'est pas admin et redirigeait
  // vers "/" — d'où le flash de contenu + la page "mélangée" observée
  // (l'ancien layout admin encore monté pendant que la page d'accueil
  // s'injecte dedans).
  // En coupant le SSR sur ces routes, Nitro renvoie une coquille vide et
  // tout se joue côté client, où le middleware peut trancher AVANT que
  // quoi que ce soit ne soit affiché : plus de flash, plus de mélange.
  routeRules: {
    // En-têtes de sécurité sur toutes les réponses (cahier des charges §55).
    // Posés ici (et non dans un middleware) pour qu'ils s'appliquent aussi aux
    // fichiers statiques servis par le CDN. Pas de CSP « script-src » ici :
    // elle demande un test complet en conditions réelles (Supabase, polices,
    // Turnstile, Plausible) — voir CHANGEMENTS.md, section « À faire ensuite ».
    '/**': {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        // camera=(self) : le scanner de billets utilisera la caméra.
        'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=(self)',
        'Strict-Transport-Security': 'max-age=15552000',
        'Content-Security-Policy': "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
      },
    },
    // Zones privées : pas de rendu serveur (voir commentaire ci-dessus) et
    // jamais indexées par les moteurs de recherche.
    '/admin/**': { ssr: false, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/organisateur/**': { ssr: false },
    '/mon-espace/**': { ssr: false, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/organisateur/dashboard': { headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/organisateur/evenements/**': { headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/organisateur/revenus': { headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/organisateur/parametres': { headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/api/**': { headers: { 'X-Robots-Tag': 'noindex' } },
  },
})
