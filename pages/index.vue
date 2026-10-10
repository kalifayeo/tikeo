<script setup lang="ts">
import type { EventCardData } from '~/types/database'
import { HOME_FILTERS_PRICE_MAX } from '~/composables/useHomeFilters'

const { t } = useI18n()
const { events, loading } = useEventsList()
const { filters, matchesDateRange, resetFilters, activeFilterCount, setCategory } = useHomeFilters()
const { categories: categoryList } = useCategoriesList()
const dateOptions = useHomeDateRangeOptions()
const sortOptions = dateOptions

const homeTitle = 'Tikeo - La billetterie simple et intelligente pour vos événements'
const homeDescription =
  "Découvrez, achetez et gérez vos billets d'événements en Côte d'Ivoire : concerts, festivals, conférences et bien plus."
useSeoMeta({
  title: homeTitle,
  description: homeDescription,
  ogTitle: homeTitle,
  ogDescription: homeDescription,
})

// Filtrage 100% client (le volume d'événements reste modeste, cf useEventsList
// qui charge déjà jusqu'à 40 événements publiés) : catégorie, ville, période
// et prix maximum se combinent, tous branchés sur le même état partagé
// (useHomeFilters) utilisé par la barre de catégories, la recherche rapide,
// les filtres latéraux et le tiroir mobile.
const filteredEvents = computed(() => {
  return events.value.filter((event) => {
    if (filters.value.category && event.category !== filters.value.category) return false
    if (filters.value.city && event.city !== filters.value.city) return false
    if (!matchesDateRange(event.startDate, filters.value.date)) return false
    if (event.priceFrom > filters.value.priceMax) return false
    return true
  })
})

const hasAnyEvents = computed(() => events.value.length > 0)
const hasResults = computed(() => filteredEvents.value.length > 0)

// --- Structure de l'accueil ---------------------------------------------
// Sans filtre : 1) « Prochainement » (les événements les plus proches, avec
// une grande affiche), puis 2) une section par catégorie.
// Dès qu'un filtre est posé : une grille de résultats unique.
interface CategoryGroup {
  key: string
  name: string
  events: EventCardData[]
}
const groupedByCategory = computed<CategoryGroup[]>(() => {
  const groups = new Map<string, CategoryGroup>()
  for (const event of events.value) {
    const name = event.category || t('home.otherCategory')
    const key = name.toLowerCase()
    if (!groups.has(key)) groups.set(key, { key, name, events: [] })
    groups.get(key)!.events.push(event)
  }

  // Ordre = celui configuré par l'admin (/admin/categories, colonne
  // "position"). Les événements sans catégorie sont toujours en dernier.
  const orderIndex = new Map(categoryList.value.map((c, i) => [c.name.toLowerCase(), i]))
  const otherKey = t('home.otherCategory').toLowerCase()

  return Array.from(groups.values()).sort((a, b) => {
    if (a.key === otherKey) return 1
    if (b.key === otherKey) return -1
    const ia = orderIndex.has(a.key) ? orderIndex.get(a.key)! : Number.MAX_SAFE_INTEGER
    const ib = orderIndex.has(b.key) ? orderIndex.get(b.key)! : Number.MAX_SAFE_INTEGER
    return ia - ib
  })
})
const showCategorySections = computed(() => activeFilterCount.value === 0)

// Mosaïque « Prochainement » : 1 grande affiche + 2 ou 4 vignettes (jamais de
// case vide). En dessous de 3 événements, la mosaïque n'a pas de sens : on
// laisse les sections par catégorie parler.
const upcoming = computed(() => {
  const sorted = [...events.value].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
  if (sorted.length >= 5) return sorted.slice(0, 5)
  if (sorted.length >= 3) return sorted.slice(0, 3)
  return []
})
const upcomingRest = computed(() => upcoming.value.slice(1))

// Pastilles des filtres actifs (cliquer = retirer ce filtre).
const activeChips = computed(() => {
  const chips: { key: string; label: string; remove: () => void }[] = []
  if (filters.value.category) chips.push({ key: 'category', label: filters.value.category, remove: () => setCategory(null) })
  if (filters.value.city) chips.push({ key: 'city', label: filters.value.city, remove: () => (filters.value = { ...filters.value, city: null }) })
  if (filters.value.date !== 'all') {
    const label = dateOptions.value.find((o) => o.value === filters.value.date)?.label ?? ''
    chips.push({ key: 'date', label, remove: () => (filters.value = { ...filters.value, date: 'all' }) })
  }
  if (filters.value.priceMax < HOME_FILTERS_PRICE_MAX) {
    chips.push({
      key: 'price',
      label: `≤ ${filters.value.priceMax.toLocaleString('fr-FR')} FCFA`,
      remove: () => (filters.value = { ...filters.value, priceMax: HOME_FILTERS_PRICE_MAX }),
    })
  }
  return chips
})

