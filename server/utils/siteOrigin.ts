import type { H3Event } from 'h3'

/**
 * Origine canonique du site côté serveur (robots.txt, sitemap.xml).
 * Même règle que composables/useSiteOrigin.ts : sur le domaine racine ou un
 * de ses sous-domaines → https://<rootDomain> ; ailleurs → origine courante.
 */
export function getSiteOrigin(event: H3Event): string {
  const config = useRuntimeConfig(event)
  const rootDomain = String(config.public.rootDomain || 'tikeo.com').toLowerCase()
  const url = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true })
  return isRootDomainHost(url.hostname, rootDomain) ? `https://${rootDomain}` : url.origin
}

export function isRootDomainHost(hostname: string, rootDomain: string): boolean {
  const host = hostname.toLowerCase()
  return host === rootDomain || host.endsWith(`.${rootDomain}`)
}
