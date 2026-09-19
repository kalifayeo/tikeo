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

const totals = computed(() => ({
  revenue: paidOrders.value.reduce((sum, o) => sum + Number(o.total || 0), 0),
  orders: paidOrders.value.length,
  pending: orders.value.filter((o) => o.status === 'pending').length,
}))

// Ventilation par événement, triée par revenu décroissant
const perEvent = computed(() => {
  return events.value
    .map((event) => {
      const eventOrders = paidOrders.value.filter((o) => o.event_id === event.id)
      return {
        event,
        revenue: eventOrders.reduce((sum, o) => sum + Number(o.total || 0), 0),
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
  <div class="mx-auto max-w-5xl px-4 py-8 md:px-6">
    <h1 class="mb-6 text-xl font-bold text-tikeo-black">{{ t('organizerRevenue.title') }}</h1>

    <p v-if="errorMessage" class="mb-4 border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{{ errorMessage }}</p>

    <div v-if="loading" class="space-y-3">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div v-for="i in 3" :key="i" class="h-20 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
      </div>
      <div v-for="i in 3" :key="'r' + i" class="h-14 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>

    <template v-else>
      <!-- Cartes de synthèse -->
      <div class="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="border border-tikeo-border bg-tikeo-surface p-4">
          <p class="text-xs text-tikeo-gray-text">{{ t('organizerRevenue.grossRevenueLabel') }}</p>
          <p class="mt-1 text-2xl font-bold text-tikeo-success">{{ formatFcfa(totals.revenue) }}</p>
        </div>
        <div class="border border-tikeo-border bg-tikeo-surface p-4">
          <p class="text-xs text-tikeo-gray-text">{{ t('organizerRevenue.paidOrdersLabel') }}</p>
          <p class="mt-1 text-2xl font-bold text-tikeo-black">{{ totals.orders }}</p>
        </div>
        <div class="border border-tikeo-border bg-tikeo-surface p-4">
          <p class="text-xs text-tikeo-gray-text">{{ t('organizerRevenue.pendingOrdersLabel') }}</p>
          <p class="mt-1 text-2xl font-bold text-tikeo-gray-text">{{ totals.pending }}</p>
        </div>
      </div>

      <h2 class="mb-3 text-sm font-semibold text-tikeo-black">{{ t('organizerRevenue.perEventTitle') }}</h2>

      <div v-if="perEvent.length === 0" class="border border-dashed border-tikeo-border p-10 text-center text-sm text-tikeo-gray-text">
        {{ t('organizerRevenue.noSales') }}
      </div>
      <div v-else class="divide-y divide-tikeo-border border border-tikeo-border">
        <div v-for="row in perEvent" :key="row.event.id" class="flex items-center justify-between gap-3 p-4">
          <div class="min-w-0">
            <p class="truncate font-semibold text-tikeo-black">{{ row.event.title }}</p>
            <p class="text-xs text-tikeo-gray-text">{{ orderCountLabel(row.orders) }}</p>
          </div>
          <p class="shrink-0 font-bold text-tikeo-black">{{ formatFcfa(row.revenue) }}</p>
        </div>
      </div>
    </template>
  </div>
</template>
