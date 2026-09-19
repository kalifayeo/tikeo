<script setup lang="ts">
const { t } = useI18n()
const open = useState('tikeo-mobile-filters-open', () => false)
const { activeFilterCount } = useHomeFilters()

function close() {
  open.value = false
}
</script>

<template>
  <div class="md:hidden">
    <button
      type="button"
      class="flex items-center gap-1.5 border border-tikeo-border bg-tikeo-surface px-3.5 py-2 text-xs font-semibold text-tikeo-black"
      @click="open = true"
    >
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M7 12h10M10 18h4" />
      </svg>
      {{ t('filters.openFilters') }}
      <span v-if="activeFilterCount > 0" class="flex h-4 w-4 items-center justify-center rounded-full bg-tikeo-orange text-[10px] font-bold text-white">
        {{ activeFilterCount }}
      </span>
    </button>

    <Teleport to="body">
      <Transition enter-active-class="transition-opacity duration-200" leave-active-class="transition-opacity duration-150" enter-from-class="opacity-0" leave-to-class="opacity-0">
        <button v-if="open" type="button" class="fixed inset-0 z-50 bg-black/40" :aria-label="t('common.close')" @click="close" />
      </Transition>
      <Transition
        enter-active-class="transition-transform duration-200 ease-out"
        leave-active-class="transition-transform duration-150 ease-in"
        enter-from-class="translate-y-full"
        leave-to-class="translate-y-full"
      >
        <div v-if="open" class="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-tikeo-surface p-5 pb-8 shadow-card-hover">
          <div class="mx-auto mb-4 h-1 w-10 rounded-full bg-tikeo-border" />
          <FiltersPanel compact @apply="close" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
