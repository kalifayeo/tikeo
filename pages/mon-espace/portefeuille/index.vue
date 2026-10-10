<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const { t, locale } = useI18n()
const { orders, loading: ordersLoading, errorMessage } = useMyOrders()
const { tickets, loading: ticketsLoading } = useMyTickets()

const loading = computed(() => ordersLoading.value || ticketsLoading.value)

const sum = (list: { total: number }[]) => list.reduce((acc, o) => acc + (Number(o.total) || 0), 0)
const paidOrders = computed(() => orders.value.filter((o) => o.status === 'paid'))
const refundedOrders = computed(() => orders.value.filter((o) => o.status === 'refunded'))
const pendingCount = computed(() => orders.value.filter((o) => o.status === 'pending').length)
const totalSpent = computed(() => sum(paidOrders.value))
const totalRefunded = computed(() => sum(refundedOrders.value))

const validTickets = computed(() => tickets.value.filter((tk) => tk.status === 'valid'))
const upcomingTickets = computed(() =>
  validTickets.value
    .filter((tk) => tk.event && new Date(tk.event.start_date) >= new Date())
    .sort((a, b) => new Date(a.event!.start_date).getTime() - new Date(b.event!.start_date).getTime())
    .slice(0, 4)
)

// Transactions = commandes réellement payées ou remboursées (les commandes en attente / échouées n'ont pas bougé d'argent).
const transactions = computed(() => orders.value.filter((o) => o.status === 'paid' || o.status === 'refunded').slice(0, 6))

