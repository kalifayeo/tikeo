import type { EventCardData } from '~/types/database'

export type EventSortBy = 'relevance' | 'date_asc' | 'date_desc' | 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc'

export const EVENT_SORT_OPTIONS: { value: EventSortBy; labelKey: string }[] = [
  { value: 'relevance', labelKey: 'search.sortRelevance' },
  { value: 'date_asc', labelKey: 'search.sortDateAsc' },
  { value: 'date_desc', labelKey: 'search.sortDateDesc' },
  { value: 'name_asc', labelKey: 'search.sortNameAsc' },
  { value: 'name_desc', labelKey: 'search.sortNameDesc' },
  { value: 'price_asc', labelKey: 'search.sortPriceAsc' },
  { value: 'price_desc', labelKey: 'search.sortPriceDesc' },
]

function mapRow(e: any): EventCardData {
  const prices = (e.ticket_types ?? []).map((t: any) => Number(t.price)).filter((p: number) => !Number.isNaN(p))
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    city: e.city ?? '',
    country: e.country ?? '',
    startDate: e.start_date,
    coverImage: e.cover_image || '/sample-event.jpg',
    priceFrom: prices.length > 0 ? Math.min(...prices) : 0,
    category: e.category?.name,
    verified: e.organizer?.status === 'approved',
    organizerName: e.organizer?.name,
  }
}

const EVENT_SELECT = `id, slug, title, city, country, start_date, cover_image,
  category:categories(name),
  organizer:organizers(name, status),
  ticket_types(price)`

function sortResults(events: EventCardData[], sortBy: EventSortBy) {
  const list = [...events]
  switch (sortBy) {
    case 'date_asc':
      return list.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    case 'date_desc':
      return list.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    case 'name_asc':
      return list.sort((a, b) => a.title.localeCompare(b.title))
    case 'name_desc':
      return list.sort((a, b) => b.title.localeCompare(a.title))
    case 'price_asc':
      return list.sort((a, b) => a.priceFrom - b.priceFrom)
    case 'price_desc':
      return list.sort((a, b) => b.priceFrom - a.priceFrom)
    default:
      // "Pertinence" : événements les plus proches dans le temps d'abord
      return list.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
  }
}

/**
 * Recherche d'événements publiés par nom d'événement, ville, ou nom
 * d'organisateur/artiste (la table `events` n'a pas de colonne "artiste"
 * dédiée : le nom de l'artiste/organisateur vit dans `organizers.name`,
 * d'où la seconde requête ci-dessous pour aussi matcher sur ce champ).
 * Le volume d'événements restant modeste (cf. useEvents.ts), le tri est
 * appliqué côté client une fois les résultats récupérés.
 */
export function useEventSearch() {
  const results = ref<EventCardData[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function search(query: string, opts: { sortBy?: EventSortBy; limit?: number } = {}) {
    const { sortBy = 'relevance', limit = 30 } = opts
    const term = query.trim()
    loading.value = true
    error.value = null
    try {
      const supabase = useSupabase()
      let byTitleOrCity: any[] = []
      let byOrganizer: any[] = []

      if (term) {
        const [titleRes, organizerRes] = await Promise.all([
          supabase
            .from('events')
            .select(EVENT_SELECT)
            .eq('status', 'published')
            .or(`title.ilike.%${term}%,city.ilike.%${term}%,country.ilike.%${term}%`)
            .limit(limit),
          supabase.from('organizers').select('id').ilike('name', `%${term}%`),
        ])
        byTitleOrCity = titleRes.data ?? []

        const organizerIds = (organizerRes.data ?? []).map((o: any) => o.id)
        if (organizerIds.length > 0) {
          const byOrganizerRes = await supabase
            .from('events')
            .select(EVENT_SELECT)
            .eq('status', 'published')
            .in('organizer_id', organizerIds)
            .limit(limit)
          byOrganizer = byOrganizerRes.data ?? []
        }
      } else {
        const allRes = await supabase.from('events').select(EVENT_SELECT).eq('status', 'published').limit(limit)
        byTitleOrCity = allRes.data ?? []
      }

      const seen = new Set<string>()
      const merged: EventCardData[] = []
      for (const row of [...byTitleOrCity, ...byOrganizer]) {
        const mapped = mapRow(row)
        if (!seen.has(mapped.id)) {
          seen.add(mapped.id)
          merged.push(mapped)
        }
      }

      results.value = sortResults(merged, sortBy)
      return results.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur de recherche'
      results.value = []
      return []
    } finally {
      loading.value = false
    }
  }

  return { results, loading, error, search }
}
