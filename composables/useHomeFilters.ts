export type HomeDateRange = 'all' | 'today' | 'weekend' | 'week' | 'month'

export interface HomeFiltersState {
  category: string | null
  city: string | null
  date: HomeDateRange
  priceMax: number
}

export const HOME_FILTERS_PRICE_MAX = 500000

/**
 * Libellés des périodes, traduits et réactifs au changement de langue.
 * Remplace les 3 tableaux hardcodés en français qui existaient auparavant
 * (page d'accueil, FiltersPanel, et cette constante elle-même) : un seul
 * point de vérité, partagé par tous les sélecteurs de date de la home.
 */
export function useHomeDateRangeOptions() {
  const { t } = useI18n()
  return computed<{ value: HomeDateRange; label: string }[]>(() => [
    { value: 'all', label: t('filters.dateAll') },
    { value: 'today', label: t('filters.dateToday') },
    { value: 'weekend', label: t('filters.dateWeekend') },
    { value: 'week', label: t('filters.dateWeek') },
    { value: 'month', label: t('filters.dateMonth') },
  ])
}

function defaultFilters(): HomeFiltersState {
  return { category: null, city: null, date: 'all', priceMax: HOME_FILTERS_PRICE_MAX }
}

/**
 * État de filtrage partagé entre la barre de catégories, le panneau de
 * filtres (desktop) et le tiroir de filtres (mobile) de la page d'accueil.
 * Un seul `useState` = tous les composants restent synchronisés sans props
 * ni évènements à faire remonter.
 */
export function useHomeFilters() {
  const filters = useState<HomeFiltersState>('tikeo-home-filters', defaultFilters)

  const activeFilterCount = computed(() => {
    let n = 0
    if (filters.value.category) n++
    if (filters.value.city) n++
    if (filters.value.date !== 'all') n++
    if (filters.value.priceMax < HOME_FILTERS_PRICE_MAX) n++
    return n
  })

  function resetFilters() {
    filters.value = defaultFilters()
  }

  function setCategory(category: string | null) {
    filters.value = { ...filters.value, category: filters.value.category === category ? null : category }
  }

  function setCity(city: string | null) {
    filters.value = { ...filters.value, city }
  }

  /** Un événement démarrant à `startDate` tombe-t-il dans la période `range` ? */
  function matchesDateRange(startDate: string, range: HomeDateRange): boolean {
    if (range === 'all') return true
    const d = new Date(startDate)
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    if (range === 'today') {
      const endOfToday = new Date(startOfToday)
      endOfToday.setDate(endOfToday.getDate() + 1)
      return d >= startOfToday && d < endOfToday
    }
    if (range === 'weekend') {
      const day = startOfToday.getDay() // 0 = dimanche ... 6 = samedi
      const daysUntilSaturday = (6 - day + 7) % 7
      const saturday = new Date(startOfToday)
      saturday.setDate(saturday.getDate() + daysUntilSaturday)
      const mondayAfter = new Date(saturday)
      mondayAfter.setDate(mondayAfter.getDate() + 2)
      return d >= saturday && d < mondayAfter
    }
    if (range === 'week') {
      const endOfWeek = new Date(startOfToday)
      endOfWeek.setDate(endOfWeek.getDate() + 7)
      return d >= startOfToday && d < endOfWeek
    }
    if (range === 'month') {
      const endOfMonth = new Date(startOfToday)
      endOfMonth.setDate(endOfMonth.getDate() + 30)
      return d >= startOfToday && d < endOfMonth
    }
    return true
  }

  return { filters, activeFilterCount, resetFilters, setCategory, setCity, matchesDateRange }
}
