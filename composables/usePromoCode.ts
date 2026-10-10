import type { PromoCode } from '~/types/database'

export interface PromoPreview {
  valid: boolean
  code?: string
  discount_type?: 'percent' | 'fixed'
  discount_value?: number
  /** Présent seulement quand valid=false : 'PROMO_INVALID' | 'PROMO_EXPIRED' | 'PROMO_EXHAUSTED'. */
  error?: string
}

/**
 * Vérification en direct d'un code promo pour un événement, pendant que
 * l'acheteur choisit ses billets (page événement) — avant même de créer la
 * commande. Le code n'est VRAIMENT appliqué (et son quota décompté) que lors
 * de l'appel à create_order(), via le champ `promoCode` ; cette prévisualisation
 * ne réserve rien et peut être rappelée autant de fois que nécessaire.
 * Nécessite d'être connecté (la route serveur /api/promo/validate exige une session).
 */
export function usePromoPreview() {
  const checking = ref(false)
  const preview = ref<PromoPreview | null>(null)

  async function check(eventId: string, code: string) {
    if (!code.trim()) {
      preview.value = null
      return null
    }
    checking.value = true
    try {
      // Appel via le serveur (limité en nombre d'essais) : voir server/api/promo/validate.post.ts
      const supabase = useSupabase()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const { csrfHeader } = useCsrf()
      try {
        const data = await $fetch<PromoPreview>('/api/promo/validate', {
          method: 'POST',
          headers: {
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
            ...(await csrfHeader()),
          },
          body: { eventId, code: code.trim().toUpperCase() },
        })
        preview.value = data ?? { valid: false }
      } catch {
        preview.value = { valid: false, error: 'PROMO_INVALID' }
      }
      return preview.value
    } finally {
      checking.value = false
    }
  }

  function clear() {
    preview.value = null
  }

  return { checking, preview, check, clear }
}

/**
 * Codes promo d'un événement (page organisateur). Chaque code est rattaché à
 * UN événement précis (colonne `event_id` non nulle, migration 0029) — pour
 * un code valable sur plusieurs événements, il faut en créer un par événement.
 * Lecture/écriture directes via Supabase : la RLS ("Organisateur gère les
 * codes de ses événements") restreint déjà tout aux événements de l'organisateur.
 */
export function useEventPromoCodes(eventId: Ref<string | null | undefined>) {
  const codes = ref<PromoCode[]>([])
  const loading = ref(true)
  const errorMessage = ref('')

  async function fetchCodes() {
    if (!eventId.value) {
      codes.value = []
      loading.value = false
      return
    }
    loading.value = true
    errorMessage.value = ''
    try {
      const supabase = useSupabase()
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('event_id', eventId.value)
        .order('created_at', { ascending: false })
      if (error) throw error
      codes.value = (data as unknown as PromoCode[]) ?? []
    } catch (e: any) {
      errorMessage.value = e?.message || 'Impossible de charger les codes promo.'
    } finally {
      loading.value = false
    }
  }

  async function createCode(input: {
    code: string
    discountType: 'percent' | 'fixed'
    discountValue: number
    maxUses?: number | null
    maxUsesPerBuyer?: number
    startsAt?: string | null
    endsAt?: string | null
  }) {
    if (!eventId.value) return { ok: false, message: 'Événement introuvable.' }
    const supabase = useSupabase()
    const { error } = await supabase.from('promo_codes').insert({
      event_id: eventId.value,
      code: input.code.trim().toUpperCase(),
      discount_type: input.discountType,
      discount_value: input.discountValue,
      max_uses: input.maxUses ?? null,
      max_uses_per_buyer: input.maxUsesPerBuyer ?? 1,
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
    })
    if (error) return { ok: false, message: translatePromoError(error.message) }
    await fetchCodes()
    return { ok: true, message: '' }
  }

  async function toggleStatus(id: string, status: 'active' | 'inactive') {
    const supabase = useSupabase()
    const { error } = await supabase.from('promo_codes').update({ status }).eq('id', id)
    if (!error) await fetchCodes()
    return !error
  }

  async function removeCode(id: string) {
    const supabase = useSupabase()
    const { error } = await supabase.from('promo_codes').delete().eq('id', id)
    if (!error) codes.value = codes.value.filter((c) => c.id !== id)
    return { ok: !error, message: error ? translatePromoError(error.message) : '' }
  }

  if (import.meta.client) {
    watch(eventId, () => fetchCodes(), { immediate: true })
  }

  return { codes, loading, errorMessage, fetchCodes, createCode, toggleStatus, removeCode }
}

/**
 * Tous les codes promo de l'organisateur, tous événements confondus (vue
 * d'ensemble de la page organisateur/codes-promo). Jointure via `events` :
 * la RLS limite déjà le résultat aux événements de l'organisateur connecté.
 */
export function useOrganizerPromoCodesOverview() {
  const { user } = useAuth()
  const codes = ref<(PromoCode & { event?: { id: string; title: string } })[]>([])
  const loading = ref(true)

  async function fetchAll() {
    loading.value = true
    try {
      const supabase = useSupabase()
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*, event:events(id, title)')
        .order('created_at', { ascending: false })
      if (!error) codes.value = (data as any) ?? []
    } finally {
      loading.value = false
    }
  }

  if (import.meta.client) {
    watch(user, (u) => (u ? fetchAll() : (codes.value = [])), { immediate: true })
  }

  return { codes, loading, fetchAll }
}

function translatePromoError(message: string): string {
  if (message.includes('promo_codes_event_id_code_key') || message.includes('duplicate key')) {
    return 'Ce code existe déjà pour cet événement.'
  }
  return 'Une erreur est survenue.'
}
