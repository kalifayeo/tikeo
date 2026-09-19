// https://nuxt.com/docs/api/configuration/nuxt-config
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
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1' },
        {
          name: 'description',
          content:
            "Tikeo est la plateforme de billetterie en ligne pour découvrir, acheter et gérer vos billets d'événements en Côte d'Ivoire et en Afrique.",
        },
        { name: 'theme-color', content: '#FF7A00' },
      ],
      link: [{ rel: 'icon', type: 'image/png', href: '/favicon.png' }],
    },
  },

  runtimeConfig: {
    // Clés serveur uniquement (jamais exposées au client)
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
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
    '/admin/**': { ssr: false },
    '/organisateur/**': { ssr: false },
    '/mon-espace/**': { ssr: false },
  },
})
