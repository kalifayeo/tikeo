<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const { t, locale } = useI18n()
const { profile } = useAuth()
const { unreadCount } = useMyNotifications()
const { orders, loading: ordersLoading, hideOrders } = useMyOrders()
const { tickets, loading: ticketsLoading, hideTickets } = useMyTickets()
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

const firstName = computed(() => (profile.value?.full_name || '').trim().split(/\s+/)[0] || '')

// Chiffres clés affichés dans le hero (chacun mène à sa page).
const stats = computed(() => [
  { to: '/mon-espace/mes-billets', icon: 'ticket', label: t('buyerDashboard.statTickets'), value: loading.value ? '—' : validTicketsCount.value },
  { to: '/mon-espace/mes-commandes', icon: 'wallet', label: t('buyerDashboard.statOrders'), value: loading.value ? '—' : orders.value.length },
  { to: '/mon-espace/mes-favoris', icon: 'heart', label: t('buyerDashboard.statFavorites'), value: favoriteIds.value.length },
])

const quickLinks = computed(() => [
  { to: '/mon-espace/mes-billets', icon: 'ticket', label: t('header.myTickets') },
  { to: '/mon-espace/mes-favoris', icon: 'heart', label: t('header.favorites') },
  { to: '/mon-espace/notifications', icon: 'bell', label: t('header.notifications'), badge: unreadCount.value || null },
  { to: '/mon-espace/profil', icon: 'user', label: t('header.profile') },
  { to: '/mon-espace/parametres', icon: 'settings', label: t('header.settings') },
])

// Talon de date (même présentation que la page événement).
function dateParts(d: string) {
  const dt = new Date(d)
  return {
    weekday: dt.toLocaleDateString(locale.value, { weekday: 'short' }).replace('.', ''),
    day: String(dt.getDate()).padStart(2, '0'),
    month: dt.toLocaleDateString(locale.value, { month: 'short' }).replace('.', ''),
  }
}

// « Aujourd'hui », « Demain » ou « Dans N jours ».
function whenLabel(d: string) {
  const start = new Date(d)
  start.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((start.getTime() - today.getTime()) / 86400000)
  if (diff <= 0) return t('account.today')
  if (diff === 1) return t('account.tomorrow')
  return t('account.inDays', { n: diff })
}

