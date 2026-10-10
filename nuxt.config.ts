// https://nuxt.com/docs/api/configuration/nuxt-config
const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;600;700;800&family=Instrument+Sans:wght@400;500;600;700&display=swap'

// --- Content-Security-Policy -------------------------------------------------
// Actif uniquement en production (le mode dev de Vite a besoin d'eval/WebSocket).
// Hôtes autorisés = ceux réellement utilisés par le site : Supabase (API, storage,
// temps réel), Cloudflare Turnstile, polices Google, tuiles OpenStreetMap +
// Nominatim (cartes), icônes Leaflet (cdnjs), Plausible (analytics, optionnel).
// 'unsafe-inline' reste nécessaire sur script-src car Nuxt injecte le payload
// d'hydratation en <script> inline (un nonce demanderait le module nuxt-security).
// Le gain : plus aucun script externe non listé, ni eval(), ni <object>, ni <base>.
// Filet de sécurité : NUXT_CSP_REPORT_ONLY=true ne bloque rien (le navigateur
// signale seulement les violations dans la console) — à utiliser si un écran casse.
const IS_PROD = process.env.NODE_ENV === 'production'
function originOf(url: string | undefined, fallback = ''): string {
  try {
    return url ? new URL(url).origin : fallback
  } catch {
    return fallback
  }
}
const SUPABASE_ORIGIN = originOf(process.env.NUXT_PUBLIC_SUPABASE_URL, 'https://*.supabase.co')
const SUPABASE_WS = SUPABASE_ORIGIN.replace(/^https:/, 'wss:')
const PLAUSIBLE_ORIGIN = originOf(process.env.NUXT_PUBLIC_PLAUSIBLE_SRC, 'https://plausible.io')
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com ${PLAUSIBLE_ORIGIN}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_WS} https://nominatim.openstreetmap.org https://challenges.cloudflare.com ${PLAUSIBLE_ORIGIN}`,
  'frame-src https://challenges.cloudflare.com https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com',
  "media-src 'self' blob: data: https:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ')
const CSP_HEADER =
  process.env.NUXT_CSP_REPORT_ONLY === 'true' ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy'
const CSP_DEV = "frame-ancestors 'self'; base-uri 'self'; object-src 'none'"

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
    // Jèko (paiement) : Wave, Orange Money, MTN MoMo, Moov Money, Djamo — voir
    // server/utils/jeko.ts. Jamais exposé au client.
    jekoApiKey: process.env.JEKO_API_KEY || '',
    jekoApiKeyId: process.env.JEKO_API_KEY_ID || '',
    // Optionnel : si vide, le magasin est lu via GET /partner_api/stores.
    jekoStoreId: process.env.JEKO_STORE_ID || '',
    // Secret de signature des webhooks (Dashboard Jèko > Paramètres > API & Webhooks).
    jekoWebhookSecret: process.env.JEKO_WEBHOOK_SECRET || '',
    // Anti-robots (Cloudflare Turnstile) côté serveur : vérifie les jetons
    // produits par TurnstileWidget.vue pour les routes qui ne passent pas
    // par Supabase Auth (ex. /api/contact). Doit être la clé "secrète" du
    // même site Turnstile que NUXT_PUBLIC_TURNSTILE_SITE_KEY ci-dessous.
    turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY || '',
    // Tâche planifiée (rappels d'événement, expiration liste d'attente/transferts,
    // envoi des notifications en attente) — voir server/api/cron/tick.post.ts et
    // README.md § Tâche planifiée. Un en-tête Authorization: Bearer <secret> doit
    // correspondre à cette valeur ; vide = la route refuse tout appel.
    cronSecret: process.env.CRON_SECRET || '',
    // Notifications push (rappels, liste d'attente, transferts) — clés VAPID,
    // générées une fois avec `npx web-push generate-vapid-keys`. La clé publique
    // est aussi exposée côté client, voir public.vapidPublicKey ci-dessous.
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
    vapidSubject: process.env.VAPID_SUBJECT || 'mailto:support@tikeo.app',
    // Google Wallet (bouton "Ajouter au Google Wallet" sur le billet) : compte de
    // service (JSON, sur une seule ligne) créé dans Google Wallet Console.
    googleWalletIssuerId: process.env.GOOGLE_WALLET_ISSUER_ID || '',
    googleWalletServiceAccountJson: process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON || '',
    // Apple Wallet (.pkpass) : nécessite un certificat de signature de pass Apple
    // Developer + le certificat intermédiaire WWDR (tous deux en PEM, base64 sur
    // une ligne) ; désactivé tant qu'ils ne sont pas fournis (voir server/utils/appleWallet.ts).
    appleWalletTeamId: process.env.APPLE_WALLET_TEAM_ID || '',
    appleWalletPassTypeId: process.env.APPLE_WALLET_PASS_TYPE_ID || '',
    appleWalletCertBase64: process.env.APPLE_WALLET_CERT_BASE64 || '',
    appleWalletKeyBase64: process.env.APPLE_WALLET_KEY_BASE64 || '',
    appleWalletKeyPassphrase: process.env.APPLE_WALLET_KEY_PASSPHRASE || '',
    appleWalletWwdrBase64: process.env.APPLE_WALLET_WWDR_BASE64 || '',
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
      // Clé publique VAPID (notifications push) : vide = bouton "Activer les
      // notifications" masqué (voir composables/usePushNotifications.ts).
      vapidPublicKey: process.env.NUXT_PUBLIC_VAPID_PUBLIC_KEY || '',
      // Vidéo de présentation (bouton « Voir la vidéo ») : fichier du site,
      // lien YouTube / Vimeo ou URL .mp4. Voir public/videos/LISEZ-MOI.txt.
      // (Le lien saisi dans /admin/accueil a priorité sur cette valeur.)
      presentationVideoUrl: process.env.NUXT_PUBLIC_PRESENTATION_VIDEO_URL || '/videos/presentation.mp4',
      presentationVideoPoster: process.env.NUXT_PUBLIC_PRESENTATION_VIDEO_POSTER || '',
      // Chaîne WhatsApp officielle (bouton vert flottant). Surchargeable via .env ; vide = masqué.
      whatsappChannelUrl: process.env.NUXT_PUBLIC_WHATSAPP_CHANNEL_URL || 'https://whatsapp.com/channel/0029Vb8vVkw2kNFnqt0cAx0c',
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
    // fichiers statiques servis par le CDN. La CSP complète (script-src...)
    // est construite plus haut (constante CSP) et n'est active qu'en production.
    '/**': {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        // camera=(self) : le scanner de billets utilisera la caméra.
        'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=(self)',
        // 1 an + sous-domaines (les sous-domaines organisateurs sont tous en HTTPS). Pas de « preload » : irréversible.
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        [IS_PROD ? CSP_HEADER : 'Content-Security-Policy']: IS_PROD ? CSP : CSP_DEV,
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
    // Page de maintenance (voir server/middleware/maintenance.ts) : jamais indexée ni mise en cache.
    '/maintenance': { headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' } },
    '/api/**': { headers: { 'X-Robots-Tag': 'noindex' } },
  },
})
