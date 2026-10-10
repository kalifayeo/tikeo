import { createClient } from '@supabase/supabase-js'
import type { H3Event } from 'h3'

/**
 * Identifie l'utilisateur connecté à partir du jeton d'accès Supabase envoyé
 * par le frontend : `Authorization: Bearer <access_token>`.
 *
 * L'identité vient TOUJOURS de la vérification du jeton par Supabase Auth,
 * jamais d'un identifiant envoyé dans le corps de la requête (cahier des
 * charges §64 : le frontend ne décide de rien).
 */
export async function requireUser(event: H3Event) {
  const authHeader = getHeader(event, 'authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '')

  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Authentification requise.', data: { code: 'SESSION_EXPIRED' } })
  }

  const config = useRuntimeConfig(event)
  const anonClient = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const {
    data: { user },
    error,
  } = await anonClient.auth.getUser(token)

  if (error || !user) {
    throw createError({ statusCode: 401, statusMessage: 'Session invalide.', data: { code: 'SESSION_EXPIRED' } })
  }

  // Un compte suspendu ou supprimé garde un jeton techniquement valide jusqu'à son
  // expiration (jusqu'à 1 h) : on relit donc le statut en base à chaque appel, pour
  // que la suspension soit effective immédiatement côté serveur.
  const { data: profile } = await useSupabaseAdmin().from('profiles').select('status').eq('user_id', user.id).maybeSingle()
  const status = (profile as { status?: string } | null)?.status
  if (status === 'suspended' || status === 'deleted') {
    throw createError({ statusCode: 403, statusMessage: 'Compte suspendu.', data: { code: 'ACCOUNT_LOCKED' } })
  }

  return { userId: user.id, email: user.email ?? null, token }
}
