<script setup lang="ts">
definePageMeta({ layout: 'organisateur', middleware: 'organizer' })
import type { EventRecord, Order } from '~/types/database'

const { t, locale } = useI18n()
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
  draft: 'bg-tikeo-surface-alt text-tikeo-gray-text',
  published: 'bg-tikeo-success/10 text-tikeo-success is-live',
  paused: 'bg-yellow-500/10 text-yellow-600',
  sold_out: 'bg-tikeo-blue/10 text-tikeo-blue',
  completed: 'bg-tikeo-surface-alt text-tikeo-gray-text',
  cancelled: 'bg-tikeo-error/10 text-tikeo-error',
}

// Jour / mois pour le « talon » de date des événements récents
function dayOf(date: string) {
  return new Date(date).toLocaleDateString(locale.value, { day: '2-digit' })
}
function monthOf(date: string) {
  return new Date(date).toLocaleDateString(locale.value, { month: 'short' }).replace('.', '')
}

const paidOrders = computed(() => orders.value.filter((o) => o.status === 'paid'))

const counts = computed(() => ({
  total: events.value.length,
  // « Publiés » = publiés ET encore à venir (un événement terminé n'est plus en ligne)
  published: events.value.filter((e) => e.status === 'published' && !isEventPast(e.start_date, e.end_date)).length,
  past: events.value.filter((e) => isEventPast(e.start_date, e.end_date)).length,
  draft: events.value.filter((e) => e.status === 'draft').length,
  revenue: paidOrders.value.reduce((sum, o) => sum + Math.max(Number(o.subtotal || 0) - Number(o.discount || 0) - (o.commission_payer === 'buyer' ? 0 : Number(o.commission_amount || 0)), 0), 0),
  pendingOrders: orders.value.filter((o) => o.status === 'pending').length,
}))

const nextEvent = computed(() => {
  const now = Date.now()
  return events.value
    .filter((e) => e.status === 'published' && !isEventPast(e.start_date, e.end_date, now))
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())[0]
})

// Les 5 derniers événements créés ; les événements passés sont signalés par un badge
const recentEvents = computed(() => events.value.slice(0, 5))

const quickLinks = computed(() => [
  { to: '/organisateur/evenements/nouveau', label: t('organizerDashboard.quickCreate'), icon: 'plus', highlight: true },
  { to: '/organisateur/evenements', label: t('organizerDashboard.quickMyEvents'), icon: 'calendar' },
  { to: '/organisateur/evenements/scanner', label: t('organizerDashboard.quickScanner'), icon: 'scan' },
  { to: '/organisateur/revenus', label: t('organizerDashboard.quickRevenue'), icon: 'wallet' },
])

