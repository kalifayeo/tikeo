import type { EventReview, EventReviewStats } from '~/types/database'

async function authHeaders(): Promise<Record<string, string>> {
  const supabase = useSupabase()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

/** Avis visibles d'un événement + statistiques (page événement publique). */
export function useEventReviews(eventId: Ref<string | null | undefined>) {
  const reviews = ref<EventReview[]>([])
  const stats = ref<EventReviewStats | null>(null)
  const loading = ref(true)

  async function fetchReviews() {
    if (!eventId.value) {
      reviews.value = []
      loading.value = false
      return
    }
    loading.value = true
    try {
      const supabase = useSupabase()
      const [{ data: reviewRows }, { data: statRow }] = await Promise.all([
        supabase
          .from('event_reviews')
          .select('*, author:profiles(full_name, avatar_url)')
          .eq('event_id', eventId.value)
          .eq('status', 'visible')
          .order('created_at', { ascending: false }),
        supabase.from('event_review_stats').select('*').eq('event_id', eventId.value).maybeSingle(),
      ])
      reviews.value = (reviewRows as any) ?? []
      stats.value = (statRow as any) ?? { event_id: eventId.value, review_count: 0, average_rating: null }
    } finally {
      loading.value = false
    }
  }

  if (import.meta.client) {
    watch(eventId, () => fetchReviews(), { immediate: true })
  }

  return { reviews, stats, loading, fetchReviews }
}

/** Écriture de l'avis de l'acheteur connecté (peut-il noter ? poster ? modifier ? signaler ?). */
export function useMyEventReview(eventId: Ref<string | null | undefined>) {
  const { user } = useAuth()
  const myReview = ref<EventReview | null>(null)
  const canReview = ref(false)
  const loading = ref(true)
  const submitting = ref(false)
  const errorMessage = ref('')

  async function refresh() {
    if (!eventId.value || !user.value) {
      myReview.value = null
      canReview.value = false
      loading.value = false
      return
    }
    loading.value = true
    try {
      const supabase = useSupabase()
      const [{ data: existing }, { data: eligible }] = await Promise.all([
        supabase.from('event_reviews').select('*').eq('event_id', eventId.value).eq('user_id', user.value.id).maybeSingle(),
        supabase.rpc('can_review_event', { p_user_id: user.value.id, p_event_id: eventId.value }),
      ])
      myReview.value = (existing as any) ?? null
      canReview.value = !!eligible
    } finally {
      loading.value = false
    }
  }

  async function submit(rating: number, comment: string) {
    if (!eventId.value || !user.value) return false
    submitting.value = true
    errorMessage.value = ''
    try {
      const supabase = useSupabase()
      const payload = { event_id: eventId.value, user_id: user.value.id, rating, comment: comment.trim() || null }
      const { data, error } = myReview.value
        ? await supabase.from('event_reviews').update({ rating, comment: payload.comment }).eq('id', myReview.value.id).select().single()
        : await supabase.from('event_reviews').insert(payload).select().single()
      if (error) throw error
      myReview.value = data as any
      return true
    } catch (e: any) {
      errorMessage.value = e?.message?.includes('REVIEW_NOT_ELIGIBLE')
        ? "Vous devez avoir un billet pour cet événement, terminé, pour laisser un avis."
        : "Impossible d'enregistrer votre avis."
      return false
    } finally {
      submitting.value = false
    }
  }

  async function report(reviewId: string, reason: string) {
    const supabase = useSupabase()
    const { error } = await supabase.from('event_review_reports').insert({ review_id: reviewId, reported_by: user.value!.id, reason })
    return !error
  }

  if (import.meta.client) {
    watch([eventId, user], () => refresh(), { immediate: true })
  }

  return { myReview, canReview, loading, submitting, errorMessage, submit, report, refresh }
}

/** Réponse de l'organisateur à un avis (route serveur, RPC restreinte). */
export function useReviewOrganizerReply() {
  const submitting = ref(false)
  const errorCode = ref<string | null>(null)
  const { csrfHeader } = useCsrf()

  async function reply(reviewId: string, text: string | null) {
    submitting.value = true
    errorCode.value = null
    try {
      await $fetch(`/api/reviews/${reviewId}/reply`, {
        method: 'POST',
        headers: { ...(await authHeaders()), ...(await csrfHeader()) },
        body: { reply: text },
      })
      return true
    } catch (e: any) {
      errorCode.value = e?.data?.data?.code ?? 'REVIEW_REPLY_FAILED'
      return false
    } finally {
      submitting.value = false
    }
  }

  return { submitting, errorCode, reply }
}

/** Modération admin : masquer/réafficher un avis (direct via RLS, is_admin() contourne le verrou d'écriture). */
export function useAdminReviewModeration() {
  async function setStatus(reviewId: string, status: 'visible' | 'hidden', reason?: string) {
    const supabase = useSupabase()
    const { error } = await supabase.from('event_reviews').update({ status, hidden_reason: reason ?? null }).eq('id', reviewId)
    return !error
  }
  return { setStatus }
}
