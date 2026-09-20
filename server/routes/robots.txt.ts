/**
 * GET /robots.txt — généré dynamiquement pour pointer vers le bon sitemap.
 *
 * - Domaine de production (tikeo.com et sous-domaines) : indexation autorisée,
 *   sauf zones privées et API.
 * - Autres hôtes (previews Vercel, localhost…) : tout est interdit, pour que
 *   les copies de test n'apparaissent jamais dans Google. Tant que le site
 *   tourne uniquement sur tikeo.vercel.app (sans domaine perso), mettre
 *   ALLOW_INDEXING=true dans les variables d'environnement pour autoriser.
 */
export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const rootDomain = String(config.public.rootDomain || 'tikeo.com').toLowerCase()
  const url = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true })
  const indexingAllowed = isRootDomainHost(url.hostname, rootDomain) || config.allowIndexing === 'true'

  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')

  if (!indexingAllowed) {
    return 'User-agent: *\nDisallow: /\n'
  }

  const origin = getSiteOrigin(event)
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /mon-espace',
    'Disallow: /organisateur/dashboard',
    'Disallow: /organisateur/evenements',
    'Disallow: /organisateur/revenus',
    'Disallow: /organisateur/parametres',
    'Disallow: /api/',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n')
})
