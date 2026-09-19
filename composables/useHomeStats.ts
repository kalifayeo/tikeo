interface HomeStats {
  events: number
  organizers: number
  cities: number
  loaded: boolean
}

/**
 * Statistiques de confiance affichées sur la page d'accueil (section
 * "Pourquoi Tikeo"). 100% dynamique : calculées à partir des mêmes tables
 * que le reste du site, jamais de chiffres inventés en dur.
 */
export function useHomeStats() {
  const stats = useState<HomeStats>('tikeo-home-stats', () => ({
    events: 0,
    organizers: 0,
    cities: 0,
    loaded: false,
  }))

  async function fetchStats() {
    if (stats.value.loaded) return stats.value
    try {
      const supabase = useSupabase()
      const [eventsRes, organizersRes, cityRes] = await Promise.all([
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('organizers').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('events').select('city').eq('status', 'published'),
      ])

      const distinctCities = new Set(
        (cityRes.data ?? []).map((row: any) => (row.city || '').trim()).filter((c: string) => c.length > 0)
      )

      stats.value = {
        events: eventsRes.count ?? 0,
        organizers: organizersRes.count ?? 0,
        cities: distinctCities.size,
        loaded: true,
      }
    } catch {
      // La section dégrade proprement (elle reste masquée) si Supabase est indisponible.
    }
    return stats.value
  }

  if (import.meta.client) {
    onMounted(fetchStats)
  }

  return { stats, fetchStats }
}
