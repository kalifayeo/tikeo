<script setup lang="ts">
import type { TicketWithDetails } from '~/types/database'

definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const { tickets, loading, errorMessage, isOffline, cachedAt, hideTickets } = useMyTickets()

// --- Supprimer de l'historique (masquage) ------------------------------------
// Un billet supprimé disparaît de cette liste mais reste valide côté
// organisateur : on prévient donc clairement si le billet peut encore servir.
const ticketsToDelete = ref<string[] | null>(null)
const deleting = ref(false)
const deleteError = ref('')
const deleteHasValid = computed(() => {
  const ids = ticketsToDelete.value
  if (!ids) return false
  return tickets.value.some((tk) => ids.includes(tk.id) && tk.status === 'valid' && (!tk.event || new Date(tk.event.start_date) >= new Date()))
})
function askDeleteTickets(ids: string[]) {
  deleteError.value = ''
  ticketsToDelete.value = ids
}
async function confirmDeleteTickets() {
  if (!ticketsToDelete.value) return
  deleting.value = true
  const ok = await hideTickets(ticketsToDelete.value)
  deleting.value = false
  if (ok) {
    if (selectedTicket.value && ticketsToDelete.value.includes(selectedTicket.value.id)) selectedTicket.value = null
    ticketsToDelete.value = null
  } else {
    deleteError.value = t('buyerDelete.error')
  }
}
const { qrCache, ensure, ensureAll } = useTicketQr()

// --- Transférer un billet ------------------------------------------------
const { submitting: transferSubmitting, errorCode: transferErrorCode, send: sendTransfer } = useTicketTransferSend()
const transferOpenFor = ref<string | null>(null)
const transferEmail = ref('')
const transferMessage = ref('')
const transferSentTo = ref<Record<string, string>>({})

function openTransfer(ticketId: string) {
  transferOpenFor.value = ticketId
  transferEmail.value = ''
  transferMessage.value = ''
}
async function handleSendTransfer() {
  if (!transferOpenFor.value) return
  const result = await sendTransfer(transferOpenFor.value, transferEmail.value, transferMessage.value)
  if (result) {
    transferSentTo.value[transferOpenFor.value] = result.toEmail
    transferOpenFor.value = null
  }
}

// --- Ajouter au Wallet -----------------------------------------------------
const walletLoading = ref<string | null>(null)
const walletErrorMessage = ref('')
async function addToGoogleWallet(ticketId: string) {
  walletLoading.value = ticketId
  walletErrorMessage.value = ''
  try {
    const supabase = useSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    const res = await $fetch<{ url: string }>(`/api/tickets/${ticketId}/wallet/google`, {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    })
    if (import.meta.client) window.open(res.url, '_blank')
  } catch (e: any) {
    walletErrorMessage.value = e?.data?.data?.code === 'GOOGLE_WALLET_NOT_CONFIGURED' ? t('buyerTickets.walletNotConfigured') : t('buyerTickets.walletError')
  } finally {
    walletLoading.value = null
  }
}
async function addToAppleWallet(ticketId: string, ticketNumber: string) {
  walletLoading.value = ticketId
  walletErrorMessage.value = ''
  try {
    const supabase = useSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/tickets/${ticketId}/wallet/apple`, {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      walletErrorMessage.value = body?.data?.code === 'APPLE_WALLET_NOT_CONFIGURED' ? t('buyerTickets.walletNotConfigured') : t('buyerTickets.walletError')
      return
    }
    const blob = await res.blob()
    if (import.meta.client) {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${ticketNumber}.pkpass`
      a.click()
      URL.revokeObjectURL(url)
    }
  } catch {
    walletErrorMessage.value = t('buyerTickets.walletError')
  } finally {
    walletLoading.value = null
  }
}

