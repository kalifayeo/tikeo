<script setup lang="ts">
// Modale "Choisissez un pays" affichée à l'ouverture du site, tant que
// l'utilisateur n'a pas confirmé son pays (persistant en cookie), sur le
// même principe que Tikerama.
const { t } = useI18n()
const { country, countries, setCountry } = useCountry()
const confirmed = useCookie<boolean>('tikeo_country_confirmed', { default: () => false })

const open = ref(false)

onMounted(() => {
  if (!confirmed.value) {
    open.value = true
  }
})

function choose(code: string) {
  setCountry(code)
  confirmed.value = true
  open.value = false
}

function close() {
  // Ferme sans forcer de choix : le pays par défaut reste actif, mais on
  // ne réaffiche pas la modale à chaque navigation dans la même session.
  confirmed.value = true
  open.value = false
}
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-150"
    leave-active-class="transition-opacity duration-100"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div v-if="open" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4">
      <div class="w-full max-w-md border border-tikeo-border bg-tikeo-surface p-5 shadow-card-hover">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-bold text-tikeo-black">{{ t('country.title') }}</h2>
          <button type="button" class="p-1 text-tikeo-gray-text hover:text-tikeo-orange" :aria-label="t('country.close')" @click="close">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="max-h-80 overflow-y-auto border-t border-tikeo-border">
          <button
            v-for="c in countries"
            :key="c.code"
            type="button"
            class="flex w-full items-center justify-between border-b border-tikeo-border px-1 py-3 text-left text-sm transition hover:bg-tikeo-gray-light"
            :class="c.code === country.code ? 'font-semibold text-tikeo-orange' : 'text-tikeo-black'"
            @click="choose(c.code)"
          >
            <span class="flex items-center gap-3">
              <span class="text-xl">{{ c.flag }}</span>
              {{ c.name }}
            </span>
            <svg class="h-4 w-4 text-tikeo-gray-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
