<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const { events, loading } = useEventsList()
const { filters, matchesDateRange, resetFilters, activeFilterCount, setCategory } = useHomeFilters()

// Arrivée depuis un lien "Voir tout" d'une catégorie sur l'accueil
// (?category=Nom) : on applique le filtre correspondant à l'ouverture.
onMounted(() => {
  const category = route.query.category
  if (typeof category === 'string' && category) setCategory(category)
})

const filteredEvents = computed(() => {
  return events.value.filter((event) => {
    if (filters.value.category && event.category !== filters.value.category) return false
    if (filters.value.city && event.city !== filters.value.city) return false
    if (!matchesDateRange(event.startDate, filters.value.date)) return false
    if (event.priceFrom > filters.value.priceMax) return false
    return true
  })
})

const pageTitle = computed(() => filters.value.category || t('home.eventsSection'))
const hasResults = computed(() => filteredEvents.value.length > 0)

useSeoMeta({
  title: () => `${pageTitle.value} — Tikeo`,
  description: "Tous les événements publiés sur Tikeo, filtrables par catégorie, ville, date et prix.",
})
</script>

<template>
  <div>
    <CategoriesRow class="mt-3 md:mt-5" />

    <section class="mx-auto max-w-tikeo-container gap-6 px-4 pt-3 md:grid md:grid-cols-[1fr_300px] md:px-6 md:pt-6">
      <div>
        <div class="mb-4 flex items-center justify-between gap-2">
          <h1 class="text-lg font-semibold capitalize text-tikeo-black md:text-xl">{{ pageTitle }}</h1>
          <MobileFiltersDrawer class="md:hidden" />
        </div>

        <div v-if="loading" class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
          <div v-for="i in 8" :key="i" class="card h-56 animate-pulse bg-tikeo-surface-alt md:h-64" />
        </div>
        <div v-else-if="!hasResults" class="border border-dashed border-tikeo-border p-10 text-center text-sm text-tikeo-gray-text">
          Aucun événement ne correspond à ces filtres{{ activeFilterCount ? ` (${activeFilterCount} actif${activeFilterCount > 1 ? 's' : ''})` : '' }}.
          <button type="button" class="block w-full font-semibold text-tikeo-orange" @click="resetFilters">Réinitialiser les filtres</button>
        </div>
        <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
          <EventCard v-for="event in filteredEvents" :key="event.id" :event="event" variant="grid" />
        </div>
      </div>

      <SidebarFilters class="hidden md:block" />
    </section>
  </div>
</template>
