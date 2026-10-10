<script setup lang="ts">
const { t } = useI18n()
const { country, countries, setCountry } = useCountry()

const countryMenuOpen = ref(false)

function chooseCountry(code: string) {
  setCountry(code)
  countryMenuOpen.value = false
}

const socialLinks = SOCIAL_LINKS
const { open: openPresentation } = usePresentationVideo()
</script>

<template>
  <div class="hidden bg-tikeo-ink text-white md:block">
    <div class="mx-auto flex max-w-tikeo-container items-center justify-between px-6 py-2 text-xs">
      <!-- Localisation + langue -->
      <div class="flex items-center gap-3">
        <div class="relative">
          <button
            type="button"
            class="flex items-center gap-1.5 font-medium text-white/80 transition-colors hover:text-[#FF9A3D]"
            :aria-expanded="countryMenuOpen"
            aria-haspopup="true"
            @click="countryMenuOpen = !countryMenuOpen"
          >
            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 21s-6.5-5.3-6.5-10.5a6.5 6.5 0 1113 0C18.5 15.7 12 21 12 21z" />
              <circle cx="12" cy="10.5" r="2.2" />
            </svg>
            {{ country.flag }} {{ country.name }}
            <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div
            v-if="countryMenuOpen"
            class="absolute left-0 top-7 z-50 w-48 overflow-hidden border border-tikeo-border bg-tikeo-surface py-1 shadow-card-hover"
          >
            <button
              v-for="c in countries"
              :key="c.code"
              type="button"
              class="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-tikeo-gray-text hover:bg-tikeo-gray-light hover:text-tikeo-black"
              :class="c.code === country.code ? 'font-bold text-tikeo-orange' : ''"
              @click="chooseCountry(c.code)"
            >
              <span>{{ c.flag }}</span> {{ c.name }}
            </button>
          </div>
          <button
            v-if="countryMenuOpen"
            type="button"
            class="fixed inset-0 z-40 cursor-default"
            aria-label="Fermer"
            @click="countryMenuOpen = false"
          />
        </div>

        <span class="h-3.5 w-px bg-white/20" />

        <span class="inline-flex" data-tour="language"><LanguageSwitcher class="!h-auto [&>button]:h-auto [&>button]:border-0 [&>button]:p-0 [&>button]:font-medium [&>button]:text-white/80 [&>button:hover]:bg-transparent [&>button:hover]:text-[#FF9A3D]" /></span>
      </div>

      <!-- Réseaux sociaux + contact -->
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-3">
          <a
            v-for="s in socialLinks"
            :key="s.name"
            :href="s.href"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="s.name"
            class="text-white/70 transition-colors hover:text-[#FF9A3D]"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path :d="s.path" /></svg>
          </a>
        </div>
        <span class="h-3.5 w-px bg-white/20" />
        <button type="button" class="flex items-center gap-1.5 font-medium text-white/80 transition-colors hover:text-[#FF9A3D]" @click="openPresentation">
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z" /></svg>
          {{ t('presentationVideo.button') }}
        </button>
        <span class="h-3.5 w-px bg-white/20" />
        <NuxtLink to="/contact" class="flex items-center gap-1.5 font-medium text-white/80 transition-colors hover:text-[#FF9A3D]">
          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M18 10c0-3.3-2.7-6-6-6s-6 2.7-6 6v3l-1.2 2.4A1 1 0 005.7 17H8m8 0a2 2 0 11-4 0m4 0H8" />
          </svg>
          {{ t('topbar.contact') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
