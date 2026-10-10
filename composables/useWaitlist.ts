import type { WaitlistEntry } from '~/types/database'

async function authHeaders(): Promise<Record<string, string>> {
  const supabase = useSupabase()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

/** Rejoindre/quitter la liste d'attente d'un type de billet épuisé (page événement). */
export function useWaitlistJoin() {
  const submitting = ref(false)
  const errorCode = ref<string | null>(null)
  const { csrfHeader } = useCsrf()

  async function join(ticketTypeId: string, quantity = 1) {
    submitting.value = true
    errorCode.value = null
    try {
      const res = await $fetch<{ entry: { id: string; position: number; quantity: number } }>('/api/waitlist/join', {
        method: 'POST',
        headers: { ...(await authHeaders()), ...(await csrfHeader()) },
        body: { ticketTypeId, quantity },
      })
      return res.entry
    } catch (e: any) {
      errorCode.value = e?.data?.data?.code ?? 'WAITLIST_JOIN_FAILED'
      return null
    } finally {
      submitting.value = false
    }
  }

  return { submitting, errorCode, join }
}

/**
 * Mes inscriptions à des listes d'attente (mon-espace). Se désinscrire passe
 * directement par Supabase : la policy "Liste d'attente : je me désinscris"
 * (migration 0031) autorise l'acheteur à faire passer sa propre ligne à
 * "cancelled", ce qui réveille automatiquement la personne suivante.
 */
export function useMyWaitlistEntries() {
  const { user } = useAuth()
  const entries = ref<WaitlistEntry[]>([])
  const loading = ref(true)
  const errorMessage = ref('')

  async function fetchEntries() {
    if (!user.value) {
      entries.value = []
      loading.value = false
      return
    }
    loading.value = true
    errorMessage.value = ''
    try {
      const supabase = useSupabase()
      const { data, error } = await supabase
        .from('waitlist_entries')
        .select('*, ticket_type:ticket_types(id, name, price), event:events(id, title, slug, cover_image, start_date)')
        .eq('user_id', user.value.id)
        .in('status', ['waiting', 'notified'])
        .order('created_at', { ascending: false })
      if (error) throw error
      entries.value = (data as unknown as WaitlistEntry[]) ?? []
    } catch (e: any) {
      errorMessage.value = e?.message || "Impossible de charger vos listes d'attente."
    } finally {
      loading.value = false
    }
  }

  async function leave(entryId: string) {
    const supabase = useSupabase()
    const { error } = await supabase.from('waitlist_entries').update({ status: 'cancelled' }).eq('id', entryId)
    if (!error) entries.value = entries.value.filter((e) => e.id !== entryId)
    return !error
  }

  if (import.meta.client) {
    watch(user, (u) => (u ? fetchEntries() : (entries.value = [])), { immediate: true })
  }

  return { entries, loading, errorMessage, fetchEntries, leave }
}

/**
 * Nombre de personnes en attente pour un type de billet donné (affiché sur la
 * page événement à côté du bouton "Rejoindre la liste d'attente"). Passe par
 * la fonction SQL waitlist_count() (migration 0036) : un visiteur ne peut pas
 * lire les lignes de waitlist_entries (RLS), seulement ce total agrégé.
 */
export async function fetchWaitlistCount(ticketTypeId: string): Promise<number> {
  const supabase = useSupabase()
  const { data, error } = await supabase.rpc('waitlist_count', { p_ticket_type_id: ticketTypeId })
  if (error) return 0
  return Number(data) || 0
}
