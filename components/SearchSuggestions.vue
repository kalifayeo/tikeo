<script setup lang="ts">
/**
 * Liste de suggestions de recherche (nom, ville, organisateur), partagée
 * entre la barre de recherche desktop et la recherche mobile de l'en-tête.
 */
import type { EventCardData } from '~/types/database'

defineProps<{ suggestions: EventCardData[]; loading: boolean }>()
const emit = defineEmits<{ (e: 'select', slug: string): void; (e: 'all'): void }>()
const { t, locale } = useI18n()

function suggestionDate(iso: string) {
  return new Date(iso).toLocaleDateString(locale.value, { day: '2-digit', month: 'short' })
}
</script>

<template>
  <div>
    <div v-if="loading" class="p-4 text-center text-xs text-tikeo-gray-text">{{ t('search.searching') }}</div>
    <template v-else-if="suggestions.length > 0">
      <button
        v-for="s in suggestions"
        :key="s.id"
        type="button"
        class="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-tikeo-gray-light"
        @click="emit('select', s.slug)"
      >
        <img :src="s.coverImage" alt="" width="44" height="44" loading="lazy" decoding="async" class="h-11 w-11 shrink-0 object-cover" />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-semibold text-tikeo-black">{{ s.title }}</span>
          <span class="block truncate text-xs text-tikeo-gray-text">{{ suggestionDate(s.startDate) }} · {{ s.city }}<span v-if="s.organizerName"> · {{ s.organizerName }}</span></span>
        </span>
        <AppIcon name="chevron-right" class="h-4 w-4 shrink-0 text-tikeo-gray-text" />
      </button>
      <button
        type="button"
        class="block w-full border-t border-tikeo-border px-3.5 py-3 text-center text-xs font-bold text-tikeo-orange transition-colors hover:bg-tikeo-gray-light"
        @click="emit('all')"
      >
        {{ t('search.seeAllResults') }}
      </button>
    </template>
    <div v-else class="p-4 text-center text-xs text-tikeo-gray-text">{{ t('search.noSuggestion') }}</div>
  </div>
</template>
