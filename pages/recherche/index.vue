<script setup lang="ts">
import { EVENT_SORT_OPTIONS, type EventSortBy } from '~/composables/useEventSearch'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const { results, loading, search } = useEventSearch()

const queryText = ref((route.query.q as string) || '')
const sortBy = ref<EventSortBy>('relevance')

useSeoMeta({
  title: () => (queryText.value ? `Recherche : ${queryText.value} — Tikeo` : 'Recherche — Tikeo'),
  description: "Recherche d'événements, d'artistes, d'organisateurs, de villes et de catégories sur Tikeo.",
  ogTitle: () => (queryText.value ? `Recherche : ${queryText.value} — Tikeo` : 'Recherche — Tikeo'),
  // Les résultats de recherche interne n'ont pas vocation à être indexés (contenu quasi infini).
  robots: 'noindex, follow',
})

async function runSearch() {
  await search(queryText.value, { sortBy: sortBy.value, limit: 40 })
}

function handleSubmit() {
  router.replace({ path: '/recherche', query: queryText.value ? { q: queryText.value } : {} })
}

watch(
  () => route.query.q,
  (q) => {
    queryText.value = (q as string) || ''
    runSearch()
  }
)
watch(sortBy, runSearch)

onMounted(runSearch)
</script>

<template>
  <div class="mx-auto max-w-tikeo-container px-4 py-6 md:px-6">
    <!-- Barre de recherche locale à la page (utile si on arrive ici directement) -->
    <form class="relative mb-5 max-w-xl" @submit.prevent="handleSubmit">
      <svg class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
      </svg>
      <input v-model="queryText" type="search" :placeholder="t('header.searchPlaceholder')" class="input-field pl-10 pr-12" />
      <button type="submit" class="absolute right-1.5 top-1/2 flex h-7 w-9 -translate-y-1/2 items-center justify-center bg-tikeo-orange text-white hover:bg-tikeo-orange-dark transition-colors duration-200" :aria-label="t('header.search')">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
      </button>
    </form>

    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-lg font-semibold text-tikeo-black">
        <template v-if="queryText">{{ t('search.resultsFor') }} « {{ queryText }} »</template>
        <template v-else>{{ t('search.allEvents') }}</template>
        <span class="ml-2 text-sm font-normal text-tikeo-gray-text">({{ results.length }})</span>
      </h1>

      <select v-model="sortBy" class="input-field w-auto text-sm">
        <option v-for="opt in EVENT_SORT_OPTIONS" :key="opt.value" :value="opt.value">{{ t(opt.labelKey) }}</option>
      </select>
    </div>

    <div v-if="loading" class="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
      <div v-for="i in 8" :key="i" class="card h-64 animate-pulse bg-tikeo-surface-alt" />
    </div>
    <div v-else-if="results.length === 0" class="border border-dashed border-tikeo-border p-10 text-center text-sm text-tikeo-gray-text">
      {{ t('search.noResults') }}
    </div>
    <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
      <EventCard v-for="event in results" :key="event.id" :event="event" variant="grid" />
    </div>
  </div>
</template>
