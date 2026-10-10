<script setup lang="ts">
// Raccourcis mobile : une seule rangée de 4 actions (le bureau a déjà tout
// dans l'en-tête).
const { t } = useI18n()
const canScan = useCanScan()
const allActions = computed(() => [
  { label: t('header.myTickets'), to: '/mon-espace/mes-billets', icon: 'M4 7a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 000-4V7z' },
  { label: t('header.favorites'), to: '/mon-espace/mes-favoris', icon: 'M12 21s-7.5-4.6-10-9.1C.5 8.6 2.3 5 6 5c2 0 3.4 1.1 4 2.2C10.6 6.1 12 5 14 5c3.7 0 5.5 3.6 4 6.9-2.5 4.5-10 9.1-10 9.1z' },
  { label: t('header.notifications'), to: '/mon-espace/notifications', icon: 'M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
  { label: t('nav.scanner'), to: '/organisateur/evenements/scanner', scanner: true, icon: 'M4 4h4v4H4V4zM16 4h4v4h-4V4zM4 16h4v4H4v-4zM14 14h6v6h-6zM4 10h16' },
])
// Visible pour tous : les non-organisateurs arrivent sur la page /scanner qui explique l'accès.
const actions = computed(() => allActions.value.map((a) => ('scanner' in a && !canScan.value ? { ...a, to: '/scanner' } : a)))
</script>

<template>
  <section class="mx-auto max-w-tikeo-container px-4 pt-4 md:hidden">
    <div class="grid grid-cols-4 divide-x divide-tikeo-border border border-tikeo-border bg-tikeo-surface">
      <NuxtLink
        v-for="a in actions"
        :key="a.to"
        :to="a.to"
        class="flex flex-col items-center gap-1.5 px-1 py-3 text-tikeo-black transition-colors active:bg-tikeo-surface-alt"
      >
        <svg class="h-5 w-5 text-tikeo-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7">
          <path stroke-linecap="round" stroke-linejoin="round" :d="a.icon" />
        </svg>
        <span class="w-full truncate text-center text-[11px] font-semibold">{{ a.label }}</span>
      </NuxtLink>
    </div>
  </section>
</template>
