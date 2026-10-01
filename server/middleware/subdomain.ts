/**
 * Sous-domaines dynamiques d'événements (§14-16 du cahier des charges).
 *
 * himra.tikeo.com/            → réécrit en interne vers /e/himra
 * himra.tikeo.com/quoi-que-ce-soit → laissé tel quel (seule la racine du
 *                                     sous-domaine sert de raccourci ; le
 *                                     reste du site continue de vivre sous
 *                                     tikeo.com/... comme prévu au §16
 *                                     "URL de secours").
 *
 * C'est une réécriture (rewrite), pas une redirection : l'utilisateur garde
 * "himra.tikeo.com" dans sa barre d'adresse, mais Nuxt sert en interne la
 * page /e/[slug].vue, exactement comme le décrit le cahier des charges
 * ("Le système reçoit himra.tikeo.com et identifie automatiquement
 * slug = himra puis recherche l'événement correspondant").
 *
 * Sous-domaines réservés : ils ne sont PAS des slugs d'événement et doivent
 * continuer à servir l'application normale (§51 : app./admin./api. pointent
 * vers le même déploiement Nuxt pour le MVP).
 */
const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'admin', 'api', 'dev', 'staging'])

export default defineEventHandler((event) => {
  const host = getRequestHost(event, { xForwardedHost: true })
  if (!host) return

  const hostname = host.split(':')[0].toLowerCase()
  const config = useRuntimeConfig()
  const rootDomain = (config.public.rootDomain || 'tikeo.com').toLowerCase()

  const label = extractEventSubdomain(hostname, rootDomain)
  if (!label || RESERVED_SUBDOMAINS.has(label)) return

  // On ne réécrit que la racine du sous-domaine : /?foo=bar reste géré,
  // mais /autre-chose n'est pas touché (voir commentaire ci-dessus).
  const url = event.node.req.url || '/'
  const [path, search] = url.split('?')
  if (path !== '/') return

  event.node.req.url = `/e/${encodeURIComponent(label)}${search ? `?${search}` : ''}`
})

/**
 * Extrait le premier label d'un hostname s'il s'agit bien d'un sous-domaine
 * de `rootDomain` (ex. "himra.tikeo.com" → "himra"). Retourne `null` pour le
 * domaine racine lui-même, pour "localhost" nu, ou pour tout hostname qui ne
 * termine pas par `rootDomain`.
 *
 * Astuce de test en développement local (pas de vrai DNS wildcard) :
 * `curl -H "Host: himra.localhost:3000" http://localhost:3000/`
 * ou ajouter une ligne dans /etc/hosts : `127.0.0.1 himra.localhost`.
 */
export function extractEventSubdomain(hostname: string, rootDomain: string): string | null {
  // Cas prod : *.tikeo.com
  if (hostname === rootDomain) return null
  if (hostname.endsWith(`.${rootDomain}`)) {
    return hostname.slice(0, -(rootDomain.length + 1))
  }

  // Cas dev local : *.localhost (pas de DNS wildcard nécessaire)
  if (hostname === 'localhost') return null
  if (hostname.endsWith('.localhost')) {
    return hostname.slice(0, -'.localhost'.length)
  }

  return null
}
