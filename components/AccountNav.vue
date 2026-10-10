<script setup lang="ts">
// Navigation de l'espace acheteur (§10 du cahier des charges), au même
// gabarit que la barre de sections de la page événement : pastilles carrées
// avec icône, défilement horizontal sur mobile, pastille active en encre
// (orange en thème sombre). Elle est rendue par AccountShell.
const { t } = useI18n()
const route = useRoute()
const { unreadCount } = useMyNotifications()

const links = computed(() => [
  { to: '/mon-espace/tableau-de-bord', label: t('header.dashboard'), icon: 'dashboard' },
  { to: '/mon-espace/mes-billets', label: t('header.myTickets'), icon: 'ticket' },
  { to: '/mon-espace/liste-attente', label: t('waitlistPage.title'), icon: 'clock' },
  { to: '/mon-espace/mes-commandes', label: t('placeholderPages.myOrders'), icon: 'receipt' },
  { to: '/mon-espace/portefeuille', label: t('header.wallet'), icon: 'wallet' },
  { to: '/mon-espace/mes-favoris', label: t('header.favorites'), icon: 'heart' },
  { to: '/mon-espace/notifications', label: t('header.notifications'), icon: 'bell', badge: unreadCount.value || null },
  { to: '/mon-espace/profil', label: t('header.profile'), icon: 'user' },
  { to: '/mon-espace/parametres', label: t('header.settings'), icon: 'settings' },
])

// Sur mobile, la pastille active est ramenée dans la zone visible.
const listRef = ref<HTMLElement | null>(null)
onMounted(() => {
  nextTick(() => {
    const el = listRef.value?.querySelector<HTMLElement>('[aria-current="page"]')
    el?.scrollIntoView({ block: 'nearest', inline: 'center' })
  })
})
</script>

<template>
  <nav class="border-b border-tikeo-border bg-tikeo-surface" :aria-label="t('account.navLabel')">
    <div class="mx-auto max-w-tikeo-container px-4 py-3.5 md:px-6">
      <ul ref="listRef" class="no-scrollbar flex gap-2 overflow-x-auto">
        <li v-for="link in links" :key="link.to" class="shrink-0">
          <NuxtLink
            :to="link.to"
            :aria-current="route.path === link.to ? 'page' : undefined"
            class="flex h-11 items-center gap-2 border px-4 text-sm font-semibold transition-colors duration-200"
            :class="
              route.path === link.to
                ? 'border-tikeo-ink bg-tikeo-ink text-white dark:border-[#FF7A00] dark:bg-[#FF7A00] dark:text-tikeo-ink'
                : 'border-tikeo-border bg-tikeo-surface text-tikeo-black hover:border-tikeo-ink dark:hover:border-[#FF7A00]'
            "
          >
            <AppIcon :name="link.icon" class="h-[18px] w-[18px]" />
            {{ link.label }}
            <span v-if="link.badge" class="flex h-5 min-w-5 items-center justify-center bg-[#FF7A00] px-1.5 text-[11px] font-bold text-tikeo-ink">
              {{ link.badge }}
            </span>
          </NuxtLink>
        </li>
      </ul>
    </div>
  </nav>
</template>
