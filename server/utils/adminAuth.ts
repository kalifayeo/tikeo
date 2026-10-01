import type { H3Event } from 'h3'
import { requireUser } from './userAuth'

/**
 * Vérifie que la requête porte bien le jeton d'accès Supabase d'un
 * utilisateur ayant le rôle "admin", avant d'autoriser une route serveur à
 * utiliser la clé service_role. Le frontend doit envoyer :
 *   Authorization: Bearer <access_token de la session Supabase>
 *
 * On ne fait jamais confiance à un simple "role" envoyé dans le body : le
 * rôle est relu depuis la base avec la clé service_role, jamais depuis une
 * valeur fournie par le client (cf. cahier des charges §64).
 */
/**
 * Décode (sans le vérifier — la signature l'a déjà été par Supabase Auth
 * dans requireUser) le corps d'un jeton d'accès JWT, pour y lire la
 * revendication `aal` (Authenticator Assurance Level : "aal1" = mot de passe
 * seul, "aal2" = double authentification passée).
 */
function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1]
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    return JSON.parse(json)
  } catch {
    return {}
  }
}

export async function requireAdmin(event: H3Event) {
  // Identité vérifiée par Supabase Auth (voir server/utils/userAuth.ts).
  const { userId, token } = await requireUser(event)

  const supabaseAdmin = useSupabaseAdmin()
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, full_name, user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (profileError || !profile || profile.role !== 'admin' || ['suspended', 'deleted'].includes((profile as any).status)) {
    throw createError({ statusCode: 403, statusMessage: 'Accès réservé aux administrateurs.' })
  }

  // Défense en profondeur : la double authentification est imposée côté
  // interface (middleware/admin.ts redirige vers /admin/securite tant
  // qu'elle n'est pas active), mais un appel direct à l'API contournerait
  // ce contrôle purement côté client. On exige donc ici aussi qu'un jeton
  // utilisé pour une route admin porte bien l'assurance "aal2".
  if (decodeJwtPayload(token).aal !== 'aal2') {
    throw createError({ statusCode: 403, statusMessage: 'MFA_REQUIRED', data: { code: 'MFA_REQUIRED' } })
  }

  return { adminUserId: userId, adminProfile: profile }
}

/**
 * Vérifie que l'admin porte la permission RBAC demandée (table
 * admin_user_roles / admin_role_permissions, migration 0021), en plus
 * d'être un administrateur actif. C'est la même règle qu'en RLS
 * (fonction SQL has_permission), rejouée ici côté serveur car les routes
 * serveur utilisent la clé service_role et contournent donc la RLS : sans
 * ce contrôle explicite, n'importe quel compte admin — même sans la bonne
 * permission — pourrait appeler ces routes.
 *
 * Ne jamais faire confiance à un rôle/une permission envoyé par le client :
 * on ne vérifie que ce qui est stocké en base pour adminUserId.
 */
export async function requirePermission(event: H3Event, permissionKey: string) {
  const { adminUserId, adminProfile } = await requireAdmin(event)

  const supabaseAdmin = useSupabaseAdmin()
  const { data: allowed, error } = await supabaseAdmin.rpc('has_permission_for', {
    p_user_id: adminUserId,
    p_permission_key: permissionKey,
  })

  if (error || !allowed) {
    throw createError({ statusCode: 403, statusMessage: `Permission requise : ${permissionKey}.` })
  }

  return { adminUserId, adminProfile }
}
