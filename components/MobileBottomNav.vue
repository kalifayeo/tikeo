<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()

const items = computed(() => [
  { label: t('nav.home'), to: '/', icon: 'M3 11.5L12 4l9 7.5M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9' },
  { label: t('nav.explore'), to: '/evenements', icon: 'M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z' },
  { label: t('nav.scanner'), to: '/organisateur/evenements/scanner', icon: 'M4 4h4v4H4V4zM16 4h4v4h-4V4zM4 16h4v4H4v-4zM14 14h6v6h-6zM4 10h16', scanner: true },
  { label: t('nav.profile'), to: '/mon-espace/profil', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { label: t('nav.settings'), to: '/mon-espace/parametres', icon: 'M10.3 3.3a2 2 0 013.4 0l.4.7a2 2 0 001.6.9h.8a2 2 0 012 2v.8a2 2 0 00.9 1.6l.7.4a2 2 0 010 3.4l-.7.4a2 2 0 00-.9 1.6v.8a2 2 0 01-2 2h-.8a2 2 0 00-1.6.9l-.4.7a2 2 0 01-3.4 0l-.4-.7a2 2 0 00-1.6-.9h-.8a2 2 0 01-2-2v-.8a2 2 0 00-.9-1.6l-.7-.4a2 2 0 010-3.4l.7-.4a2 2 0 00.9-1.6v-.8a2 2 0 012-2h.8a2 2 0 001.6-.9l.4-.7z' },
])

function isActive(to: string) {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}
</script>

<template>
  <nav class="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-1.5">
    <div class="mx-auto flex max-w-md items-center justify-between border border-tikeo-border bg-tikeo-surface/95 px-2 py-1.5 shadow-card-hover backdrop-blur">
      <NuxtLink
        v-for="item in items"
        :key="item.label"
        :to="item.to"
        class="flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors"
        :class="!item.scanner && isActive(item.to) ? 'bg-tikeo-orange/10 text-tikeo-orange' : !item.scanner ? 'text-tikeo-gray-text' : ''"
      >
        <span
          class="flex items-center justify-center rounded-full transition-transform duration-150 active:scale-[0.85]"
          :class="item.scanner ? 'h-12 w-12 -translate-y-4 bg-tikeo-brand text-white shadow-card-hover ring-4 ring-white' : 'h-6 w-6'"
        >
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" :d="item.icon" />
          </svg>
        </span>
        <span v-if="!item.scanner">{{ item.label }}</span>
      </NuxtLink>
    </div>
  </nav>
</template>
