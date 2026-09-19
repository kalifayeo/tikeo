<script setup lang="ts">
import { categoryIconPath } from '~/composables/useCategoriesList'

const { t } = useI18n()
const { categories, loading } = useCategoriesList()
const { filters, setCategory } = useHomeFilters()

// Raccourcis fixes affichés à la suite des vraies catégories Supabase :
// ce ne sont pas des filtres (ils n'existent pas en base), mais des accès
// rapides vers des pages perso, comme sur la maquette d'origine.
// IMPORTANT : `computed()` (et non un tableau figé au montage) pour que
// les libellés se retraduisent bien quand la langue change en cours de session.
const shortcuts = computed(() => [
  {
    label: t('header.favorites'),
    to: '/mon-espace/mes-favoris',
    icon: 'M12 21s-7.5-4.6-10-9.1C.5 8.6 2.3 5 6 5c2 0 3.4 1.1 4 2.2C10.6 6.1 12 5 14 5c3.7 0 5.5 3.6 4 6.9-2.5 4.5-10 9.1-10 9.1z',
  },
  {
    label: t('header.settings'),
    to: '/mon-espace/parametres',
    icon: 'M10.3 3.4a1.9 1.9 0 013.4 0l.3.7a1.9 1.9 0 002.3 1l.7-.2a1.9 1.9 0 012.4 2.4l-.2.7a1.9 1.9 0 001 2.3l.7.3a1.9 1.9 0 010 3.4l-.7.3a1.9 1.9 0 00-1 2.3l.2.7a1.9 1.9 0 01-2.4 2.4l-.7-.2a1.9 1.9 0 00-2.3 1l-.3.7a1.9 1.9 0 01-3.4 0l-.3-.7a1.9 1.9 0 00-2.3-1l-.7.2a1.9 1.9 0 01-2.4-2.4l.2-.7a1.9 1.9 0 00-1-2.3l-.7-.3a1.9 1.9 0 010-3.4l.7-.3a1.9 1.9 0 001-2.3l-.2-.7a1.9 1.9 0 012.4-2.4l.7.2a1.9 1.9 0 002.3-1l.3-.7zM12 15a3 3 0 100-6 3 3 0 000 6z',
  },
])
</script>

<template>
  <section class="mx-auto max-w-tikeo-container px-4 pb-6 md:px-6">
    <h2 class="mb-3 text-base font-semibold text-tikeo-black">{{ t('home.categories') }}</h2>

    <div v-if="loading && categories.length === 0" class="no-scrollbar flex gap-3 overflow-x-auto md:grid md:grid-cols-8">
      <div v-for="i in 8" :key="i" class="h-[74px] w-24 shrink-0 animate-pulse border border-tikeo-border bg-tikeo-surface-alt md:w-auto" />
    </div>

    <div v-else class="no-scrollbar flex gap-3 overflow-x-auto md:grid md:grid-cols-8">
      <button
        type="button"
        class="flex shrink-0 flex-col items-center gap-1.5 rounded-card border px-4 py-3 text-xs font-medium transition duration-200 hover:-translate-y-0.5 active:scale-[0.9]"
        :class="!filters.category ? 'border-tikeo-orange bg-tikeo-orange/10 text-tikeo-orange' : 'border-tikeo-border bg-tikeo-surface text-tikeo-gray-text hover:border-tikeo-orange/40'"
        @click="setCategory(null)"
      >
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        {{ t('home.all') }}
      </button>

      <button
        v-for="cat in categories"
        :key="cat.id"
        type="button"
        class="flex shrink-0 flex-col items-center gap-1.5 rounded-card border px-4 py-3 text-xs font-medium transition duration-200 hover:-translate-y-0.5 active:scale-[0.9]"
        :class="filters.category === cat.name ? 'border-tikeo-orange bg-tikeo-orange/10 text-tikeo-orange' : 'border-tikeo-border bg-tikeo-surface text-tikeo-gray-text hover:border-tikeo-orange/40'"
        @click="setCategory(cat.name)"
      >
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6">
          <path stroke-linecap="round" stroke-linejoin="round" :d="categoryIconPath(cat.icon)" />
        </svg>
        {{ cat.name }}
      </button>

      <!-- Raccourcis (favoris / paramètres) : navigation directe, pas de filtre -->
      <NuxtLink
        v-for="shortcut in shortcuts"
        :key="shortcut.to"
        :to="shortcut.to"
        class="flex shrink-0 flex-col items-center gap-1.5 rounded-card border border-tikeo-border bg-tikeo-surface px-4 py-3 text-xs font-medium text-tikeo-gray-text transition duration-200 hover:-translate-y-0.5 hover:border-tikeo-orange/40 hover:text-tikeo-orange active:scale-[0.9]"
      >
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6">
          <path stroke-linecap="round" stroke-linejoin="round" :d="shortcut.icon" />
        </svg>
        {{ shortcut.label }}
      </NuxtLink>
    </div>
  </section>
</template>
