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
export async function requireAdmin(event: H3Event) {
  // Identité vérifiée par Supabase Auth (voir server/utils/userAuth.ts).
  const { userId } = await requireUser(event)

  const supabaseAdmin = useSupabaseAdmin()
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, full_name, user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (profileError || !profile || profile.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Accès réservé aux administrateurs.' })
  }

  return { adminUserId: userId, adminProfile: profile }
}
