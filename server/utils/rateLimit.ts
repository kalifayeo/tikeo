import type { H3Event } from 'h3'

/**
 * Limiteur de débit anti-abus par IP, pour les endpoints publics ou
 * sensibles (formulaire de contact, création de commande, demande de
 * suppression de compte, etc.).
 *
 * Le compteur est stocké dans Postgres (fonction check_rate_limit, voir
 * migration 0023_shared_rate_limit.sql) plutôt qu'en mémoire du processus
 * Node : ainsi la limite reste correcte même quand plusieurs instances du
 * serveur tournent en parallèle (ce qui arrive justement pendant un pic de
 * trafic — c'est précisément le cas qu'un compteur en mémoire gérait mal,
 * chaque instance ayant son propre compteur).
 *
 * Signature et comportement inchangés pour les appelants existants (mêmes
 * options { key, max, windowMs }, même erreur 429 en cas de dépassement) :
 * seul le stockage du compteur a changé.
 */
export async function checkRateLimit(event: H3Event, opts: { key: string; max: number; windowMs: number }) {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const bucketKey = `${opts.key}:${ip}`
  const windowSeconds = Math.max(1, Math.round(opts.windowMs / 1000))

  const supabaseAdmin = useSupabaseAdmin()
  const { data: count, error } = await supabaseAdmin.rpc('check_rate_limit', {
    p_key: bucketKey,
    p_window_seconds: windowSeconds,
  })

  if (error) {
    // Panne infra (migration pas encore appliquée, base momentanément
    // injoignable...) : on choisit de laisser passer la requête plutôt que
    // de bloquer tout le monde à cause d'un souci d'anti-abus. La vraie
    // protection contre les actions sensibles reste CSRF + authentification
    // + les contrôles métier (ex. create_order en base) ; cette limite n'est
    // qu'une couche supplémentaire de confort.
    console.error('[rateLimit] check_rate_limit indisponible, on laisse passer :', error.message)
    return
  }

  if (typeof count === 'number' && count > opts.max) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Trop de tentatives. Merci de patienter quelques minutes avant de réessayer.',
    })
  }
}
