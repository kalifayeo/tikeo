import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database'

let client: SupabaseClient<Database> | null = null

/**
 * Client Supabase avec la clé service_role.
 * NE JAMAIS importer ce fichier depuis du code exécuté côté client :
 * il doit rester exclusivement sous server/.
 */
export function useSupabaseAdmin(): SupabaseClient<Database> {
  if (client) return client

  const config = useRuntimeConfig()

  if (!config.public.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Supabase (service role) mal configuré côté serveur.',
    })
  }

  client = createClient<Database>(config.public.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return client
}
