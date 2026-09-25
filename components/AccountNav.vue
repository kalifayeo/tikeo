<script setup lang="ts">
// Onglets de l'espace acheteur (§10 du cahier des charges). "Portefeuille"
// n'y figure pas : ce n'est pas une page prévue par le cahier des charges
// pour les acheteurs (§8.2) et n'est donc pas listée ici, en attendant une
// décision sur cette fonctionnalité.
const { t } = useI18n()
const route = useRoute()
const { unreadCount } = useMyNotifications()

const links = computed(() => [
  { to: '/mon-espace/tableau-de-bord', label: t('header.dashboard') },
  { to: '/mon-espace/mes-billets', label: t('header.myTickets') },
  { to: '/mon-espace/mes-commandes', label: t('placeholderPages.myOrders') },
  { to: '/mon-espace/mes-favoris', label: t('header.favorites') },
  { to: '/mon-espace/notifications', label: t('header.notifications'), badge: unreadCount.value || null },
  { to: '/mon-espace/profil', label: t('header.profile') },
  { to: '/mon-espace/parametres', label: t('header.settings') },
])
</script>

<template>
  <nav class="mb-6 -mx-4 overflow-x-auto border-b border-tikeo-border px-4 md:mx-0 md:px-0">
    <ul class="flex min-w-max gap-1 md:gap-2">
      <li v-for="link in links" :key="link.to">
        <NuxtLink
          :to="link.to"
          class="flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition"
          :class="
            route.path === link.to
              ? 'border-tikeo-orange text-tikeo-orange'
              : 'border-transparent text-tikeo-gray-text hover:text-tikeo-black'
          "
        >
          {{ link.label }}
          <span v-if="link.badge" class="flex h-4 min-w-4 items-center justify-center rounded-full bg-tikeo-orange px-1 text-[10px] font-bold text-white">
            {{ link.badge }}
          </span>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
