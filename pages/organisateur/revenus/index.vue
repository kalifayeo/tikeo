<script setup lang="ts">
definePageMeta({ layout: 'organisateur', middleware: 'organizer' })
import type { EventRecord, Order } from '~/types/database'

const { t } = useI18n()
const supabase = useSupabase()
const { ensureOrganizer } = useOrganizer()

const loading = ref(true)
const errorMessage = ref('')
const events = ref<EventRecord[]>([])
const orders = ref<Order[]>([])

const paidOrders = computed(() => orders.value.filter((o) => o.status === 'paid'))

// Ventes = prix des billets (hors frais de service payés par l'acheteur).
// La commission n'est déduite que si elle est à la charge de l'organisateur
// (commission_payer = 'organizer', migration 0047).
const saleAmount = (o: Order) => Math.max(Number(o.subtotal || 0) - Number(o.discount || 0), 0)
const organizerFee = (o: Order) => (o.commission_payer === 'buyer' ? 0 : Number(o.commission_amount || 0))

const totals = computed(() => {
  const revenue = paidOrders.value.reduce((sum, o) => sum + saleAmount(o), 0)
  const commission = paidOrders.value.reduce((sum, o) => sum + organizerFee(o), 0)
  return {
    revenue,
    commission,
    net: revenue - commission,
    orders: paidOrders.value.length,
    pending: orders.value.filter((o) => o.status === 'pending').length,
  }
})

// Ventilation par événement, triée par revenu décroissant
const perEvent = computed(() => {
  return events.value
    .map((event) => {
      const eventOrders = paidOrders.value.filter((o) => o.event_id === event.id)
      return {
        event,
        revenue: eventOrders.reduce((sum, o) => sum + saleAmount(o) - organizerFee(o), 0),
        orders: eventOrders.length,
      }
    })
    .filter((row) => row.orders > 0)
    .sort((a, b) => b.revenue - a.revenue)
})

function orderCountLabel(n: number) {
  return t(n > 1 ? 'organizerRevenue.orderCountMany' : 'organizerRevenue.orderCountOne', { n })
}

function formatFcfa(amount: number) {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const organizer = await ensureOrganizer()
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('organizer_id', organizer!.id)
    if (eventsError) throw eventsError
    events.value = (eventsData as unknown as EventRecord[]) ?? []

    const eventIds = events.value.map((e) => e.id)
    if (eventIds.length > 0) {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .in('event_id', eventIds)
        .order('created_at', { ascending: false })
      if (ordersError) throw ordersError
      orders.value = (ordersData as unknown as Order[]) ?? []
    }
  } catch (e: any) {
    errorMessage.value = e?.message || t('organizerRevenue.loadError')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div>
    <OrgPageHeader :eyebrow="t('organizerNav.fallbackTitle')" :title="t('organizerRevenue.title')" icon="wallet">
      <template #stats>
        <div v-if="loading" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="i in 3" :key="i" class="h-24 animate-pulse border border-white/10 bg-white/5" />
        </div>
        <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="(stat, i) in [
            { label: t('organizerRevenue.grossRevenueLabel'), value: totals.revenue, tone: 'text-[#4ADE80]', icon: 'trending', money: true },
            { label: t('organizerRevenue.commissionLabel'), value: totals.commission, tone: 'text-[#FF9A3D]', icon: 'tag', money: true },
            { label: t('organizerRevenue.netRevenueLabel'), value: totals.net, tone: 'text-[#4ADE80]', icon: 'wallet', money: true },
            { label: t('organizerRevenue.paidOrdersLabel'), value: totals.orders, tone: 'text-white', icon: 'check' },
            { label: t('organizerRevenue.pendingOrdersLabel'), value: totals.pending, tone: 'text-[#FF9A3D]', icon: 'clock' },
          ]" :key="stat.label" class="org-pop group border border-white/15 bg-white/5 p-4 transition-colors duration-300 hover:border-[#FF7A00]/70 hover:bg-white/10" :style="`--i: ${i + 2}`">
            <div class="flex items-center justify-between">
              <p class="text-[11px] font-bold uppercase tracking-wider text-white/60">{{ stat.label }}</p>
              <AppIcon :name="stat.icon" class="h-4 w-4 text-white/40 transition-all duration-300 group-hover:scale-125 group-hover:text-[#FF7A00]" />
            </div>
            <p class="mt-2 font-display font-extrabold leading-none" :class="[stat.tone, stat.money ? 'text-2xl md:text-3xl' : 'text-3xl md:text-4xl']">
              <OrgCountUp :value="stat.value" :suffix="stat.money ? ' FCFA' : ''" />
            </p>
          </div>
        </div>
      </template>
    </OrgPageHeader>

    <div class="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
      <p v-if="errorMessage" class="acc-alert-error mb-5">{{ errorMessage }}</p>

      <h2 class="acc-h2 mb-4">{{ t('organizerRevenue.perEventTitle') }}</h2>

      <div v-if="loading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="org-skeleton h-[72px]" />
      </div>
      <div v-else-if="perEvent.length === 0" class="acc-empty org-pop">
        <span class="flex h-14 w-14 items-center justify-center bg-tikeo-surface-alt text-tikeo-gray-text"><AppIcon name="wallet" class="h-7 w-7" /></span>
        <p class="text-sm text-tikeo-gray-text">{{ t('organizerRevenue.noSales') }}</p>
      </div>
      <ul v-else class="space-y-2.5">
        <li v-for="(row, i) in perEvent" :key="row.event.id" class="org-rise org-card-hover relative overflow-hidden border border-tikeo-border bg-tikeo-surface" :style="`--i: ${i}`">
          <div class="flex items-center gap-4 p-4">
            <span class="flex h-11 w-11 shrink-0 items-center justify-center font-display text-lg font-extrabold" :class="i === 0 ? 'bg-[#FF7A00] text-tikeo-ink' : 'bg-tikeo-surface-alt text-tikeo-black'">{{ i + 1 }}</span>
            <div class="min-w-0 flex-1">
              <p class="truncate font-display text-base font-extrabold text-tikeo-black">{{ row.event.title }}</p>
              <p class="text-xs text-tikeo-gray-text">{{ orderCountLabel(row.orders) }}</p>
            </div>
            <p class="shrink-0 font-display text-base font-extrabold text-tikeo-black md:text-lg">{{ formatFcfa(row.revenue) }}</p>
          </div>
          <!-- Part du revenu total -->
          <div class="h-1 bg-tikeo-surface-alt">
            <div class="org-line h-full bg-tikeo-brand" :style="`width: ${totals.net ? Math.max(3, (row.revenue / totals.net) * 100) : 0}%`" />
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