const money = (n: number) => n.toLocaleString(locale.value)
const stats = computed(() => [
  { icon: 'wallet', label: t('buyerWallet.spent'), value: loading.value ? '—' : money(totalSpent.value), unit: 'FCFA' },
  { icon: 'history', label: t('buyerWallet.refunded'), value: loading.value ? '—' : money(totalRefunded.value), unit: 'FCFA' },
  { icon: 'ticket', label: t('buyerWallet.tickets'), value: loading.value ? '—' : validTickets.value.length },
  { icon: 'receipt', label: t('buyerWallet.orders'), value: loading.value ? '—' : paidOrders.value.length },
])

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(locale.value, { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <AccountShell :title="t('placeholderPages.wallet')" :subtitle="t('buyerWallet.sub')" width="wide">
    <!-- Chiffres clés (dans le hero) -->
    <template #stats>
      <div class="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
        <div v-for="s in stats" :key="s.label" class="flex items-center gap-3 border border-white/15 bg-white/[0.06] p-3 md:p-4">
          <span class="hidden h-11 w-11 shrink-0 items-center justify-center bg-[#FF7A00] text-tikeo-ink sm:flex">
            <AppIcon :name="s.icon" class="h-5 w-5" />
          </span>
          <div class="min-w-0">
            <p class="truncate font-display text-xl font-extrabold leading-none md:text-3xl">
              {{ s.value }}<span v-if="s.unit && !loading" class="ml-1 text-[11px] font-semibold text-white/60 md:text-xs">{{ s.unit }}</span>
            </p>
            <p class="mt-1.5 truncate text-[10px] font-bold uppercase tracking-wider text-white/55 md:text-[11px]">{{ s.label }}</p>
          </div>
        </div>
      </div>
    </template>

    <p v-if="errorMessage" class="acc-alert-error mb-5">{{ errorMessage }}</p>
    <p v-if="!loading && pendingCount" class="mb-6 flex items-center gap-2 border-l-4 border-[#FF7A00] bg-[#FF7A00]/10 px-4 py-2.5 text-sm text-tikeo-black">
      <AppIcon name="clock" class="h-4 w-4 shrink-0 text-tikeo-orange" />
      {{ t('buyerWallet.pendingNote', { n: pendingCount }) }}
    </p>

    <div class="space-y-12">
      <!-- ============ Billets prêts pour l'entrée ============ -->
      <section>
        <div class="mb-5 flex items-end justify-between gap-3">
          <div class="max-w-xl">
            <h2 class="acc-h2">{{ t('buyerWallet.readyTitle') }}</h2>
            <p class="mt-1.5 text-sm text-tikeo-gray-text">{{ t('buyerWallet.readySub') }}</p>
          </div>
          <NuxtLink to="/mon-espace/mes-billets" class="acc-link shrink-0">{{ t('buyerWallet.seeTickets') }}</NuxtLink>
        </div>

        <div v-if="loading" class="space-y-3">
          <div v-for="i in 2" :key="i" class="h-20 animate-pulse bg-tikeo-border" />
        </div>
        <div v-else-if="upcomingTickets.length === 0" class="acc-empty">
          <span class="flex h-14 w-14 items-center justify-center bg-tikeo-ink text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">
            <AppIcon name="ticket" class="h-7 w-7" />
          </span>
          <p class="text-sm text-tikeo-gray-text">{{ t('buyerWallet.noReady') }}</p>
          <NuxtLink to="/evenements" class="btn-ink">{{ t('common.browseEvents') }}</NuxtLink>
        </div>
        <ul v-else class="grid gap-3 sm:grid-cols-2">
          <li v-for="tk in upcomingTickets" :key="tk.id">
            <NuxtLink
              to="/mon-espace/mes-billets"
              class="flex items-center gap-3 border border-tikeo-border bg-tikeo-surface p-3.5 transition-colors hover:border-[#FF7A00]"
            >
              <span class="flex h-11 w-11 shrink-0 items-center justify-center bg-tikeo-ink text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">
                <AppIcon name="qr" class="h-5 w-5" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-bold text-tikeo-black">{{ tk.event?.title }}</span>
                <span class="mt-0.5 block truncate text-xs text-tikeo-gray-text">
                  {{ formatDate(tk.event!.start_date) }}<template v-if="tk.ticket_type?.name"> · {{ tk.ticket_type.name }}</template>
                </span>
              </span>
              <AppIcon name="chevron-right" class="h-4 w-4 shrink-0 text-tikeo-gray-text" />
            </NuxtLink>
          </li>
        </ul>
      </section>

      <!-- ============ Dernières transactions ============ -->
      <section>
        <div class="mb-5 flex items-end justify-between gap-3">
          <div class="max-w-xl">
            <h2 class="acc-h2">{{ t('buyerWallet.txTitle') }}</h2>
            <p class="mt-1.5 text-sm text-tikeo-gray-text">{{ t('buyerWallet.txSub') }}</p>
          </div>
          <NuxtLink to="/mon-espace/mes-commandes" class="acc-link shrink-0">{{ t('buyerWallet.seeOrders') }}</NuxtLink>
        </div>

        <div v-if="loading" class="space-y-3">
          <div v-for="i in 3" :key="i" class="h-16 animate-pulse bg-tikeo-border" />
        </div>
        <div v-else-if="transactions.length === 0" class="acc-empty">
          <span class="flex h-14 w-14 items-center justify-center bg-tikeo-ink text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">
            <AppIcon name="wallet" class="h-7 w-7" />
          </span>
          <p class="text-sm text-tikeo-gray-text">{{ t('buyerWallet.noTx') }}</p>
        </div>
        <ul v-else class="divide-y divide-tikeo-border border border-tikeo-border bg-tikeo-surface">
          <li v-for="o in transactions" :key="o.id" class="flex items-center gap-3 p-3.5 md:p-4">
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center"
              :class="o.status === 'refunded' ? 'bg-tikeo-blue/10 text-tikeo-blue' : 'bg-tikeo-success/10 text-tikeo-success'"
            >
              <AppIcon :name="o.status === 'refunded' ? 'history' : 'card'" class="h-5 w-5" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-bold text-tikeo-black">{{ o.event?.title || t('buyerOrders.orderNumber', { number: o.order_number }) }}</p>
              <p class="mt-0.5 truncate text-xs text-tikeo-gray-text">
                <span class="font-mono">{{ o.order_number }}</span> · {{ formatDate(o.created_at) }}
              </p>
            </div>
            <div class="shrink-0 text-right">
              <p class="font-display text-base font-extrabold" :class="o.status === 'refunded' ? 'text-tikeo-blue' : 'text-tikeo-black'">
                {{ o.status === 'refunded' ? '+' : '−' }}{{ money(o.total) }} <span class="text-[11px] font-semibold text-tikeo-gray-text">FCFA</span>
              </p>
              <p class="text-[10px] font-bold uppercase tracking-wide text-tikeo-gray-text">
                {{ o.status === 'refunded' ? t('buyerWallet.refundTag') : t('buyerWallet.pay') }}
              </p>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </AccountShell>
</template>
