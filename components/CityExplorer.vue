<script setup lang="ts">
const { t } = useI18n()
const { filters, setCity } = useHomeFilters()

const cities = computed(() => [
  { name: 'Abidjan', tag: t('cityExplorer.abidjanTag') },
  { name: 'Bouaké', tag: t('cityExplorer.bouakeTag') },
  { name: 'Yamoussoukro', tag: t('cityExplorer.yamoussoukroTag') },
  { name: 'San-Pédro', tag: t('cityExplorer.sanPedroTag') },
  { name: 'Korhogo', tag: t('cityExplorer.korhogoTag') },
  { name: 'Man', tag: t('cityExplorer.manTag') },
])

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
  <section class="mx-auto max-w-tikeo-container px-4 py-8 md:px-6">
    <div class="mb-4 flex items-end justify-between">
      <div>
        <h2 class="text-lg font-semibold text-tikeo-black">{{ t('cityExplorer.title') }}</h2>
        <p class="text-sm text-tikeo-gray-text">{{ t('cityExplorer.subtitle') }}</p>
      </div>
    </div>

    <div class="no-scrollbar grid grid-flow-col auto-cols-[minmax(150px,1fr)] gap-3 overflow-x-auto md:grid-flow-row md:grid-cols-3 md:auto-cols-auto lg:grid-cols-6">
      <button
        v-for="city in cities"
        :key="city.name"
        type="button"
        class="flex flex-col items-start gap-2 border p-4 text-left transition"
        :class="filters.city === city.name ? 'border-tikeo-orange bg-tikeo-orange/10' : 'border-tikeo-border bg-tikeo-surface hover:border-tikeo-orange/40'"
        @click="selectCity(city.name)"
      >
        <span class="flex h-9 w-9 items-center justify-center rounded-full bg-tikeo-brand text-white">
          <svg class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 21c-4.5-4-7-7.4-7-10.5A7 7 0 0119 10.5C19 13.6 16.5 17 12 21z" />
            <circle cx="12" cy="10.5" r="2.2" stroke-width="1.8" />
          </svg>
        </span>
        <span class="text-sm font-bold text-tikeo-black">{{ city.name }}</span>
        <span class="text-[11px] text-tikeo-gray-text">{{ city.tag }}</span>
      </button>
    </div>
  </section>
</template>
