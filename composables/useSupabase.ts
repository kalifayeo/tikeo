import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database'

/**
 * Accès centralisé au client Supabase.
 * Utilisation : const supabase = useSupabase()
 */
export function useSupabase(): SupabaseClient<Database> {
  const { $supabase } = useNuxtApp()
  return $supabase as SupabaseClient<Database>
}