watch(tickets, (list) => ensureAll(list), { immediate: true })

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateLong(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ---------------------------------------------------------------------
// Regroupement par commande : avec plusieurs billets pour un même
// événement, l'historique affichait auparavant une immense carte par
// billet (voir capture du 27/09), ce qui rendait la page interminable.
// On regroupe désormais les billets d'une même commande sous une seule
// ligne compacte, repliée par défaut, avec le détail de chaque billet
// affiché au clic sur « Voir les billets ».
// ---------------------------------------------------------------------
interface TicketGroup {
  orderId: string
  orderNumber: string
  event: TicketWithDetails['event']
  tickets: TicketWithDetails[]
}

const groups = computed<TicketGroup[]>(() => {
  const order: string[] = []
  const map = new Map<string, TicketGroup>()
  for (const tk of tickets.value) {
    const key = tk.order_id
    if (!map.has(key)) {
      map.set(key, { orderId: key, orderNumber: tk.order?.order_number || '', event: tk.event, tickets: [] })
      order.push(key)
    }
    map.get(key)!.tickets.push(tk)
  }
  return order.map((key) => map.get(key)!)
})

// Pagination des groupes (et non des billets bruts) : ça garde la page
// courte même avec un long historique de commandes.
const PAGE_SIZE = 5
const currentPage = ref(1)
const pageCount = computed(() => Math.max(1, Math.ceil(groups.value.length / PAGE_SIZE)))
const paginatedGroups = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return groups.value.slice(start, start + PAGE_SIZE)
})
watch(groups, () => {
  if (currentPage.value > pageCount.value) currentPage.value = pageCount.value
})

// Un seul groupe déplié par défaut (le plus récent) ; le reste reste
// replié tant qu'on ne clique pas dessus.
const expanded = ref<Set<string>>(new Set())
watch(
  groups,
  (list) => {
    if (list.length && expanded.value.size === 0) expanded.value = new Set([list[0].orderId])
  },
  { immediate: true }
)
function toggleGroup(orderId: string) {
  const next = new Set(expanded.value)
  if (next.has(orderId)) next.delete(orderId)
  else next.add(orderId)
  expanded.value = next
}

function groupStatusSummary(group: TicketGroup) {
  const statuses = new Set(group.tickets.map((tk) => tk.status))
  if (statuses.size === 1) return { label: t(`ticketStatus.${group.tickets[0].status}`), classes: statusClasses[group.tickets[0].status] }
  return { label: t('buyerTickets.statusMixed'), classes: 'bg-tikeo-surface-alt text-tikeo-gray-text' }
}

// Modale « Voir » : billet agrandi avec QR code plus grand.
const selectedTicket = ref<TicketWithDetails | null>(null)
function openTicket(tk: TicketWithDetails) {
  ensure(tk.id, tk.qr_token)
  selectedTicket.value = tk
}
function closeTicket() {
  selectedTicket.value = null
}

// ---------------------------------------------------------------------
// Génération PDF : même billet que celui envoyé par email (A4 portrait, billet
// en haut + conditions d'accès en dessous). Le dessin est partagé avec le
// serveur — voir utils/ticketPdfDoc.ts. Le module n'est chargé qu'au clic.
// La photo de l'événement est ajoutée si l'hébergeur de l'image l'autorise
// (CORS) ; sinon le billet garde son fond marine, sans photo.
// ---------------------------------------------------------------------
const { profile } = useAuth()

function toSheet(tk: TicketWithDetails, siblings: TicketWithDetails[]): import('~/utils/ticketPdfDoc').TicketSheetInput {
  const index = Math.max(1, siblings.findIndex((x) => x.id === tk.id) + 1)
  return {
    ticketNumber: tk.ticket_number,
    typeName: tk.ticket_type?.name || 'Billet',
    price: Number(tk.ticket_type?.price ?? 0),
    currency: 'XOF',
    qrToken: tk.qr_token,
    holderName: profile.value?.full_name || '',
    eventTitle: tk.event?.title || '',
    eventDate: tk.event?.start_date || new Date().toISOString(),
    eventLocation: tk.event?.location_name || tk.event?.city || '',
    orderNumber: tk.order?.order_number || '',
    index,
    count: siblings.length,
  }
}

async function loadPdfTools() {
  const [mod, { jsPDF }] = await Promise.all([import('~/utils/ticketPdfDoc'), import('jspdf')])
  return { mod, jsPDF }
}

const downloadingId = ref<string | null>(null)
async function downloadTicket(tk: TicketWithDetails) {
  if (downloadingId.value) return
  downloadingId.value = tk.id
  try {
    const { mod, jsPDF } = await loadPdfTools()
    const siblings = tickets.value.filter((x) => x.order_id === tk.order_id)
    const assets = await mod.loadTicketAssets(tk.event?.cover_image)
    const doc = await mod.buildTicketDoc(jsPDF as any, [toSheet(tk, siblings)], assets)
    doc.save(`billet-${tk.ticket_number}.pdf`)
  } catch (e) {
    console.error('[mes-billets] échec génération PDF du billet :', e)
  } finally {
    downloadingId.value = null
  }
}

