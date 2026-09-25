<script setup lang="ts">
const { t } = useI18n()
const trending = ['Abidjan', 'Bouaké', 'Yamoussoukro']
const { setCity } = useHomeFilters()
</script>

<template>
  <aside class="space-y-4">
    <div class="card p-4">
      <h3 class="mb-3 text-sm font-semibold text-tikeo-black">{{ t('filters.trendingTitle') }}</h3>
      <ul class="space-y-2.5">
        <li v-for="(city, i) in trending" :key="i">
          <button
            type="button"
            class="flex w-full items-center gap-2 text-left text-sm text-tikeo-gray-text hover:text-tikeo-orange"
            @click="setCity(city)"
          >
            <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tikeo-gray-light text-tikeo-orange">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M13 7h8m0 0v8m0-8L10 18l-5-5" />
              </svg>
            </span>
            <span>{{ city }}</span>
          </button>
        </li>
      </ul>
    </div>

    <div class="card p-4">
      <FiltersPanel />
    </div>
  </aside>
</template>
