<script setup lang="ts">
import { EVENT_SORT_OPTIONS, type EventSortBy } from '~/composables/useEventSearch'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const { results, loading, search } = useEventSearch()

const queryText = ref((route.query.q as string) || '')
const sortBy = ref<EventSortBy>('relevance')
const inputEl = ref<HTMLInputElement | null>(null)

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

// Recherche « en direct » : les résultats se mettent à jour pendant la frappe
// (sans recharger la page ni remplir l'historique du navigateur).
let typingTimer: ReturnType<typeof setTimeout> | null = null
watch(queryText, (val) => {
  if (val === ((route.query.q as string) || '')) return
  if (typingTimer) clearTimeout(typingTimer)
  typingTimer = setTimeout(() => {
    router.replace({ path: '/recherche', query: val.trim() ? { q: val.trim() } : {} })
  }, 350)
})
onBeforeUnmount(() => typingTimer && clearTimeout(typingTimer))

function goBack() {
  // Retour à la page précédente du site ; à défaut (lien direct), l'accueil.
  if (window.history.length > 1) router.back()
  else router.push('/')
}

onMounted(() => {
  runSearch()
  // Sur mobile, le clavier s'ouvre directement : on arrive pour chercher.
  inputEl.value?.focus()
})
</script>

<template>
  <div class="mx-auto max-w-tikeo-container px-4 py-6 md:px-6">
    <!-- Barre de recherche de la page : sur mobile, c'est LA page de recherche
         (l'icône loupe du header y mène), avec bouton retour. -->
    <div class="mb-5 flex max-w-xl items-center gap-2">
      <button type="button" class="flex h-11 w-11 shrink-0 items-center justify-center border border-tikeo-border bg-tikeo-surface text-tikeo-black md:hidden" :aria-label="t('common.back')" @click="goBack">
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
      </button>
      <form class="relative flex-1" @submit.prevent="handleSubmit">
        <svg class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <input ref="inputEl" v-model="queryText" type="search" enterkeyhint="search" autocomplete="off" :placeholder="t('header.searchPlaceholder')" class="input-field pl-10 pr-12" />
        <button type="submit" class="absolute right-1.5 top-1/2 flex h-7 w-9 -translate-y-1/2 items-center justify-center bg-tikeo-orange text-white hover:bg-tikeo-orange-dark transition-colors duration-200" :aria-label="t('header.search')">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
        </button>
      </form>
    </div>

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
