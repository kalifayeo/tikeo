<script setup lang="ts">
import type { EventCardData } from '~/types/database'

const { t } = useI18n()
const { events, loading } = useEventsList()
const { filters, matchesDateRange, resetFilters, activeFilterCount, setCategory } = useHomeFilters()
const { categories: categoryList } = useCategoriesList()
const sortOptions = useHomeDateRangeOptions()

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
// (useHomeFilters) utilisé par CategoriesRow, SidebarFilters et le tiroir mobile.
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

// --- Page d'accueil organisée par catégorie (comme Tikerama) ---
// Tant qu'aucun filtre explicite n'est actif, on regroupe les événements par
// catégorie (une section par catégorie, dans l'ordre de première apparition)
// plutôt que d'afficher une grille unique. Dès qu'un filtre est posé
// (catégorie, ville, date, prix), on repasse sur la grille filtrée classique.
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
  // "position"), pas l'ordre de première apparition dans les données :
  // sinon la section affichée en premier dépendait du hasard de l'ordre de
  // création des événements plutôt que d'un choix éditorial. Les
  // événements sans catégorie ("Autres événements") sont toujours en
  // dernier, quelle que soit leur position dans categoryList.
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

const rowRefs = ref<Record<string, HTMLElement | null>>({})
function setRowRef(key: string, el: unknown) {
  rowRefs.value[key] = (el as HTMLElement) ?? null
}
function scrollRow(key: string, dir: 1 | -1) {
  rowRefs.value[key]?.scrollBy({ left: dir * 320, behavior: 'smooth' })
}

function seeAllCategory(name: string) {
  setCategory(name)
}
</script>

<template>
  <div>
    <HeroSection />

    <!-- Catégories juste après les images de la bannière (comme Tikerama) -->
    <CategoriesRow class="mt-3 md:mt-5" />

    <QuickActionsGrid />

    <!-- Page d'accueil organisée par catégorie : une section par catégorie -->
    <template v-if="showCategorySections">
      <section v-if="loading" class="mx-auto max-w-tikeo-container px-4 pt-3 md:px-6">
        <div class="mb-3 h-5 w-40 animate-pulse bg-tikeo-surface-alt" />
        <div class="no-scrollbar flex gap-2.5 overflow-x-auto pb-1 md:gap-4">
          <div v-for="i in 4" :key="i" class="h-52 w-[68vw] max-w-[240px] shrink-0 animate-pulse border border-tikeo-border bg-tikeo-surface-alt md:h-64 md:w-56" />
        </div>
      </section>

      <section v-else-if="!hasAnyEvents" data-events-anchor class="mx-auto max-w-tikeo-container px-4 py-10 md:px-6">
        <p class="border border-dashed border-tikeo-border p-10 text-center text-sm text-tikeo-gray-text">
          {{ t('home.noEventsYet') }}
        </p>
      </section>

      <template v-else>
        <section
          v-for="group in groupedByCategory"
          :key="group.key"
          v-reveal
          data-events-anchor
          class="mx-auto max-w-tikeo-container px-4 pt-5 md:px-6"
        >
          <div class="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 class="text-lg font-semibold text-tikeo-black">{{ group.name }}</h2>
              <p class="text-xs text-tikeo-gray-text">{{ t('home.mostPopular') }}</p>
            </div>
            <NuxtLink
              to="/evenements"
              class="flex shrink-0 items-center gap-1 bg-tikeo-orange px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-tikeo-orange-dark transition-colors duration-200"
              @click="seeAllCategory(group.name)"
            >
              {{ t('home.seeAll') }}
              <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
            </NuxtLink>
          </div>

          <div class="relative">
            <div :ref="(el) => setRowRef(group.key, el)" class="no-scrollbar flex gap-2.5 overflow-x-auto pb-1 md:gap-4 md:scroll-smooth">
              <EventCard
                v-for="event in group.events"
                :key="event.id"
                :event="event"
                variant="full"
                class="md:!w-56 md:shrink-0"
              />
            </div>
            <button
              v-if="group.events.length > 4"
              type="button"
              :aria-label="t('home.seeMore')"
              class="absolute -right-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center bg-tikeo-surface text-tikeo-black shadow-card hover:text-tikeo-orange md:flex"
              @click="scrollRow(group.key, 1)"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </section>
      </template>
    </template>

    <!-- Résultats filtrés : dès qu'un filtre (catégorie, ville, date, prix) est actif -->
    <template v-else>
      <!-- Bloc mobile : carrousel de cartes pleine largeur -->
      <section class="mx-auto max-w-tikeo-container px-4 pt-3 md:hidden">
        <div data-events-anchor class="mb-3 flex items-center justify-between gap-2">
          <MobileFiltersDrawer />
          <p class="shrink-0 text-xs text-tikeo-gray-text">{{ t('home.eventsCount', filteredEvents.length) }}</p>
        </div>
        <p v-if="!hasResults" class="border border-dashed border-tikeo-border p-6 text-center text-sm text-tikeo-gray-text">
          {{ t('home.noResultsFilters') }}
          <button type="button" class="block w-full font-semibold text-tikeo-orange" @click="resetFilters">{{ t('home.resetFilters') }}</button>
        </p>
        <div v-else class="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
          <EventCard v-for="event in filteredEvents" :key="event.id" :event="event" variant="full" />
        </div>
      </section>

      <!-- Bloc desktop : grille d'événements + sidebar -->
      <section data-events-anchor class="mx-auto hidden max-w-tikeo-container gap-6 px-6 pt-6 md:grid md:grid-cols-[1fr_300px]">
        <div>
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-tikeo-black">{{ t('home.discover') }}</h2>
            <select v-model="filters.date" class="input-field w-auto text-sm">
              <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>

          <div v-if="!hasResults" class="border border-dashed border-tikeo-border p-10 text-center text-sm text-tikeo-gray-text">
            {{ t('home.noResultsFiltersCount', activeFilterCount) }}
            <button type="button" class="block w-full font-semibold text-tikeo-orange" @click="resetFilters">{{ t('home.resetFilters') }}</button>
          </div>
          <div v-else class="grid grid-cols-3 gap-4 xl:grid-cols-4">
            <EventCard v-for="event in filteredEvents" :key="event.id" :event="event" variant="grid" />
          </div>
        </div>

        <SidebarFilters />
      </section>
    </template>

    <CityExplorer v-reveal />
    <TrustStats v-reveal />
    <OrganizerCtaBanner v-reveal />
  </div>
</template>