const rowRefs = ref<Record<string, HTMLElement | null>>({})
function setRowRef(key: string, el: unknown) {
  rowRefs.value[key] = (el as HTMLElement) ?? null
}
function scrollRow(key: string, dir: 1 | -1) {
  rowRefs.value[key]?.scrollBy({ left: dir * 360, behavior: 'smooth' })
}

function seeAllCategory(name: string) {
  setCategory(name)
}
</script>

<template>
  <div class="pb-6">
    <HeroSection />

    <CategoriesRow />

    <QuickActionsGrid />

    <!-- ======================= SANS FILTRE ======================= -->
    <template v-if="showCategorySections">
      <!-- Chargement -->
      <section v-if="loading" class="mx-auto max-w-tikeo-container px-4 pt-10 md:px-6">
        <div class="mb-5 h-8 w-56 animate-pulse bg-tikeo-border" />
        <div class="no-scrollbar flex gap-3 overflow-x-auto md:gap-5">
          <div v-for="i in 4" :key="i" class="h-72 w-[72vw] max-w-[260px] shrink-0 animate-pulse bg-tikeo-border md:w-[17rem]" />
        </div>
      </section>

      <!-- Aucun événement -->
      <section v-else-if="!hasAnyEvents" data-events-anchor class="mx-auto max-w-tikeo-container px-4 py-12 md:px-6">
        <p class="border border-dashed border-tikeo-border bg-tikeo-surface p-10 text-center text-sm text-tikeo-gray-text">
          {{ t('home.noEventsYet') }}
        </p>
      </section>

      <template v-else>
        <!-- Prochainement : la grande affiche + les vignettes -->
        <section v-if="upcoming.length" data-events-anchor class="mx-auto max-w-tikeo-container px-4 pt-10 md:px-6 md:pt-14">
          <div class="mb-5 max-w-xl">
            <h2 class="font-display text-2xl font-extrabold tracking-tight text-tikeo-black md:text-4xl">{{ t('home.upcoming') }}</h2>
            <p class="mt-1.5 text-sm text-tikeo-gray-text md:text-base">{{ t('home.upcomingSub') }}</p>
          </div>

          <div
            class="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:gap-5 lg:mx-0 lg:grid lg:h-[41rem] lg:grid-rows-2 lg:overflow-visible lg:px-0"
            :class="upcomingRest.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'"
          >
            <EventCard :event="upcoming[0]" variant="feature" class="w-[86vw] max-w-[420px] snap-start lg:col-span-2 lg:row-span-2 lg:w-auto lg:max-w-none" />
            <EventCard v-for="event in upcomingRest" :key="event.id" :event="event" variant="tile" class="snap-start" />
          </div>
        </section>

        <!-- Une section par catégorie -->
        <section v-for="group in groupedByCategory" :key="group.key" data-events-anchor class="mx-auto max-w-tikeo-container px-4 pt-12 md:px-6 md:pt-16">
          <div class="mb-5 flex items-end justify-between gap-4">
            <div class="min-w-0">
              <h2 class="font-display text-2xl font-extrabold tracking-tight text-tikeo-black md:text-3xl">{{ group.name }}</h2>
              <p class="mt-1 text-sm text-tikeo-gray-text">{{ t('home.eventsCount', group.events.length) }}</p>
            </div>

            <div class="flex shrink-0 items-center gap-2">
              <template v-if="group.events.length > 4">
                <button
                  type="button"
                  :aria-label="t('home.scrollPrev')"
                  class="hidden h-10 w-10 items-center justify-center border border-tikeo-border bg-tikeo-surface text-tikeo-black transition-colors hover:border-tikeo-ink hover:bg-tikeo-ink hover:text-white md:flex"
                  @click="scrollRow(group.key, -1)"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" stroke-linejoin="round" d="M15 5l-7 7 7 7" /></svg>
                </button>
                <button
                  type="button"
                  :aria-label="t('home.scrollNext')"
                  class="hidden h-10 w-10 items-center justify-center border border-tikeo-border bg-tikeo-surface text-tikeo-black transition-colors hover:border-tikeo-ink hover:bg-tikeo-ink hover:text-white md:flex"
                  @click="scrollRow(group.key, 1)"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </template>
              <NuxtLink
                to="/evenements"
                class="flex h-10 items-center gap-1.5 px-1 text-sm font-bold text-tikeo-black underline decoration-tikeo-orange decoration-2 underline-offset-[6px] hover:text-tikeo-orange md:px-3"
                @click="seeAllCategory(group.name)"
              >
                {{ t('home.seeAll') }}
              </NuxtLink>
            </div>
          </div>

          <div :ref="(el) => setRowRef(group.key, el)" class="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:gap-5 md:px-0 md:pb-3">
            <EventCard v-for="event in group.events" :key="event.id" :event="event" variant="full" class="snap-start md:!w-[17rem]" />
          </div>
        </section>
      </template>
    </template>

    <!-- ======================= AVEC FILTRE ======================= -->
    <template v-else>
      <!-- Mobile -->
      <section class="mx-auto max-w-tikeo-container px-4 pt-6 md:hidden">
        <div data-events-anchor class="mb-3 flex items-center justify-between gap-2">
          <MobileFiltersDrawer />
          <p class="shrink-0 text-sm font-semibold text-tikeo-black">{{ t('home.eventsCount', filteredEvents.length) }}</p>
        </div>

        <div v-if="activeChips.length" class="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
          <button v-for="chip in activeChips" :key="chip.key" type="button" class="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-tikeo-ink pl-3.5 pr-2.5 text-[13px] font-semibold text-white dark:bg-tikeo-orange dark:text-tikeo-ink" @click="chip.remove">
            {{ chip.label }}
            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.6"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div v-if="!hasResults" class="border border-dashed border-tikeo-border bg-tikeo-surface p-6 text-center text-sm text-tikeo-gray-text">
          {{ t('home.noResultsFilters') }}
          <button type="button" class="mt-2 block w-full font-bold text-tikeo-orange" @click="resetFilters">{{ t('home.resetFilters') }}</button>
        </div>
        <div v-else class="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
          <EventCard v-for="event in filteredEvents" :key="event.id" :event="event" variant="grid" />
        </div>
      </section>

      <!-- Desktop : grille + filtres latéraux -->
      <section data-events-anchor class="mx-auto hidden max-w-tikeo-container gap-8 px-6 pt-10 md:grid md:grid-cols-[1fr_300px]">
        <div>
          <div class="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 class="font-display text-3xl font-extrabold tracking-tight text-tikeo-black">{{ t('home.discover') }}</h2>
              <p class="mt-1 text-sm text-tikeo-gray-text">{{ t('home.eventsCount', filteredEvents.length) }}</p>
            </div>
            <select v-model="filters.date" class="input-field w-auto text-sm" :aria-label="t('filters.date')">
              <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>

          <div v-if="activeChips.length" class="mb-6 flex flex-wrap gap-2">
            <button v-for="chip in activeChips" :key="chip.key" type="button" class="flex h-9 items-center gap-1.5 rounded-full bg-tikeo-ink pl-3.5 pr-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-85 dark:bg-tikeo-orange dark:text-tikeo-ink" @click="chip.remove">
              {{ chip.label }}
              <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.6"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>

          <div v-if="!hasResults" class="border border-dashed border-tikeo-border bg-tikeo-surface p-10 text-center text-sm text-tikeo-gray-text">
            {{ t('home.noResultsFiltersCount', activeFilterCount) }}
            <button type="button" class="mt-2 block w-full font-bold text-tikeo-orange" @click="resetFilters">{{ t('home.resetFilters') }}</button>
          </div>
          <div v-else class="grid grid-cols-2 gap-5 lg:grid-cols-3 2xl:grid-cols-4">
            <EventCard v-for="event in filteredEvents" :key="event.id" :event="event" variant="grid" />
          </div>
        </div>

        <SidebarFilters />
      </section>
    </template>

    <CityExplorer :events="events" />
    <TrustStats />
    <PartnersSection />
    <SiteFeedbackStrip />
    <OrganizerCtaBanner />
  </div>
</template>
