<script setup lang="ts">
const { t } = useI18n()
const { country, countries, setCountry } = useCountry()

const countryMenuOpen = ref(false)

function chooseCountry(code: string) {
  setCountry(code)
  countryMenuOpen.value = false
}

// Réseaux sociaux Tikeo — à remplacer par les vraies URLs officielles.
const socialLinks = [
  {
    name: 'Facebook',
    href: 'https://facebook.com/tikeo',
    path: 'M13.5 9H15V6h-1.5C11.6 6 10 7.6 10 9.5V11H8.5v3H10v6h3v-6h2l.5-3H13v-1c0-.6.4-1 1-1z',
  },
  {
    name: 'Instagram',
    href: 'https://instagram.com/tikeo',
    path: 'M12 8.2a3.8 3.8 0 100 7.6 3.8 3.8 0 000-7.6zm0 6.3a2.5 2.5 0 110-5 2.5 2.5 0 010 5zm4.85-6.45a.9.9 0 11-1.8 0 .9.9 0 011.8 0zM12 5.6c-1.8 0-2 0-2.8.05-.7.03-1.2.15-1.6.32a3.2 3.2 0 00-1.15.75c-.36.36-.58.72-.75 1.15-.17.4-.29.9-.32 1.6C5.3 10.1 5.3 10.3 5.3 12s0 1.9.05 2.7c.03.7.15 1.2.32 1.6.17.43.4.79.75 1.15.36.36.72.58 1.15.75.4.17.9.29 1.6.32.8.05 1 .05 2.83.05s2 0 2.8-.05c.7-.03 1.2-.15 1.6-.32.43-.17.79-.4 1.15-.75.36-.36.58-.72.75-1.15.17-.4.29-.9.32-1.6.05-.8.05-1 .05-2.8s0-2-.05-2.8c-.03-.7-.15-1.2-.32-1.6a3.2 3.2 0 00-.75-1.15 3.2 3.2 0 00-1.15-.75c-.4-.17-.9-.29-1.6-.32-.8-.05-1-.05-2.8-.05z',
  },
  {
    name: 'TikTok',
    href: 'https://tiktok.com/@tikeo',
    path: 'M16.6 5.8a4.3 4.3 0 01-2.6-1V14a4.9 4.9 0 11-4.9-4.9c.2 0 .4 0 .6.03v2.2a2.7 2.7 0 102.2 2.66V2h2.1a4.3 4.3 0 002.6 3.4v.4z',
  },
  {
    name: 'LinkedIn',
    href: 'https://linkedin.com/company/tikeo',
    path: 'M6.94 8.5H4.56V19h2.38V8.5zM5.75 4.5a1.38 1.38 0 100 2.76 1.38 1.38 0 000-2.76zM19.5 19h-2.38v-5.4c0-1.29-.46-2.17-1.6-2.17-.88 0-1.4.6-1.63 1.17-.08.2-.1.49-.1.77V19H11.4s.03-9.4 0-10.5h2.38v1.49a2.37 2.37 0 012.15-1.19c1.57 0 2.75 1.03 2.75 3.23V19z',
  },
]
</script>

<template>
  <div class="hidden border-b border-tikeo-border bg-tikeo-gray-light/60 md:block">
    <div class="mx-auto flex max-w-tikeo-container items-center justify-between px-6 py-1.5 text-xs">
      <!-- Localisation + langue -->
      <div class="flex items-center gap-3">
        <div class="relative">
          <button
            type="button"
            class="flex items-center gap-1 font-medium text-tikeo-gray-text hover:text-tikeo-orange"
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
            class="absolute left-0 top-6 z-50 w-48 overflow-hidden rounded-lg border border-tikeo-border bg-tikeo-surface py-1 shadow-card-hover"
          >
            <button
              v-for="c in countries"
              :key="c.code"
              type="button"
              class="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-tikeo-gray-text hover:bg-tikeo-gray-light hover:text-tikeo-black"
              :class="c.code === country.code ? 'font-semibold text-tikeo-orange' : ''"
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

        <span class="h-3.5 w-px bg-tikeo-border" />

        <LanguageSwitcher class="!h-auto [&>button]:h-auto [&>button]:border-0 [&>button]:p-0 [&>button]:font-medium [&>button]:text-tikeo-gray-text [&>button:hover]:text-tikeo-orange" />
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
            class="text-tikeo-gray-text hover:text-tikeo-orange"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path :d="s.path" /></svg>
          </a>
        </div>
        <span class="h-3.5 w-px bg-tikeo-border" />
        <NuxtLink to="/contact" class="flex items-center gap-1.5 font-medium text-tikeo-gray-text hover:text-tikeo-orange">
          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M18 10c0-3.3-2.7-6-6-6s-6 2.7-6 6v3l-1.2 2.4A1 1 0 005.7 17H8m8 0a2 2 0 11-4 0m4 0H8" />
          </svg>
          {{ t('topbar.contact') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
