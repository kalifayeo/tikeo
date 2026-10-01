/**
 * Origine « canonique » du site, utilisée pour les URL absolues des balises
 * SEO (canonical, og:image, og:url).
 *
 * - Sur le domaine racine ou l'un de ses sous-domaines (himra.tikeo.com,
 *   app.tikeo.com…) : toujours https://tikeo.com — un seul domaine indexé,
 *   pas de contenu dupliqué entre tikeo.com/e/himra et himra.tikeo.com.
 * - Ailleurs (tikeo.vercel.app, localhost, previews) : l'origine courante,
 *   pour ne jamais pointer vers un domaine qui n'est pas encore branché.
 */
export function useSiteOrigin() {
  const config = useRuntimeConfig()
  const rootDomain = String(config.public.rootDomain || 'tikeo.com').toLowerCase()
  const url = useRequestURL()
  const host = url.hostname.toLowerCase()
  const onRootDomain = host === rootDomain || host.endsWith(`.${rootDomain}`)
  return onRootDomain ? `${url.protocol}//${rootDomain}` : url.origin
}

/** Rend absolue une URL d'image (ex. "/sample-event.jpg") pour og:image. */
export function toAbsoluteUrl(pathOrUrl: string | null | undefined, origin: string): string | undefined {
  if (!pathOrUrl) return undefined
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  return `${origin}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`
}
