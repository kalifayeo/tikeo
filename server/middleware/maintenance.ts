import { getMaintenanceState } from '~/server/utils/maintenance'
import { retryAfterSeconds } from '~/utils/maintenance'

/**
 * Garde « mode maintenance » (piloté depuis /admin/maintenance).
 *
 * Quand la maintenance est active :
 *  - PAGES : tout visiteur est redirigé vers /maintenance, qui répond en HTTP
 *    503 + Retry-After (les moteurs de recherche comprennent « indisponible
 *    temporairement » et ne désindexent pas le site).
 *  - API : les routes /api/* répondent 503 (code MAINTENANCE), ce qui bloque
 *    notamment la création de commandes — même si quelqu'un appelle l'API
 *    directement sans passer par l'interface.
 *
 * Toujours laissé ouvert :
 *  - /maintenance, /connexion, /mot-de-passe-oublie et /admin/** (un admin
 *    doit pouvoir se connecter pour désactiver la maintenance ; l'accès admin
 *    reste protégé par son propre contrôle de rôle + 2FA) ;
 *  - les fichiers statiques (/_nuxt, images, polices, robots.txt, sitemap…) ;
 *  - /api/admin, /api/maintenance, /api/csrf-token, /api/cron ;
 *  - /api/payments/** (webhook Jèko) et les routes de suivi d'une commande
 *    EXISTANTE (lecture, confirmation de paiement) : un paiement déjà lancé ne
 *    doit jamais être coupé en plein milieu. Seuls la création d'une nouvelle
 *    commande et le lancement d'un paiement sont bloqués.
 *
 * Aperçu pour les admins : le layout admin pose un cookie `tikeo_maint_bypass`.
 * Il permet de VOIR le site (pages + lectures GET) pendant la maintenance, pour
 * vérifier une mise à jour avant de rouvrir. Ce n'est qu'un confort d'affichage,
 * pas une barrière de sécurité : les écritures restent bloquées pour tous, et
 * tout ce qui est sensible reste protégé par les contrôles propres à chaque route.
 */
const BYPASS_COOKIE = 'tikeo_maint_bypass'

const OPEN_PAGE_PREFIXES = ['/maintenance', '/connexion', '/mot-de-passe-oublie', '/admin']
const OPEN_API_PREFIXES = ['/api/admin', '/api/maintenance', '/api/csrf-token', '/api/cron', '/api/payments']
const STATIC_FILE = /\.(?:png|jpe?g|webp|gif|svg|ico|css|js|mjs|map|woff2?|ttf|txt|xml|json|webmanifest|html)$/i

const isUnder = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + '/')

function isOpenApi(path: string, method: string) {
  if (OPEN_API_PREFIXES.some((p) => isUnder(path, p))) return true
  // Suivi d'une commande déjà créée : lecture + confirmation de paiement.
  if (/^\/api\/orders\/[^/]+\/confirm-payment$/.test(path)) return true
  if (method === 'GET' && path.startsWith('/api/orders/')) return true
  return false
}

export default defineEventHandler(async (event) => {
  const path = (event.path || '/').split('?')[0]

  if (path.startsWith('/_nuxt') || path.startsWith('/__nuxt') || STATIC_FILE.test(path)) return

  const isApi = path.startsWith('/api/')
  if (isApi ? isOpenApi(path, event.method) : OPEN_PAGE_PREFIXES.some((p) => isUnder(path, p))) return
  // Pages d'un paiement en cours (retour Wave / Orange Money…) : voir ci-dessus.
  if (!isApi && isUnder(path, '/commande')) return

  const state = await getMaintenanceState()
  if (!state.enabled) return

  const isRead = event.method === 'GET' || event.method === 'HEAD'
  if (isRead && getCookie(event, BYPASS_COOKIE) === '1') return

  if (!isApi && isRead) {
    setResponseHeader(event, 'Cache-Control', 'no-store')
    return sendRedirect(event, '/maintenance', 302)
  }

  setResponseHeader(event, 'Retry-After', String(retryAfterSeconds(state)))
  throw createError({
    statusCode: 503,
    statusMessage: 'Le site est en maintenance. Réessayez dans quelques instants.',
    data: { code: 'MAINTENANCE' },
  })
})
