import { createClient } from '@supabase/supabase-js'
import type { H3Event } from 'h3'

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
  const authHeader = getHeader(event, 'authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '')

  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Authentification requise.' })
  }

  const config = useRuntimeConfig()
  const anonClient = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const {
    data: { user },
    error: userError,
  } = await anonClient.auth.getUser(token)

  if (userError || !user) {
    throw createError({ statusCode: 401, statusMessage: 'Session invalide.' })
  }

  const supabaseAdmin = useSupabaseAdmin()
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, full_name, user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError || !profile || profile.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Accès réservé aux administrateurs.' })
  }

  return { adminUserId: user.id, adminProfile: profile }
}
