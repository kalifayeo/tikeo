/**
 * Construction du lien public d'un événement (cahier des charges §14-16 et §35).
 *
 * Deux formes possibles pour le même événement :
 *   1. Sous-domaine personnalisé : https://himra.tikeo.com
 *   2. URL de secours          : https://tikeo.com/e/himra
 *
 * La forme utilisée dépend UNIQUEMENT du domaine sur lequel l'app tourne
 * réellement au moment de l'appel :
 *   - Sur un domaine "racine" configuré (NUXT_PUBLIC_ROOT_DOMAIN=tikeo.com,
 *     avec le DNS wildcard *.tikeo.com configuré, cf. DOMAINE-VERCEL.md),
 *     on génère directement le sous-domaine : himra.tikeo.com.
 *   - Partout ailleurs (ex. tikeo.vercel.app, localhost, une preview
 *     Vercel du type tikeo-git-main-xxx.vercel.app) — c'est-à-dire tant
 *     qu'aucun nom de domaine perso n'est branché — on utilise
 *     automatiquement l'URL de secours /e/slug sur le domaine courant.
 *     Aucune configuration à changer : le jour où un vrai domaine est
 *     ajouté et pointé en wildcard, les liens deviennent automatiquement
 *     des sous-domaines, sans toucher au code.
 */

/**
 * Domaines sur lesquels un sous-domaine d'événement (himra.xxx) n'a
 * techniquement aucun sens : ce sont des domaines "partagés" (Vercel,
 * localhost) où l'on ne possède pas le DNS wildcard.
 */
function isSharedOrLocalHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.vercel.app') ||
    hostname.endsWith('.netlify.app') ||
    /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) // adresse IP brute
  )
}

export interface EventPublicUrlInput {
  slug: string
}

/**
 * Retourne { url, isSubdomain } pour l'événement donné, à partir du host
 * courant (fourni côté serveur par `event.node.req` via `useRequestURL()`,
 * ou déduit de `window.location` côté client).
 */
export function useEventPublicUrl() {
  const config = useRuntimeConfig()
  const rootDomain = (config.public.rootDomain || 'tikeo.com').toLowerCase()

  function currentOrigin(): { protocol: string; hostname: string; port: string } {
    if (import.meta.client) {
      return {
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        port: window.location.port,
      }
    }
    // Côté serveur (SSR / génération des métadonnées SEO)
    const reqUrl = useRequestURL()
    return { protocol: reqUrl.protocol, hostname: reqUrl.hostname, port: reqUrl.port }
  }

  function buildEventUrl({ slug }: EventPublicUrlInput): { url: string; isSubdomain: boolean } {
    const { protocol, hostname, port } = currentOrigin()
    const portSuffix = port ? `:${port}` : ''

    // On ne propose le sous-domaine que si l'app tourne bien sur le
    // domaine racine configuré (ou un de ses sous-domaines réservés
    // comme app.tikeo.com) — jamais sur *.vercel.app / localhost.
    const onRootDomain =
      !isSharedOrLocalHost(hostname) && (hostname === rootDomain || hostname.endsWith(`.${rootDomain}`))

    if (onRootDomain) {
      return { url: `${protocol}//${slug}.${rootDomain}${portSuffix}`, isSubdomain: true }
    }

    return { url: `${protocol}//${hostname}${portSuffix}/e/${slug}`, isSubdomain: false }
  }

  return { buildEventUrl, rootDomain }
}
