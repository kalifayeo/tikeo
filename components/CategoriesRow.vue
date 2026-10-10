<script setup lang="ts">
import { categoryIconPath } from '~/composables/useCategoriesList'

// Barre de catégories : une seule fonction, filtrer l'accueil par catégorie.
// (Les raccourcis Favoris / Paramètres qui s'y mêlaient avant ne sont plus
// ici : ils restent accessibles depuis l'en-tête, le menu mobile et la
// barre du bas.)
const { t } = useI18n()
const { categories, loading } = useCategoriesList()
const { filters, setCategory } = useHomeFilters()

const pill =
  'flex h-11 shrink-0 items-center gap-2 border px-4 text-sm font-semibold transition-colors duration-200 active:scale-[0.97]'
const pillOn = 'border-tikeo-ink bg-tikeo-ink text-white dark:border-tikeo-orange dark:bg-tikeo-orange dark:text-tikeo-ink'
const pillOff = 'border-tikeo-border bg-tikeo-surface text-tikeo-black hover:border-tikeo-ink dark:hover:border-tikeo-orange'
</script>

<template>
  <section class="border-b border-tikeo-border bg-tikeo-surface" :aria-label="t('home.categories')">
    <div class="mx-auto max-w-tikeo-container px-4 py-3.5 md:px-6">
      <div v-if="loading && categories.length === 0" class="no-scrollbar flex gap-2 overflow-x-auto">
        <div v-for="i in 8" :key="i" class="h-11 w-28 shrink-0 animate-pulse bg-tikeo-surface-alt" />
      </div>

      <div v-else class="no-scrollbar flex gap-2 overflow-x-auto">
        <button type="button" :class="[pill, !filters.category ? pillOn : pillOff]" :aria-pressed="!filters.category" @click="setCategory(null)">
          <svg class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          {{ t('home.all') }}
        </button>

        <button
          v-for="cat in categories"
          :key="cat.id"
          type="button"
          :class="[pill, filters.category === cat.name ? pillOn : pillOff]"
          :aria-pressed="filters.category === cat.name"
          @click="setCategory(cat.name)"
        >
          <svg class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" :d="categoryIconPath(cat.icon)" />
          </svg>
          {{ cat.name }}
        </button>
      </div>
    </div>
  </section>
</template>
