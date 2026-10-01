/* Tikeo — service worker (PWA).
 * Rôle volontairement limité et sûr :
 *  - rendre l'app installable et afficher une page « hors connexion » claire
 *    quand le réseau est coupé ;
 *  - accélérer les visites suivantes en gardant en cache les fichiers
 *    statiques versionnés (/_nuxt/, icônes, logo).
 * Il ne met JAMAIS en cache : les appels /api/, l'admin, l'espace
 * organisateur/personnel, ni les requêtes vers d'autres domaines (Supabase,
 * paiement) — aucune donnée personnelle ou de paiement n'est stockée ici. */
const VERSION = 'tikeo-v1'
const STATIC_CACHE = `${VERSION}-static`
const PRECACHE = ['/offline.html', '/logo-tikeo.png', '/icon-192.png', '/favicon.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

const isStaticAsset = (url) =>
  url.pathname.startsWith('/_nuxt/') || /\.(?:png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(url.pathname)

const isPrivateArea = (url) =>
  url.pathname.startsWith('/api/') ||
  url.pathname.startsWith('/admin') ||
  url.pathname.startsWith('/organisateur') ||
  url.pathname.startsWith('/mon-espace') ||
  url.pathname.startsWith('/paiement')

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Supabase, CinetPay, polices : le navigateur gère

  // Pages : réseau d'abord ; si hors connexion, page dédiée.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/offline.html')))
    return
  }

  if (isPrivateArea(url) || !isStaticAsset(url)) return

  // Fichiers statiques : cache immédiat + mise à jour discrète en arrière-plan.
  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(req)
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone())
          return res
        })
        .catch(() => cached)
      return cached || network
    })
  )
})