function formatFcfa(amount: number) {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(locale.value, { day: '2-digit', month: 'short', year: 'numeric' })
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
  <div>
    <OrgPageHeader
      :eyebrow="t('organizerNav.fallbackTitle')"
      :title="t('organizerDashboard.greeting', { name: profile?.full_name || t('organizerDashboard.defaultName') })"
      :subtitle="t('organizerDashboard.subtitle')"
    >
      <template #actions>
        <NuxtLink to="/organisateur/evenements/nouveau" class="btn-brand group max-sm:w-full">
          <AppIcon name="plus" class="h-[18px] w-[18px] transition-transform duration-300 group-hover:rotate-90" :stroke="2.4" />
          {{ t('organizerDashboard.quickCreate') }}
        </NuxtLink>
      </template>

      <!-- Chiffres clés dans le hero -->
      <template #stats>
        <div v-if="loading" class="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div v-for="i in 4" :key="i" class="h-24 animate-pulse border border-white/10 bg-white/5" />
        </div>
        <div v-else class="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div v-for="(stat, i) in [
            { label: t('organizerDashboard.statEvents'), value: counts.total, icon: 'calendar', tone: 'text-white' },
            { label: t('organizerDashboard.statPublished'), value: counts.published, icon: 'trending', tone: 'text-[#4ADE80]' },
            { label: t('organizerDashboard.statDraft'), value: counts.draft, icon: 'edit', tone: 'text-white' },
            { label: t('organizerDashboard.statRevenue'), value: counts.revenue, icon: 'wallet', tone: 'text-[#FF9A3D]', money: true },
          ]" :key="stat.label" class="org-pop group border border-white/15 bg-white/5 p-4 backdrop-blur-sm transition-colors duration-300 hover:border-[#FF7A00]/70 hover:bg-white/10" :style="`--i: ${i + 2}`">
            <div class="flex items-center justify-between">
              <p class="text-[11px] font-bold uppercase tracking-wider text-white/60">{{ stat.label }}</p>
              <AppIcon :name="stat.icon" class="h-4 w-4 text-white/40 transition-all duration-300 group-hover:scale-125 group-hover:text-[#FF7A00]" />
            </div>
            <p class="mt-2 font-display font-extrabold leading-none" :class="[stat.tone, stat.money ? 'text-xl sm:text-2xl' : 'text-3xl md:text-4xl']">
              <OrgCountUp :value="stat.value" :suffix="stat.money ? ' FCFA' : ''" />
            </p>
          </div>
        </div>
      </template>
    </OrgPageHeader>

    <div class="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
      <p v-if="errorMessage" class="acc-alert-error mb-6">{{ errorMessage }}</p>

      <!-- Raccourcis -->
      <div class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NuxtLink
          v-for="(link, i) in quickLinks"
          :key="link.to"
          :to="link.to"
          class="org-rise org-card-hover group flex flex-col items-center justify-center gap-2.5 border bg-tikeo-surface py-5 text-center"
          :class="link.highlight ? 'border-[#FF7A00]/50' : 'border-tikeo-border'"
          :style="`--i: ${i}`"
        >
          <span
            class="flex h-11 w-11 items-center justify-center transition-all duration-300 group-hover:scale-110"
            :class="link.highlight ? 'bg-[#FF7A00] text-tikeo-ink' : 'bg-tikeo-surface-alt text-tikeo-black group-hover:bg-tikeo-ink group-hover:text-white dark:group-hover:bg-[#FF7A00] dark:group-hover:text-tikeo-ink'"
          >
            <AppIcon :name="link.icon" class="h-5 w-5" />
          </span>
          <span class="text-sm font-bold text-tikeo-black">{{ link.label }}</span>
        </NuxtLink>
      </div>

      <div v-if="loading" class="space-y-3">
        <div class="org-skeleton h-16" />
        <div v-for="i in 4" :key="i" class="org-skeleton h-[72px]" />
      </div>

      <template v-else>
        <!-- Prochain événement -->
        <div v-if="nextEvent" class="org-rise relative mb-8 flex items-center justify-between gap-4 overflow-hidden border border-[#FF7A00]/40 bg-[#FF7A00]/5 px-4 py-4 md:px-6" style="--i: 3">
          <span class="absolute inset-y-0 left-0 w-1 bg-[#FF7A00]" aria-hidden="true" />
          <div class="flex min-w-0 items-center gap-4">
            <span class="hidden h-12 w-12 shrink-0 items-center justify-center bg-tikeo-ink text-white sm:flex dark:bg-[#FF7A00] dark:text-tikeo-ink"><AppIcon name="clock" class="h-6 w-6" /></span>
            <div class="min-w-0">
              <p class="text-[11px] font-bold uppercase tracking-wider text-tikeo-orange">{{ t('organizerDashboard.nextEventLabel') }}</p>
              <p class="truncate font-display text-base font-extrabold text-tikeo-black md:text-lg">{{ nextEvent.title }} <span class="font-semibold text-tikeo-gray-text">· {{ formatDate(nextEvent.start_date) }}</span></p>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <OrgIconButton icon="scan" :label="t('organizerNav.scanner')" :to="`/organisateur/evenements/scanner?event=${nextEvent.id}`" />
            <NuxtLink to="/organisateur/evenements" class="acc-link group inline-flex items-center gap-1.5">
              {{ t('organizerDashboard.manageLink') }}
              <AppIcon name="arrow-right" class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </NuxtLink>
          </div>
        </div>

        <!-- Événements récents -->
        <div class="mb-4 flex items-center justify-between">
          <h2 class="acc-h2">{{ t('organizerDashboard.recentEventsTitle') }}</h2>
          <NuxtLink to="/organisateur/evenements" class="acc-link">{{ t('organizerDashboard.viewAll') }}</NuxtLink>
        </div>

        <div v-if="events.length === 0" class="acc-empty org-pop">
          <span class="flex h-14 w-14 items-center justify-center bg-tikeo-surface-alt text-tikeo-gray-text"><AppIcon name="calendar-plus" class="h-7 w-7" /></span>
          <p class="text-sm text-tikeo-gray-text">{{ t('organizerDashboard.noEvents') }}</p>
          <NuxtLink to="/organisateur/evenements/nouveau" class="btn-ink">{{ t('organizerDashboard.createOne') }}</NuxtLink>
        </div>
        <ul v-else class="space-y-2.5">
          <li v-for="(event, i) in recentEvents" :key="event.id" class="org-rise" :style="`--i: ${i + 4}`">
            <NuxtLink
              to="/organisateur/evenements"
              class="org-card-hover group flex items-stretch border border-tikeo-border bg-tikeo-surface"
              :class="isEventPast(event.start_date, event.end_date) ? 'opacity-80' : ''"
            >
              <!-- Talon de date -->
              <div class="relative flex w-16 shrink-0 flex-col items-center justify-center border-r border-dashed border-tikeo-border bg-tikeo-surface-alt py-3 md:w-20">
                <span class="font-display text-2xl font-extrabold leading-none text-tikeo-black md:text-3xl">{{ dayOf(event.start_date) }}</span>
                <span class="mt-1 text-[11px] font-bold uppercase tracking-wider text-tikeo-orange">{{ monthOf(event.start_date) }}</span>
              </div>
              <div class="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3">
                <div class="min-w-0">
                  <p class="truncate font-display text-base font-extrabold text-tikeo-black">{{ event.title }}</p>
                  <p class="mt-0.5 flex items-center gap-1 truncate text-xs text-tikeo-gray-text">
                    <AppIcon v-if="event.city" name="pin" class="h-3.5 w-3.5 shrink-0" />
                    {{ event.city || formatDate(event.start_date) }}
                  </p>
                </div>
                <div class="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  <span v-if="isEventPast(event.start_date, event.end_date)" class="org-status bg-tikeo-surface-alt text-tikeo-gray-text max-sm:hidden">{{ t('organizerEvents.pastBadge') }}</span>
                  <span class="org-status" :class="statusColors[event.status]">{{ statusLabels[event.status] }}</span>
                  <AppIcon name="chevron-right" class="hidden h-4 w-4 text-tikeo-gray-text transition-transform duration-300 group-hover:translate-x-1 sm:block" />
                </div>
              </div>
            </NuxtLink>
          </li>
        </ul>

        <!-- Commandes en attente -->
        <p v-if="counts.pendingOrders > 0" class="acc-alert-info org-rise mt-6 flex flex-wrap items-center gap-x-2" style="--i: 9">
          <AppIcon name="info" class="h-4 w-4 shrink-0" />
          {{ pendingOrdersLabel(counts.pendingOrders) }}
          <NuxtLink to="/organisateur/revenus" class="font-bold underline underline-offset-4">{{ t('organizerDashboard.viewDetails') }}</NuxtLink>
        </p>
      </template>
    </div>
  </div>
</template>
