export interface RevenuePoint {
  day: string
  orders_count: number
  revenue: number
}
export interface SignupPoint {
  day: string
  buyers: number
  organizers: number
}
export interface TopEvent {
  event_id: string
  title: string
  revenue: number
  tickets_sold: number
}

/**
 * Séries temporelles pour les graphiques du tableau de bord admin
 * (pages/admin/index.vue). Les fonctions SQL sont en SECURITY INVOKER
 * (migration 0035) : la RLS s'applique normalement, un compte non-admin
 * obtiendrait simplement des séries vides.
 */
export function useAdminAnalytics(days: Ref<number> | number = 30) {
  const daysRef = isRef(days) ? days : ref(days)
  const revenue = ref<RevenuePoint[]>([])
  const signups = ref<SignupPoint[]>([])
  const topEvents = ref<TopEvent[]>([])
  const loading = ref(true)
  const errorMessage = ref('')

  async function fetchAll() {
    loading.value = true
    errorMessage.value = ''
    try {
      const supabase = useSupabase()
      const [{ data: rev, error: e1 }, { data: sig, error: e2 }, { data: top, error: e3 }] = await Promise.all([
        supabase.rpc('admin_revenue_timeseries', { p_days: daysRef.value }),
        supabase.rpc('admin_signups_timeseries', { p_days: daysRef.value }),
        supabase.rpc('admin_top_events', { p_limit: 5 }),
      ])
      if (e1 || e2 || e3) throw e1 || e2 || e3
      revenue.value = (rev as RevenuePoint[]) ?? []
      signups.value = (sig as SignupPoint[]) ?? []
      topEvents.value = (top as TopEvent[]) ?? []
    } catch (e: any) {
      errorMessage.value = e?.message || 'Impossible de charger les statistiques.'
    } finally {
      loading.value = false
    }
  }

  const totalRevenue = computed(() => revenue.value.reduce((sum, p) => sum + Number(p.revenue), 0))
  const totalOrders = computed(() => revenue.value.reduce((sum, p) => sum + Number(p.orders_count), 0))
  const totalSignups = computed(() => signups.value.reduce((sum, p) => sum + Number(p.buyers) + Number(p.organizers), 0))

  if (import.meta.client) {
    watch(daysRef, () => fetchAll(), { immediate: true })
  }

  return { revenue, signups, topEvents, loading, errorMessage, totalRevenue, totalOrders, totalSignups, fetchAll }
}
