<script setup lang="ts">
import type { EventCardData } from '~/types/database'

// Exploration par ville. Le nombre d'événements affiché sur chaque ville est
// calculé à partir de la liste déjà chargée par la page d'accueil (aucune
// requête de plus).
const props = defineProps<{ events?: EventCardData[] }>()

const { t } = useI18n()
const { filters, setCity } = useHomeFilters()

const cities = computed(() =>
  [
    { name: 'Abidjan', tag: t('cityExplorer.abidjanTag') },
    { name: 'Bouaké', tag: t('cityExplorer.bouakeTag') },
    { name: 'Yamoussoukro', tag: t('cityExplorer.yamoussoukroTag') },
    { name: 'San-Pédro', tag: t('cityExplorer.sanPedroTag') },
    { name: 'Korhogo', tag: t('cityExplorer.korhogoTag') },
    { name: 'Man', tag: t('cityExplorer.manTag') },
  ].map((c) => ({ ...c, count: (props.events ?? []).filter((e) => e.city === c.name).length }))
)

function selectCity(name: string) {
  setCity(filters.value.city === name ? null : name)
  // Mobile et desktop ont chacun leur propre bloc de résultats (l'un est
  // masqué en CSS selon la largeur d'écran) : on cible celui réellement visible.
  const anchors = document.querySelectorAll<HTMLElement>('[data-events-anchor]')
  const visible = Array.from(anchors).find((el) => el.offsetParent !== null)
  visible?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <section class="mx-auto max-w-tikeo-container px-4 pt-14 md:px-6 md:pt-20">
    <div class="mb-6 max-w-xl">
      <h2 class="font-display text-2xl font-extrabold tracking-tight text-tikeo-black md:text-4xl">{{ t('cityExplorer.title') }}</h2>
      <p class="mt-2 text-sm text-tikeo-gray-text md:text-base">{{ t('cityExplorer.subtitle') }}</p>
    </div>

    <div class="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:grid-cols-6">
      <button
        v-for="city in cities"
        :key="city.name"
        type="button"
        class="group flex min-h-[8.5rem] w-40 shrink-0 snap-start flex-col justify-between border p-4 text-left transition-colors duration-200 md:w-auto"
        :class="
          filters.city === city.name
            ? 'border-tikeo-ink bg-tikeo-ink text-white dark:border-tikeo-orange dark:bg-tikeo-orange dark:text-tikeo-ink'
            : 'border-tikeo-border bg-tikeo-surface text-tikeo-black hover:border-tikeo-ink dark:hover:border-tikeo-orange'
        "
        :aria-pressed="filters.city === city.name"
        @click="selectCity(city.name)"
      >
        <span>
          <span class="block font-display text-xl font-extrabold leading-tight">{{ city.name }}</span>
          <span class="mt-1 block text-xs opacity-70">{{ city.tag }}</span>
        </span>
        <span class="text-sm font-semibold">
          <template v-if="city.count > 0">{{ t('home.eventsCount', city.count) }}</template>
          <template v-else>&nbsp;</template>
        </span>
      </button>
    </div>
  </section>
</template>
