<script setup lang="ts">
const { t } = useI18n()
const actions = computed(() => [
  { label: t('nav.scanner'), to: '/organisateur/evenements/scanner', icon: 'M4 4h4v4H4V4zM16 4h4v4h-4V4zM4 16h4v4H4v-4zM14 14h6v6h-6zM4 10h16', highlight: true },
  { label: t('header.myTickets'), to: '/mon-espace/mes-billets', icon: 'M4 7a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 000-4V7z' },
  { label: t('header.notifications'), to: '/mon-espace/notifications', icon: 'M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
  { label: t('header.favorites'), to: '/mon-espace/mes-favoris', icon: 'M12 21s-7.5-4.6-10-9.1C.5 8.6 2.3 5 6 5c2 0 3.4 1.1 4 2.2C10.6 6.1 12 5 14 5c3.7 0 5.5 3.6 4 6.9-2.5 4.5-10 9.1-10 9.1z' },
])
</script>

<template>
  <section class="mx-auto grid max-w-tikeo-container grid-cols-2 gap-2.5 px-4 pb-3 pt-2 md:hidden">
    <NuxtLink
      v-for="a in actions"
      :key="a.label"
      :to="a.to"
      class="flex flex-col items-center justify-center gap-1.5 border py-4 transition"
      :class="a.highlight ? 'border-tikeo-orange bg-tikeo-orange/10 text-tikeo-orange' : 'border-tikeo-border bg-tikeo-surface text-tikeo-black hover:border-tikeo-orange/40'"
    >
      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6">
        <path stroke-linecap="round" stroke-linejoin="round" :d="a.icon" />
      </svg>
      <span class="text-xs font-medium">{{ a.label }}</span>
    </NuxtLink>
  </section>
</template>
