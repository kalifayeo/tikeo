<script setup lang="ts">
const { theme, toggleTheme } = useTheme()
const { t } = useI18n()
const isDark = computed(() => theme.value === 'dark')
</script>

<template>
  <button
    type="button"
    class="relative flex h-9 w-[62px] shrink-0 items-center rounded-full border border-tikeo-border bg-tikeo-surface-alt px-1 transition-colors"
    role="switch"
    :aria-checked="isDark"
    :aria-label="isDark ? t('common.enableLightTheme') : t('common.enableDarkTheme')"
    @click="toggleTheme"
  >
    <!-- Icônes de fond (toujours visibles, l'une active l'autre estompée) -->
    <svg class="pointer-events-none absolute left-1.5 h-4 w-4 transition-opacity" :class="isDark ? 'opacity-30 text-tikeo-gray-text' : 'opacity-0'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
      <path stroke-linecap="round" stroke-linejoin="round" d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
    </svg>
    <svg class="pointer-events-none absolute right-1.5 h-4 w-4 transition-opacity" :class="isDark ? 'opacity-0' : 'opacity-40 text-tikeo-gray-text'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
      <circle cx="12" cy="12" r="4.5" />
      <path stroke-linecap="round" d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>

    <!-- Curseur mobile, contenant l'icône du thème actif -->
    <span
      class="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-tikeo-orange text-white shadow-card transition-transform duration-200"
      :class="isDark ? 'translate-x-0' : 'translate-x-[26px]'"
    >
      <svg v-if="isDark" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
        <path stroke-linecap="round" stroke-linejoin="round" d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
      </svg>
      <svg v-else class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
        <circle cx="12" cy="12" r="4.5" />
        <path stroke-linecap="round" d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
      </svg>
    </span>
  </button>
</template>
