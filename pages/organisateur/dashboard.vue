<script setup lang="ts">
definePageMeta({ layout: 'organisateur', middleware: 'organizer' })
import type { EventRecord, Order } from '~/types/database'

const { t } = useI18n()
const supabase = useSupabase()
const { ensureOrganizer } = useOrganizer()
const { profile } = useAuth()

const loading = ref(true)
const errorMessage = ref('')
const events = ref<EventRecord[]>([])
const orders = ref<Order[]>([])

const statusLabels = computed<Record<string, string>>(() => ({
  draft: t('eventStatus.draft'),
  published: t('eventStatus.published'),
  paused: t('eventStatus.paused'),
  sold_out: t('eventStatus.soldOut'),
  completed: t('eventStatus.completed'),
  cancelled: t('eventStatus.cancelled'),
}))
const statusColors: Record<string, string> = {
  draft: 'bg-tikeo-gray-light text-tikeo-gray-text',
  published: 'bg-tikeo-success/10 text-tikeo-success',
  paused: 'bg-yellow-500/10 text-yellow-600',
  sold_out: 'bg-tikeo-blue/10 text-tikeo-blue',
  completed: 'bg-tikeo-gray-light text-tikeo-gray-text',
  cancelled: 'bg-tikeo-error/10 text-tikeo-error',
}

const paidOrders = computed(() => orders.value.filter((o) => o.status === 'paid'))

const counts = computed(() => ({
  total: events.value.length,
  published: events.value.filter((e) => e.status === 'published').length,
  draft: events.value.filter((e) => e.status === 'draft').length,
  revenue: paidOrders.value.reduce((sum, o) => sum + Number(o.total || 0), 0),
  pendingOrders: orders.value.filter((o) => o.status === 'pending').length,
}))

const nextEvent = computed(() => {
  const now = Date.now()
  return events.value
    .filter((e) => e.status === 'published' && new Date(e.start_date).getTime() >= now)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())[0]
})

const recentEvents = computed(() => events.value.slice(0, 5))

const quickLinks = computed(() => [
  { to: '/organisateur/evenements/nouveau', label: t('organizerDashboard.quickCreate'), icon: 'M12 4v16m8-8H4', highlight: true },
  { to: '/organisateur/evenements', label: t('organizerDashboard.quickMyEvents'), icon: 'M8 7V3M16 7V3M4 5h16a1 1 0 011 1v13a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z' },
  { to: '/organisateur/evenements/scanner', label: t('organizerDashboard.quickScanner'), icon: 'M4 4h4v4H4V4zm10 0h4v4h-4V4zM4 14h4v4H4v-4zm10 2h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm4 0h2v2h-2v-2zm0-8h2v2h-2v-2z' },
  { to: '/organisateur/revenus', label: t('organizerDashboard.quickRevenue'), icon: 'M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM3 10h18M16 15h2' },
])

