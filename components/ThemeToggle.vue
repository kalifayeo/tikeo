<script setup lang="ts">
// `compact` (mobile) : un simple petit bouton rond dont l'icône change à
// chaque clic (soleil ↔ lune), au lieu du curseur qui glisse.
// `boxed` : variante carrée 40 px, assortie aux boutons des espaces Admin / Organisateur.
defineProps<{ compact?: boolean; boxed?: boolean }>()
const { theme, toggleTheme } = useTheme()
const { t } = useI18n()
const isDark = computed(() => theme.value === 'dark')
</script>

<template>
  <button
    v-if="compact"
    type="button"
    class="flex shrink-0 items-center justify-center border border-tikeo-border bg-tikeo-surface text-tikeo-gray-text transition-colors active:scale-95 hover:border-tikeo-orange hover:text-tikeo-orange"
    :class="boxed ? 'h-10 w-10' : 'h-8 w-8 rounded-full'"
    :aria-label="isDark ? t('common.enableLightTheme') : t('common.enableDarkTheme')"
    @click="toggleTheme"
  >
    <svg v-if="isDark" key="moon" class="theme-ico" :class="boxed ? 'h-5 w-5' : 'h-[18px] w-[18px]'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
      <path stroke-linecap="round" stroke-linejoin="round" d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
    </svg>
    <svg v-else key="sun" class="theme-ico" :class="boxed ? 'h-5 w-5' : 'h-[18px] w-[18px]'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
      <circle cx="12" cy="12" r="4.5" />
      <path stroke-linecap="round" d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>
  </button>
  <button
    v-else
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

<style scoped>
/* L'icône pivote légèrement à chaque bascule soleil ↔ lune. */
.theme-ico {
  animation: theme-ico-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes theme-ico-in {
  from {
    transform: rotate(-70deg) scale(0.5);
    opacity: 0;
  }
  to {
    transform: rotate(0) scale(1);
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .theme-ico {
    animation: none;
  }
}
</style>
