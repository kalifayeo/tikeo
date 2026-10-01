/**
 * HTTPS obligatoire en production (cahier des charges §52 : « Le HTTPS doit
 * être obligatoire »).
 *
 * Sur Vercel, la redirection http → https est déjà faite par la plateforme ;
 * ce middleware protège les autres hébergements (VPS + nginx, Render, Railway,
 * Cloudflare…) en redirigeant (301) toute requête que le proxy déclare
 * arrivée en HTTP via l'en-tête standard `x-forwarded-proto`.
 *
 * On ne se fie volontairement qu'à cet en-tête : les appels internes de Nuxt
 * (SSR → /api/...) n'en portent pas et ne sont donc jamais redirigés. Le
 * développement local (npm run dev) n'est pas concerné.
 */
export default defineEventHandler((event) => {
  if (process.env.NODE_ENV !== 'production') return

  const forwardedProto = getHeader(event, 'x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()
  if (forwardedProto !== 'http') return

  const host = getHeader(event, 'x-forwarded-host') || getHeader(event, 'host')
  if (!host) return

  const hostname = host.split(':')[0].toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) return

  return sendRedirect(event, `https://${host}${event.node.req.url || '/'}`, 301)
})
