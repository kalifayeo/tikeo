<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const { profile } = useAuth()
const { orders, loading: ordersLoading } = useMyOrders()
const { tickets, loading: ticketsLoading } = useMyTickets()
const { favoriteIds } = useFavorites()

const loading = computed(() => ordersLoading.value || ticketsLoading.value)
const validTicketsCount = computed(() => tickets.value.filter((tk) => tk.status === 'valid').length)

const upcomingTickets = computed(() =>
  tickets.value
    .filter((tk) => tk.status === 'valid' && tk.event && new Date(tk.event.start_date) >= new Date())
    .sort((a, b) => new Date(a.event!.start_date).getTime() - new Date(b.event!.start_date).getTime())
    .slice(0, 3)
)

const recentOrders = computed(() => orders.value.slice(0, 3))

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="mx-auto max-w-tikeo-container px-4 py-6 md:px-6">
    <AccountNav />

    <h1 class="mb-1 text-xl font-bold text-tikeo-black">{{ t('placeholderPages.dashboard') }}</h1>
    <p class="mb-6 text-sm text-tikeo-gray-text">{{ t('buyerDashboard.welcome', { name: profile?.full_name || '' }) }}</p>

    <div class="grid grid-cols-3 gap-3">
      <div class="border border-tikeo-border bg-tikeo-surface p-4 text-center">
        <p class="text-2xl font-bold text-tikeo-black">{{ loading ? '—' : validTicketsCount }}</p>
        <p class="text-xs text-tikeo-gray-text">{{ t('buyerDashboard.statTickets') }}</p>
      </div>
      <div class="border border-tikeo-border bg-tikeo-surface p-4 text-center">
        <p class="text-2xl font-bold text-tikeo-black">{{ loading ? '—' : orders.length }}</p>
        <p class="text-xs text-tikeo-gray-text">{{ t('buyerDashboard.statOrders') }}</p>
      </div>
      <div class="border border-tikeo-border bg-tikeo-surface p-4 text-center">
        <p class="text-2xl font-bold text-tikeo-black">{{ favoriteIds.length }}</p>
        <p class="text-xs text-tikeo-gray-text">{{ t('buyerDashboard.statFavorites') }}</p>
      </div>
    </div>

    <div class="mt-8">
      <h2 class="mb-3 text-sm font-semibold text-tikeo-black">{{ t('buyerDashboard.upcomingTitle') }}</h2>
      <div v-if="loading" class="h-16 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
      <p v-else-if="upcomingTickets.length === 0" class="border border-dashed border-tikeo-border p-6 text-center text-sm text-tikeo-gray-text">
        {{ t('buyerDashboard.noUpcoming') }}
      </p>
      <ul v-else class="divide-y divide-tikeo-border border border-tikeo-border">
        <li v-for="tk in upcomingTickets" :key="tk.id" class="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p class="text-sm font-semibold text-tikeo-black">{{ tk.event?.title }}</p>
            <p class="text-xs text-tikeo-gray-text">{{ formatDate(tk.event!.start_date) }} · {{ tk.event?.city }}</p>
          </div>
          <NuxtLink :to="`/e/${tk.event?.slug}`" class="text-xs font-semibold text-tikeo-orange">{{ t('buyerOrders.viewEvent') }}</NuxtLink>
        </li>
      </ul>
    </div>

    <div class="mt-8">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-tikeo-black">{{ t('buyerDashboard.recentOrdersTitle') }}</h2>
        <NuxtLink to="/mon-espace/mes-commandes" class="text-xs font-semibold text-tikeo-orange">{{ t('home.seeAll') }}</NuxtLink>
      </div>
      <div v-if="loading" class="h-16 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
      <p v-else-if="recentOrders.length === 0" class="border border-dashed border-tikeo-border p-6 text-center text-sm text-tikeo-gray-text">
        {{ t('buyerDashboard.noOrders') }}
      </p>
      <ul v-else class="divide-y divide-tikeo-border border border-tikeo-border">
        <li v-for="order in recentOrders" :key="order.id" class="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p class="text-sm font-semibold text-tikeo-black">{{ order.event?.title || order.order_number }}</p>
            <p class="text-xs text-tikeo-gray-text">{{ formatDate(order.created_at) }} · {{ t(`orderStatus.${order.status}`) }}</p>
          </div>
          <p class="text-sm font-semibold text-tikeo-black">{{ order.total.toLocaleString('fr-FR') }} FCFA</p>
        </li>
      </ul>
    </div>

    <NuxtLink to="/evenements" class="btn-primary mt-8 inline-flex">{{ t('common.browseEvents') }}</NuxtLink>
  </div>
</template>
