/* Tikeo — service worker (PWA).
 * Rôle volontairement limité et sûr :
 *  - rendre l'app installable et afficher une page « hors connexion » claire
 *    quand le réseau est coupé ;
 *  - accélérer les visites suivantes en gardant en cache les fichiers
 *    statiques versionnés (/_nuxt/, icônes, logo) ;
 *  - permettre à l'espace acheteur (mon-espace/mes-billets) de se recharger
 *    hors connexion : l'app est une SPA (ssr:false sur ces routes), donc la
 *    page HTML servie est un même « coquille » quel que soit le chemin — on
 *    en garde une copie, et c'est le routeur Vue (côté client) qui affiche
 *    ensuite le bon écran à partir de l'adresse demandée. Les billets
 *    eux-mêmes (et leur QR code, généré localement) viennent du cache du
 *    navigateur pour cette zone, voir composables/useBuyerSpace.ts ;
 *  - relayer les notifications push (rappels d'événement, liste d'attente,
 *    transferts de billet) — voir composables/usePushNotifications.ts et
 *    server/api/cron/tick.post.ts pour l'envoi.
 * Il ne met JAMAIS en cache : les appels /api/, l'admin, ni les requêtes vers
 * d'autres domaines (Supabase, paiement) — aucune donnée personnelle ou de
 * paiement n'est stockée ici. */
const VERSION = 'tikeo-v2'
const STATIC_CACHE = `${VERSION}-static`
const SHELL_CACHE = `${VERSION}-shell`
const OFFLINE_SHELL_KEY = '/__tikeo-offline-shell__'
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

// Zones acheteur/organisateur/admin où l'app tourne en SPA pure (ssr:false) :
// leur page HTML est interchangeable, on peut donc la rejouer hors connexion.
const isAppShellArea = (url) =>
  url.pathname.startsWith('/mon-espace') || url.pathname.startsWith('/organisateur') || url.pathname.startsWith('/admin')

const isPrivateArea = (url) => url.pathname.startsWith('/api/') || url.pathname.startsWith('/paiement') || isAppShellArea(url)

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Supabase, CinetPay, polices : le navigateur gère

  // Pages : réseau d'abord.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Une navigation réussie dans une zone SPA devient la "coquille" de secours.
          if (res && res.ok && isAppShellArea(url)) {
            caches.open(SHELL_CACHE).then((cache) => cache.put(OFFLINE_SHELL_KEY, res.clone()))
          }
          return res
        })
        .catch(async () => {
          if (isAppShellArea(url)) {
            const shell = await caches.match(OFFLINE_SHELL_KEY)
            if (shell) return shell
          }
          return caches.match('/offline.html')
        })
    )
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

// --- Notifications push (rappels, liste d'attente, transferts) --------------
self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload = {}
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Tikeo', body: event.data.text() }
  }
  const title = payload.title || 'Tikeo'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: payload.url || '/mon-espace' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/mon-espace'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if (client.url.includes(targetUrl) && 'focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    })
  )
})