const orderTag: Record<string, string> = {
  pending: 'bg-[#FF7A00]/15 text-tikeo-orange',
  paid: 'bg-tikeo-success/10 text-tikeo-success',
  failed: 'bg-tikeo-error/10 text-tikeo-error',
  cancelled: 'bg-tikeo-surface-alt text-tikeo-gray-text',
  refunded: 'bg-tikeo-blue/10 text-tikeo-blue',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Suppression depuis le tableau de bord (masquage de l'historique) avec confirmation.
const toDelete = ref<{ kind: 'ticket' | 'order'; id: string } | null>(null)
const deleting = ref(false)
const deleteError = ref('')
function askDelete(kind: 'ticket' | 'order', id: string) {
  deleteError.value = ''
  toDelete.value = { kind, id }
}
async function confirmDelete() {
  if (!toDelete.value) return
  deleting.value = true
  const ok = toDelete.value.kind === 'ticket' ? await hideTickets([toDelete.value.id]) : await hideOrders([toDelete.value.id])
  deleting.value = false
  if (ok) toDelete.value = null
  else deleteError.value = t('buyerDelete.error')
}
</script>

<template>
  <AccountShell :title="t('buyerDashboard.welcome', { name: firstName })" width="full" identity>
    <template #actions>
      <NuxtLink to="/evenements" class="btn-brand !h-11 hover:!bg-white max-sm:w-full">
        {{ t('common.browseEvents') }}
        <AppIcon name="arrow-right" class="h-4 w-4" :stroke="2.4" />
      </NuxtLink>
    </template>

    <!-- Chiffres clés (dans le hero) -->
    <template #stats>
      <div class="grid grid-cols-3 gap-2.5 md:gap-4">
        <NuxtLink
          v-for="s in stats"
          :key="s.to"
          :to="s.to"
          class="group flex items-center gap-3 border border-white/15 bg-white/[0.06] p-3 transition-colors duration-200 hover:border-[#FF7A00] md:p-4"
        >
          <span class="hidden h-11 w-11 shrink-0 items-center justify-center bg-[#FF7A00] text-tikeo-ink sm:flex">
            <AppIcon :name="s.icon" class="h-5 w-5" />
          </span>
          <div class="min-w-0">
            <p class="font-display text-2xl font-extrabold leading-none md:text-4xl">{{ s.value }}</p>
            <p class="mt-1.5 truncate text-[10px] font-bold uppercase tracking-wider text-white/55 md:text-[11px]">{{ s.label }}</p>
          </div>
        </NuxtLink>
      </div>
    </template>

    <div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-12">
      <!-- ============ Colonne principale : prochains billets ============ -->
      <section class="min-w-0">
        <div class="mb-5 flex items-end justify-between gap-3">
          <div class="max-w-xl">
            <h2 class="acc-h2">{{ t('buyerDashboard.upcomingTitle') }}</h2>
            <p class="mt-1.5 text-sm text-tikeo-gray-text md:text-base">{{ t('account.upcomingSub') }}</p>
          </div>
          <NuxtLink to="/mon-espace/mes-billets" class="acc-link shrink-0">{{ t('home.seeAll') }}</NuxtLink>
        </div>

        <div v-if="loading" class="space-y-4">
          <div v-for="i in 2" :key="i" class="h-32 animate-pulse bg-tikeo-border" />
        </div>

        <div v-else-if="upcomingTickets.length === 0" class="acc-empty">
          <span class="flex h-14 w-14 items-center justify-center bg-tikeo-ink text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">
            <AppIcon name="ticket" class="h-7 w-7" />
          </span>
          <p class="text-sm text-tikeo-gray-text">{{ t('buyerDashboard.noUpcoming') }}</p>
          <NuxtLink to="/evenements" class="btn-ink">{{ t('common.browseEvents') }}</NuxtLink>
        </div>

        <ul v-else class="space-y-4">
          <li v-for="tk in upcomingTickets" :key="tk.id">
            <article class="relative flex bg-tikeo-surface shadow-card transition-shadow duration-300 hover:shadow-card-hover">
              <span class="w-1.5 shrink-0 bg-[#FF7A00]" aria-hidden="true" />

              <!-- Talon de date -->
              <div class="flex w-[4.75rem] shrink-0 flex-col items-center justify-center bg-tikeo-ink px-2 py-4 leading-none text-white md:w-28">
                <span class="text-[11px] font-semibold capitalize text-white/70">{{ dateParts(tk.event!.start_date).weekday }}</span>
                <span class="mt-1.5 font-display text-3xl font-extrabold md:text-4xl">{{ dateParts(tk.event!.start_date).day }}</span>
                <span class="mt-1 text-xs font-semibold capitalize text-white/70">{{ dateParts(tk.event!.start_date).month }}</span>
              </div>

              <!-- Perforation -->
              <div class="relative w-0 shrink-0" aria-hidden="true">
                <span class="absolute -left-[11px] -top-[11px] h-[22px] w-[22px] rounded-full bg-tikeo-surface-alt" />
                <span class="absolute -bottom-[11px] -left-[11px] h-[22px] w-[22px] rounded-full bg-tikeo-surface-alt" />
                <span class="absolute inset-y-4 left-0 border-l-2 border-dashed border-tikeo-gray-text/35" />
              </div>

              <div class="min-w-0 flex-1 p-4 md:p-5">
                <span class="acc-tag bg-[#FF7A00] text-tikeo-ink">{{ whenLabel(tk.event!.start_date) }}</span>
                <h3 class="mt-1.5 truncate font-display text-lg font-bold leading-tight tracking-tight text-tikeo-black md:text-xl">{{ tk.event?.title }}</h3>
                <p class="mt-1 flex items-center gap-1.5 text-sm text-tikeo-gray-text">
                  <AppIcon name="pin" class="h-3.5 w-3.5 shrink-0" />
                  <span class="truncate">{{ tk.event?.city }}<template v-if="tk.ticket_type?.name"> · {{ tk.ticket_type.name }}</template></span>
                </p>

                <div class="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <NuxtLink to="/mon-espace/mes-billets" class="btn-ink !h-9 !px-4 !text-[13px]">
                    <AppIcon name="qr" class="h-4 w-4" />
                    {{ t('account.viewTicket') }}
                  </NuxtLink>
                  <NuxtLink :to="`/e/${tk.event?.slug}`" class="text-[13px] font-bold text-tikeo-black underline decoration-[#FF7A00] decoration-2 underline-offset-[5px] hover:text-tikeo-orange">
                    {{ t('buyerOrders.viewEvent') }}
                  </NuxtLink>
                  <button
                    type="button"
                    class="ml-auto flex h-9 w-9 items-center justify-center border border-tikeo-border text-tikeo-gray-text transition-colors hover:border-tikeo-error hover:text-tikeo-error"
                    :aria-label="t('buyerDelete.ticketAria', { number: tk.ticket_number })"
                    :title="t('buyerDelete.delete')"
                    @click="askDelete('ticket', tk.id)"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            </article>
          </li>
        </ul>
      </section>

      <!-- ============ Colonne latérale ============ -->
      <aside class="min-w-0 space-y-10">
        <!-- Dernières commandes -->
        <section>
          <div class="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 class="acc-h2">{{ t('buyerDashboard.recentOrdersTitle') }}</h2>
              <p class="mt-1 text-sm text-tikeo-gray-text">{{ t('account.ordersSub') }}</p>
            </div>
            <NuxtLink to="/mon-espace/mes-commandes" class="acc-link shrink-0">{{ t('home.seeAll') }}</NuxtLink>
          </div>

          <div v-if="loading" class="h-24 animate-pulse bg-tikeo-border" />
          <p v-else-if="recentOrders.length === 0" class="border border-dashed border-tikeo-border bg-tikeo-surface p-6 text-center text-sm text-tikeo-gray-text">
            {{ t('buyerDashboard.noOrders') }}
          </p>
          <ul v-else class="acc-panel divide-y divide-tikeo-border">
            <li v-for="order in recentOrders" :key="order.id" class="flex items-center gap-3 px-4 py-3.5">
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-bold text-tikeo-black">{{ order.event?.title || order.order_number }}</p>
                <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-tikeo-gray-text">
                  <span>{{ formatDate(order.created_at) }}</span>
                  <span class="acc-tag" :class="orderTag[order.status]">{{ t(`orderStatus.${order.status}`) }}</span>
                </p>
              </div>
              <p class="shrink-0 text-right font-display text-sm font-extrabold text-tikeo-black">
                {{ order.total.toLocaleString('fr-FR') }} <span class="text-[11px] font-semibold text-tikeo-gray-text">FCFA</span>
              </p>
              <button
                v-if="order.status !== 'pending'"
                type="button"
                class="flex h-8 w-8 shrink-0 items-center justify-center text-tikeo-gray-text transition-colors hover:text-tikeo-error"
                :aria-label="t('buyerDelete.orderAria', { number: order.order_number })"
                :title="t('buyerDelete.delete')"
                @click="askDelete('order', order.id)"
              >
                <TrashIcon />
              </button>
            </li>
          </ul>
        </section>

        <!-- Accès rapide -->
        <section>
          <h2 class="acc-h2 mb-4">{{ t('account.shortcuts') }}</h2>
          <ul class="acc-panel divide-y divide-tikeo-border">
            <li v-for="q in quickLinks" :key="q.to">
              <NuxtLink :to="q.to" class="drawer-row">
                <span class="drawer-icon"><AppIcon :name="q.icon" class="h-5 w-5" /></span>
                <span class="flex-1">{{ q.label }}</span>
                <span v-if="q.badge" class="flex h-5 min-w-5 items-center justify-center bg-[#FF7A00] px-1.5 text-[11px] font-bold text-tikeo-ink">{{ q.badge }}</span>
                <AppIcon name="chevron-right" class="h-4 w-4 shrink-0 text-tikeo-gray-text" :stroke="2.4" />
              </NuxtLink>
            </li>
          </ul>
        </section>
      </aside>
    </div>

    <ConfirmDeleteModal
      :open="!!toDelete"
      :title="toDelete?.kind === 'ticket' ? t('buyerDelete.ticketTitle') : t('buyerDelete.orderTitle')"
      :message="toDelete?.kind === 'ticket' ? t('buyerDelete.ticketBody') : t('buyerDelete.orderBody')"
      :warning="toDelete?.kind === 'ticket' ? t('buyerDelete.ticketValidWarning') : ''"
      :loading="deleting"
      :error-message="deleteError"
      @confirm="confirmDelete"
      @cancel="toDelete = null"
    />
  </AccountShell>
</template>
