<script setup lang="ts">
const { locale, locales, setLocale, t } = useI18n()

const open = ref(false)

const availableLocales = computed(() =>
  (locales.value as Array<{ code: string; name: string }>).filter((l) => l.code !== locale.value)
)

const currentCode = computed(() => locale.value.toUpperCase())

async function choose(code: string) {
  open.value = false
  try {
    await setLocale(code as any)
  } catch (e) {
    // Si un fichier de langue ne se charge pas, on log plutôt que de rester bloqué silencieusement.
    console.error('[i18n] Impossible de charger la langue', code, e)
  }
}
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="flex h-9 items-center gap-1 rounded-full border border-tikeo-border px-3 text-xs font-semibold text-tikeo-gray-text hover:border-tikeo-orange hover:text-tikeo-orange"
      :aria-expanded="open"
      aria-haspopup="true"
      @click="open = !open"
    >
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
        <circle cx="12" cy="12" r="9" />
        <path stroke-linecap="round" d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z" />
      </svg>
      {{ currentCode }}
    </button>

    <div
      v-if="open"
      class="absolute right-0 top-11 z-50 w-36 overflow-hidden rounded-lg border border-tikeo-border bg-tikeo-surface py-1 shadow-card-hover"
    >
      <button
        v-for="l in availableLocales"
        :key="l.code"
        type="button"
        class="block w-full px-3.5 py-2 text-left text-sm text-tikeo-gray-text hover:bg-tikeo-gray-light hover:text-tikeo-black"
        @click="choose(l.code)"
      >
        {{ l.name }}
      </button>
    </div>

    <button
      v-if="open"
      type="button"
      class="fixed inset-0 z-40 cursor-default"
      :aria-label="t('common.close')"
      @click="open = false"
    />
  </div>
</template>