const downloadingGroupId = ref<string | null>(null)
async function downloadGroup(group: TicketGroup) {
  if (downloadingGroupId.value) return
  downloadingGroupId.value = group.orderId
  try {
    const { mod, jsPDF } = await loadPdfTools()
    const assets = await mod.loadTicketAssets(group.event?.cover_image)
    const sheets = group.tickets.map((tk) => toSheet(tk, group.tickets))
    const doc = await mod.buildTicketDoc(jsPDF as any, sheets, assets)
    doc.save(`billets-${group.orderNumber || group.orderId.slice(0, 8)}.pdf`)
  } catch (e) {
    console.error('[mes-billets] échec génération PDF du groupe :', e)
  } finally {
    downloadingGroupId.value = null
  }
}

const statusClasses: Record<string, string> = {
  pending: 'bg-[#FF7A00]/15 text-tikeo-orange',
  valid: 'bg-tikeo-success/10 text-tikeo-success',
  used: 'bg-tikeo-surface-alt text-tikeo-gray-text',
  cancelled: 'bg-tikeo-error/10 text-tikeo-error',
  refunded: 'bg-tikeo-blue/10 text-tikeo-blue',
  expired: 'bg-tikeo-surface-alt text-tikeo-gray-text',
}
</script>

<template>
  <AccountShell :title="t('header.myTickets')" :subtitle="t('account.subtitleTickets')" width="wide">
    <p v-if="errorMessage" class="acc-alert-error mb-5">{{ errorMessage }}</p>
    <p v-if="isOffline" class="mb-5 flex flex-wrap items-center gap-2 border-l-4 border-[#FF7A00] bg-tikeo-surface px-4 py-2.5 text-sm text-tikeo-gray-text">
      <AppIcon name="alert" class="h-4 w-4" aria-hidden="true" />
      <span class="font-semibold text-tikeo-black">{{ t('buyerTickets.offlineNotice') }}</span>
      <span v-if="cachedAt" class="text-xs">({{ t('buyerTickets.offlineCachedAt', { date: new Date(cachedAt).toLocaleString('fr-FR') }) }})</span>
    </p>

    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="h-24 animate-pulse bg-tikeo-border" />
    </div>

    <div v-else-if="tickets.length === 0" class="acc-empty">
      <span class="flex h-14 w-14 items-center justify-center bg-tikeo-ink text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">
        <AppIcon name="ticket" class="h-7 w-7" />
      </span>
      <p class="font-display text-lg font-bold text-tikeo-black">{{ t('buyerTickets.empty') }}</p>
      <p class="max-w-sm text-sm text-tikeo-gray-text">{{ t('buyerTickets.emptyHint') }}</p>
      <NuxtLink to="/evenements" class="btn-ink mt-1">{{ t('common.browseEvents') }}</NuxtLink>
    </div>

    <template v-else>
      <ul class="space-y-4">
        <li v-for="group in paginatedGroups" :key="group.orderId">
          <article class="overflow-hidden bg-tikeo-surface shadow-card transition-shadow duration-300 hover:shadow-card-hover" :class="expanded.has(group.orderId) ? 'ring-2 ring-[#FF7A00]' : ''">
            <!-- En-tête du groupe (une commande = une ligne) -->
            <button type="button" class="flex w-full items-stretch text-left" :aria-expanded="expanded.has(group.orderId)" @click="toggleGroup(group.orderId)">
              <span class="w-1.5 shrink-0 bg-[#FF7A00]" aria-hidden="true" />
              <div class="flex min-w-0 flex-1 items-center gap-3 p-3 md:gap-4 md:p-4">
                <div class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden bg-tikeo-ink md:h-20 md:w-20">
                  <img v-if="group.event?.cover_image" :src="group.event.cover_image" :alt="group.event?.title" loading="lazy" decoding="async" class="h-full w-full object-cover" />
                  <span v-else class="font-display text-xs font-extrabold text-white">Tikeo</span>
                </div>

                <div class="min-w-0 flex-1">
                  <p class="truncate font-display text-base font-bold leading-tight tracking-tight text-tikeo-black md:text-lg">{{ group.event?.title }}</p>
                  <p class="mt-1 flex items-center gap-1.5 truncate text-xs text-tikeo-gray-text md:text-sm">
                    <AppIcon name="calendar" class="h-3.5 w-3.5 shrink-0" />
                    <span class="truncate">{{ group.event ? formatDate(group.event.start_date) : '' }} · {{ group.event?.city }}</span>
                  </p>
                  <div class="mt-2 flex flex-wrap items-center gap-1.5">
                    <span class="acc-tag" :class="groupStatusSummary(group).classes">{{ groupStatusSummary(group).label }}</span>
                    <span class="acc-tag bg-tikeo-surface-alt text-tikeo-gray-text">{{ t('buyerTickets.ticketsCount', group.tickets.length) }}</span>
                  </div>
                </div>

                <span class="flex h-9 w-9 shrink-0 items-center justify-center border border-tikeo-border text-tikeo-black">
                  <AppIcon name="chevron-down" class="h-4 w-4 transition-transform" :class="{ 'rotate-180': expanded.has(group.orderId) }" :stroke="2.4" />
                </span>
              </div>
            </button>

            <!-- Détail des billets, replié par défaut -->
            <div v-if="expanded.has(group.orderId)" class="border-t-2 border-dashed border-tikeo-gray-text/35">
              <div class="flex flex-wrap items-center justify-between gap-2 bg-tikeo-surface-alt/60 px-4 py-3">
                <NuxtLink v-if="group.event?.slug" :to="`/e/${group.event.slug}`" class="text-[13px] font-bold text-tikeo-black underline decoration-[#FF7A00] decoration-2 underline-offset-[5px] hover:text-tikeo-orange">
                  {{ t('buyerOrders.viewEvent') }}
                </NuxtLink>
                <span v-else />
                <div class="flex items-center gap-2">
                  <button type="button" class="acc-btn-ghost !h-9 !px-3 !text-xs hover:!border-tikeo-error hover:!text-tikeo-error" @click="askDeleteTickets(group.tickets.map((tk) => tk.id))">
                    <TrashIcon class="!h-3.5 !w-3.5" />
                    {{ t('buyerDelete.delete') }}
                  </button>
                  <button
                    v-if="group.tickets.length > 1"
                    type="button"
                    class="btn-ink !h-9 !px-3 !text-xs disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="downloadingGroupId === group.orderId"
                    @click="downloadGroup(group)"
                  >
                    {{ downloadingGroupId === group.orderId ? t('buyerTickets.downloadingAll') : t('buyerTickets.downloadAll') }}
                  </button>
                </div>
              </div>

              <ul class="divide-y divide-tikeo-border">
                <li v-for="tk in group.tickets" :key="tk.id" class="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
                  <div class="flex h-12 w-12 shrink-0 items-center justify-center border border-tikeo-border bg-white p-0.5">
                    <img v-if="qrCache[tk.id]" :src="qrCache[tk.id]" :alt="`QR — ${tk.ticket_number}`" class="h-full w-full object-contain" />
                  </div>

                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-bold text-tikeo-black">{{ tk.ticket_type?.name }}</p>
                    <p class="truncate font-mono text-xs text-tikeo-gray-text">{{ t('buyerTickets.ticketNumber', { number: tk.ticket_number }) }}</p>
                  </div>

                  <span class="acc-tag hidden sm:inline-flex" :class="statusClasses[tk.status]">{{ t(`ticketStatus.${tk.status}`) }}</span>

                  <div class="flex shrink-0 gap-1.5 max-sm:w-full">
                    <button type="button" class="acc-btn-ghost !h-9 !px-3 !text-xs max-sm:flex-1" @click="openTicket(tk)">
                      {{ t('buyerTickets.view') }}
                    </button>
                    <button type="button" class="btn-ink !h-9 !px-3 !text-xs disabled:cursor-not-allowed disabled:opacity-60 max-sm:flex-1" :disabled="downloadingId === tk.id" @click="downloadTicket(tk)">
                      {{ downloadingId === tk.id ? t('buyerTickets.downloading') : t('buyerTickets.download') }}
                    </button>
                    <button
                      type="button"
                      class="flex h-9 w-9 shrink-0 items-center justify-center border border-tikeo-border text-tikeo-gray-text transition-colors hover:border-tikeo-error hover:text-tikeo-error"
                      :aria-label="t('buyerDelete.ticketAria', { number: tk.ticket_number })"
                      :title="t('buyerDelete.delete')"
                      @click="askDeleteTickets([tk.id])"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </li>
              </ul>
            </div>
          </article>
        </li>
      </ul>

      <!-- Pagination des commandes -->
      <div v-if="pageCount > 1" class="mt-8 flex items-center justify-center gap-3">
        <button type="button" class="acc-btn-ghost" :disabled="currentPage === 1" @click="currentPage--">
          <AppIcon name="chevron-left" class="h-4 w-4" :stroke="2.4" />
          {{ t('buyerTickets.pagePrev') }}
        </button>
        <span class="text-sm font-semibold text-tikeo-gray-text">{{ t('buyerTickets.pageOf', { current: currentPage, total: pageCount }) }}</span>
        <button type="button" class="acc-btn-ghost" :disabled="currentPage === pageCount" @click="currentPage++">
          {{ t('buyerTickets.pageNext') }}
          <AppIcon name="chevron-right" class="h-4 w-4" :stroke="2.4" />
        </button>
      </div>
    </template>

    <!-- Modale « Voir » : billet agrandi -->
    <Teleport to="body">
      <div v-if="selectedTicket" class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-tikeo-ink/70 p-4 backdrop-blur-[2px]" @click.self="closeTicket">
        <div class="my-auto w-full max-w-sm overflow-hidden bg-tikeo-surface shadow-2xl">
          <div class="relative h-36 w-full bg-tikeo-ink">
            <img v-if="selectedTicket.event?.cover_image" :src="selectedTicket.event.cover_image" :alt="selectedTicket.event?.title" class="h-full w-full object-cover" />
            <span v-else class="flex h-full w-full items-center justify-center font-display text-lg font-extrabold tracking-wide text-white">Tikeo</span>
            <div class="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent" aria-hidden="true" />
            <div class="absolute inset-x-0 top-0 h-1 bg-tikeo-brand" aria-hidden="true" />
            <button type="button" class="absolute right-3 top-4 flex h-9 items-center gap-1.5 bg-white/95 px-3 text-xs font-bold text-tikeo-ink transition-colors hover:bg-[#FF7A00]" @click="closeTicket">
              <AppIcon name="close" class="h-3.5 w-3.5" :stroke="2.6" />
              {{ t('buyerTickets.close') }}
            </button>
          </div>

          <div class="p-5">
            <p class="font-display text-xl font-extrabold leading-tight tracking-tight text-tikeo-black">{{ selectedTicket.event?.title }}</p>
            <p class="mt-2 flex items-center gap-1.5 text-sm text-tikeo-gray-text">
              <AppIcon name="calendar" class="h-4 w-4 shrink-0" />
              {{ selectedTicket.event ? formatDateLong(selectedTicket.event.start_date) : '' }}
            </p>
            <p class="mt-1 flex items-center gap-1.5 text-sm text-tikeo-gray-text">
              <AppIcon name="pin" class="h-4 w-4 shrink-0" />
              {{ selectedTicket.event?.location_name || selectedTicket.event?.city }}
            </p>

            <div class="mt-4 grid grid-cols-2 gap-3 border-t-2 border-dashed border-tikeo-gray-text/35 pt-4">
              <div class="min-w-0">
                <p class="acc-label">{{ t('buyerTickets.typeLabel') }}</p>
                <p class="mt-0.5 truncate text-sm font-bold text-tikeo-black">{{ selectedTicket.ticket_type?.name }}</p>
              </div>
              <div class="min-w-0">
                <p class="acc-label">{{ t('buyerTickets.numberLabel') }}</p>
                <p class="mt-0.5 truncate font-mono text-sm font-bold text-tikeo-black">{{ selectedTicket.ticket_number }}</p>
              </div>
            </div>

            <div class="mt-4 flex flex-col items-center gap-2">
              <img v-if="qrCache[selectedTicket.id]" :src="qrCache[selectedTicket.id]" :alt="`QR — ${selectedTicket.ticket_number}`" class="h-48 w-48 border border-tikeo-border bg-white p-2" />
              <p class="text-center text-xs text-tikeo-gray-text">{{ t('buyerTickets.modalHint') }}</p>
            </div>

            <button type="button" class="btn-ink mt-4 !h-12 w-full disabled:cursor-not-allowed disabled:opacity-60" :disabled="downloadingId === selectedTicket.id" @click="downloadTicket(selectedTicket)">
              {{ downloadingId === selectedTicket.id ? t('buyerTickets.downloading') : t('buyerTickets.download') }}
            </button>

            <div v-if="selectedTicket.status === 'valid'" class="mt-2 grid grid-cols-2 gap-2">
              <button type="button" class="acc-btn-ghost !px-2 !text-xs" :disabled="walletLoading === selectedTicket.id" @click="addToGoogleWallet(selectedTicket.id)">
                {{ t('buyerTickets.addToGoogleWallet') }}
              </button>
              <button type="button" class="acc-btn-ghost !px-2 !text-xs" :disabled="walletLoading === selectedTicket.id" @click="addToAppleWallet(selectedTicket.id, selectedTicket.ticket_number)">
                {{ t('buyerTickets.addToAppleWallet') }}
              </button>
            </div>
            <p v-if="walletErrorMessage" class="mt-1 text-center text-xs text-tikeo-error">{{ walletErrorMessage }}</p>

            <button v-if="selectedTicket.status === 'valid'" type="button" class="mt-3 w-full text-center text-[13px] font-bold text-tikeo-black underline decoration-[#FF7A00] decoration-2 underline-offset-[5px] hover:text-tikeo-orange" @click="openTransfer(selectedTicket.id)">
              {{ t('buyerTickets.transferTicket') }}
            </button>
            <p v-if="transferSentTo[selectedTicket.id]" class="mt-1 text-center text-xs text-tikeo-success">
              {{ t('buyerTickets.transferSentTo', { email: transferSentTo[selectedTicket.id] }) }}
            </p>
          </div>
        </div>
      </div>
    </Teleport>

    <ConfirmDeleteModal
      :open="!!ticketsToDelete"
      :title="ticketsToDelete && ticketsToDelete.length > 1 ? t('buyerDelete.ticketsTitle') : t('buyerDelete.ticketTitle')"
      :message="ticketsToDelete && ticketsToDelete.length > 1 ? t('buyerDelete.ticketsBody') : t('buyerDelete.ticketBody')"
      :warning="deleteHasValid ? (ticketsToDelete && ticketsToDelete.length > 1 ? t('buyerDelete.ticketsValidWarning') : t('buyerDelete.ticketValidWarning')) : ''"
      :loading="deleting"
      :error-message="deleteError"
      @confirm="confirmDeleteTickets"
      @cancel="ticketsToDelete = null"
    />

    <!-- Modale de transfert de billet -->
    <Teleport to="body">
      <div v-if="transferOpenFor" class="fixed inset-0 z-50 flex items-center justify-center bg-tikeo-ink/70 p-4 backdrop-blur-[2px]" @click.self="transferOpenFor = null">
        <form class="w-full max-w-sm bg-tikeo-surface p-5 shadow-2xl" @submit.prevent="handleSendTransfer">
          <h2 class="mb-4 font-display text-xl font-extrabold tracking-tight text-tikeo-black">{{ t('buyerTickets.transferModalTitle') }}</h2>
          <input v-model="transferEmail" type="email" required :placeholder="t('buyerTickets.transferEmailPlaceholder')" class="input-field mb-2" />
          <textarea v-model="transferMessage" rows="2" maxlength="300" :placeholder="t('buyerTickets.transferMessagePlaceholder')" class="input-field mb-2" />
          <p v-if="transferErrorCode" class="mb-2 text-xs text-tikeo-error">{{ t(`buyerTickets.transferErrors.${transferErrorCode}`) }}</p>
          <div class="mt-2 flex gap-2">
            <button type="button" class="acc-btn-ghost flex-1" @click="transferOpenFor = null">{{ t('common.cancel') }}</button>
            <button type="submit" class="btn-ink flex-1 disabled:opacity-60" :disabled="transferSubmitting">
              {{ transferSubmitting ? t('buyerTickets.transferSending') : t('buyerTickets.transferSend') }}
            </button>
          </div>
        </form>
      </div>
    </Teleport>
  </AccountShell>
</template>