function formatFcfa(amount: number) {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function pendingOrdersLabel(n: number) {
  return t(n > 1 ? 'organizerDashboard.pendingOrdersMany' : 'organizerDashboard.pendingOrdersOne', { n })
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const organizer = await ensureOrganizer()
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('organizer_id', organizer!.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    events.value = (data as unknown as EventRecord[]) ?? []

    const eventIds = events.value.map((e) => e.id)
    if (eventIds.length > 0) {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .in('event_id', eventIds)
      if (ordersError) throw ordersError
      orders.value = (ordersData as unknown as Order[]) ?? []
    }
  } catch (e: any) {
    errorMessage.value = e?.message || t('organizerDashboard.loadError')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8 md:px-6">
    <div class="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-xl font-bold text-tikeo-black">{{ t('organizerDashboard.greeting', { name: profile?.full_name || t('organizerDashboard.defaultName') }) }}</h1>
        <p class="text-sm text-tikeo-gray-text">{{ t('organizerDashboard.subtitle') }}</p>
      </div>
      <NuxtLink to="/organisateur/evenements/nouveau" class="btn-primary hidden sm:inline-flex">{{ t('organizerDashboard.createButton') }}</NuxtLink>
    </div>

    <p v-if="errorMessage" class="mb-4 border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{{ errorMessage }}</p>

    <!-- Raccourcis -->
    <div class="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      <NuxtLink
        v-for="link in quickLinks"
        :key="link.to"
        :to="link.to"
        class="flex flex-col items-center justify-center gap-1.5 border border-tikeo-border bg-tikeo-surface py-4 text-center transition hover:border-tikeo-orange/40"
        :class="link.highlight ? 'bg-tikeo-orange/10 text-tikeo-orange' : 'text-tikeo-black'"
      >
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6">
          <path stroke-linecap="round" stroke-linejoin="round" :d="link.icon" />
        </svg>
        <span class="text-xs font-medium">{{ link.label }}</span>
      </NuxtLink>
    </div>

    <div v-if="loading" class="space-y-6">
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div v-for="i in 4" :key="i" class="h-20 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
      </div>
      <div class="space-y-2">
        <div v-for="i in 3" :key="'r' + i" class="h-16 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
      </div>
    </div>

    <template v-else>
      <!-- Bannière : prochain événement publié -->
      <div v-if="nextEvent" class="mb-6 flex items-center justify-between gap-3 border border-tikeo-orange/30 bg-tikeo-orange/5 px-4 py-3">
        <div class="min-w-0">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-tikeo-orange">{{ t('organizerDashboard.nextEventLabel') }}</p>
          <p class="truncate text-sm font-semibold text-tikeo-black">{{ nextEvent.title }} · {{ formatDate(nextEvent.start_date) }}</p>
        </div>
        <NuxtLink to="/organisateur/evenements" class="shrink-0 text-xs font-semibold text-tikeo-orange">{{ t('organizerDashboard.manageLink') }}</NuxtLink>
      </div>

      <!-- Cartes statistiques -->
      <div class="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div class="border border-tikeo-border bg-tikeo-surface p-4">
          <p class="text-xs text-tikeo-gray-text">{{ t('organizerDashboard.statEvents') }}</p>
          <p class="text-2xl font-bold text-tikeo-black">{{ counts.total }}</p>
        </div>
        <div class="border border-tikeo-border bg-tikeo-surface p-4">
          <p class="text-xs text-tikeo-gray-text">{{ t('organizerDashboard.statPublished') }}</p>
          <p class="text-2xl font-bold text-tikeo-success">{{ counts.published }}</p>
        </div>
        <div class="border border-tikeo-border bg-tikeo-surface p-4">
          <p class="text-xs text-tikeo-gray-text">{{ t('organizerDashboard.statDraft') }}</p>
          <p class="text-2xl font-bold text-tikeo-gray-text">{{ counts.draft }}</p>
        </div>
        <div class="border border-tikeo-border bg-tikeo-surface p-4">
          <p class="text-xs text-tikeo-gray-text">{{ t('organizerDashboard.statRevenue') }}</p>
          <p class="text-lg font-bold text-tikeo-orange sm:text-xl">{{ formatFcfa(counts.revenue) }}</p>
        </div>
      </div>

      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-tikeo-black">{{ t('organizerDashboard.recentEventsTitle') }}</h2>
        <NuxtLink to="/organisateur/evenements" class="text-xs font-semibold text-tikeo-orange">{{ t('organizerDashboard.viewAll') }}</NuxtLink>
      </div>

      <div v-if="events.length === 0" class="border border-dashed border-tikeo-border p-8 text-center text-sm text-tikeo-gray-text">
        {{ t('organizerDashboard.noEvents') }}
        <NuxtLink to="/organisateur/evenements/nouveau" class="font-semibold text-tikeo-orange">{{ t('organizerDashboard.createOne') }}</NuxtLink>
      </div>
      <div v-else class="divide-y divide-tikeo-border border border-tikeo-border">
        <NuxtLink
          v-for="event in recentEvents"
          :key="event.id"
          to="/organisateur/evenements"
          class="flex items-center justify-between gap-3 p-3 hover:bg-tikeo-gray-light"
        >
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-tikeo-black">{{ event.title }}</p>
            <p class="text-xs text-tikeo-gray-text">
              {{ formatDate(event.start_date) }}<span v-if="event.city"> · {{ event.city }}</span>
            </p>
          </div>
          <span class="shrink-0 px-2 py-1 text-[11px] font-semibold" :class="statusColors[event.status]">{{ statusLabels[event.status] }}</span>
        </NuxtLink>
      </div>

      <!-- Commandes en attente : signal utile s'il y a un souci de paiement -->
      <p v-if="counts.pendingOrders > 0" class="mt-4 text-xs text-tikeo-gray-text">
        {{ pendingOrdersLabel(counts.pendingOrders) }}
        <NuxtLink to="/organisateur/revenus" class="font-semibold text-tikeo-orange">{{ t('organizerDashboard.viewDetails') }}</NuxtLink>
      </p>
    </template>
  </div>
</template>
