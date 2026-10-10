import type { SiteFeedbackPublic, SiteFeedbackStats } from '~/types/database'

export const FEEDBACK_CATEGORIES = ['praise', 'idea', 'bug', 'other'] as const

export const FEEDBACK_CATEGORY_ICONS: Record<string, string> = {
  praise: 'heart',
  idea: 'sparkles',
  bug: 'alert',
  other: 'help',
}

/** Avis publiés sur la plateforme + statistiques (page /avis et bandeau d'accueil). */
export function useSiteFeedbackWall() {
  const items = useState<SiteFeedbackPublic[]>('tikeo-feedback-items', () => [])
  const stats = useState<SiteFeedbackStats | null>('tikeo-feedback-stats', () => null)
  const loading = ref(false)

  async function fetchWall(limit = 60) {
    loading.value = true
    try {
      const supabase = useSupabase()
      const [{ data: rows }, { data: statRow }] = await Promise.all([
        supabase.from('site_feedback_public').select('*').order('created_at', { ascending: false }).limit(limit),
        supabase.from('site_feedback_stats').select('*').maybeSingle(),
      ])
      items.value = ((rows as any) ?? []) as SiteFeedbackPublic[]
      stats.value = (statRow as any) ?? null
    } catch {
      /* mur indisponible : la page reste utilisable (formulaire) */
    } finally {
      loading.value = false
    }
  }

  return { items, stats, loading, fetchWall }
}

/** Réponse de l'administration (message de contact ou avis) : envoie l'email et enregistre. */
export async function sendAdminReply(kind: 'message' | 'feedback', id: string, reply: string) {
  const supabase = useSupabase()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Session expirée, reconnectez-vous.')
  const { csrfHeader } = useCsrf()
  return await $fetch<{ success: boolean; emailSent: boolean; hasEmail: boolean; repliedAt: string }>('/api/admin/reply', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, ...(await csrfHeader()) },
    body: { kind, id, reply },
  })
}

/** Date relative courte (« il y a 3 h », « hier »...), locale du site. */
export function useRelativeTime() {
  const { locale } = useI18n()
  return (iso: string) => {
    const diff = (new Date(iso).getTime() - Date.now()) / 1000
    const rtf = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })
    const abs = Math.abs(diff)
    if (abs < 60) return rtf.format(Math.round(diff), 'second')
    if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
    if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day')
    return new Date(iso).toLocaleDateString(locale.value, { day: 'numeric', month: 'short', year: 'numeric' })
  }
}
