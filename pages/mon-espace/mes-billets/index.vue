<script setup lang="ts">
import type { TicketWithDetails } from '~/types/database'

definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const { tickets, loading, errorMessage } = useMyTickets()
const { qrCache, ensure, ensureAll } = useTicketQr()

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
  return { label: t('buyerTickets.statusMixed'), classes: 'bg-tikeo-gray-light text-tikeo-gray-text' }
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
// Génération PDF (même identité visuelle que le billet envoyé par email —
// voir server/utils/ticketPdf.ts) : bannière orange + médaillon Tikeo,
// talon détachable avec QR code. La photo de couverture n'est pas
// intégrée ici (risque de blocage CORS selon l'hébergeur de l'image) ; le
// PDF généré côté serveur pour l'email, lui, l'inclut.
// ---------------------------------------------------------------------
const ORANGE: [number, number, number] = [255, 122, 0]
const INK: [number, number, number] = [17, 17, 17]
const GRAY: [number, number, number] = [110, 110, 110]
const GRAY_LIGHT: [number, number, number] = [235, 235, 235]

function dashedVLine(doc: any, x: number, y1: number, y2: number) {
  const dash = 2.2
  const gap = 1.6
  let y = y1
  doc.setDrawColor(...GRAY_LIGHT)
  doc.setLineWidth(0.4)
  while (y < y2) {
    doc.line(x, y, x, Math.min(y + dash, y2))
    y += dash + gap
  }
}

function drawTicketPage(doc: any, tk: TicketWithDetails, qrDataUrl: string | null, orderNumber: string) {
  const PAGE_W = 190
  const PAGE_H = 95
  const M = 5
  const cardW = PAGE_W - M * 2
  const cardH = PAGE_H - M * 2
  const STUB_W = 56
  const mainW = cardW - STUB_W
  const stubX = M + mainW
  const bannerH = 26

  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(...GRAY_LIGHT)
  doc.setLineWidth(0.3)
  doc.roundedRect(M, M, cardW, cardH, 5, 5, 'FD')

  doc.setFillColor(...ORANGE)
  doc.rect(M, M, mainW, bannerH, 'F')
  doc.setFillColor(255, 255, 255)
  doc.circle(M + 12, M + bannerH, 6, 'F')
  doc.setDrawColor(...ORANGE)
  doc.setLineWidth(0.6)
  doc.circle(M + 12, M + bannerH, 6, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...ORANGE)
  doc.text('T', M + 12, M + bannerH + 1.4, { align: 'center' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(255, 255, 255)
  doc.text('TIKEO', M + mainW - 4, M + 6, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.text('BILLET ÉLECTRONIQUE', M + mainW - 4, M + 10, { align: 'right' })

  let y = M + bannerH + 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...INK)
  const titleLines = doc.splitTextToSize(tk.event?.title || '', mainW - 12)
  doc.text(titleLines.slice(0, 2), M + 6, y)
  y += Math.min(titleLines.length, 2) * 5.6 + 3

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  if (tk.event?.start_date) {
    doc.setFillColor(...ORANGE)
    doc.circle(M + 7, y - 1.3, 0.9, 'F')
    doc.text(formatDateLong(tk.event.start_date), M + 10, y)
    y += 5.5
  }
  const location = tk.event?.location_name || tk.event?.city || ''
  if (location) {
    doc.setFillColor(...ORANGE)
    doc.circle(M + 7, y - 1.3, 0.9, 'F')
    doc.text(doc.splitTextToSize(location, mainW - 16).slice(0, 1), M + 10, y)
    y += 5.5
  }

  const sepY = cardH + M - 22
  doc.setDrawColor(...GRAY_LIGHT)
  doc.setLineWidth(0.3)
  doc.line(M + 6, sepY, M + mainW - 6, sepY)

  const infoY = sepY + 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.8)
  doc.setTextColor(...GRAY)
  doc.text(t('buyerTickets.typeLabel').toUpperCase(), M + 6, infoY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...INK)
  doc.text(tk.ticket_type?.name || '—', M + 6, infoY + 5)

  const midX = M + mainW * 0.52
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.8)
  doc.setTextColor(...GRAY)
  doc.text(t('buyerTickets.numberLabel').toUpperCase(), midX, infoY)
  doc.setFont('courier', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...INK)
  doc.text(tk.ticket_number, midX, infoY + 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.8)
  doc.setTextColor(...GRAY)
  doc.text(t('buyerTickets.orderLabel', { number: orderNumber }), M + 6, cardH + M - 5.5)

  doc.setFillColor(250, 250, 250)
  doc.circle(stubX, M, 3.2, 'F')
  doc.circle(stubX, M + cardH, 3.2, 'F')
  dashedVLine(doc, stubX, M + 6, M + cardH - 6)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(...GRAY)
  doc.text('ACCÈS', stubX + STUB_W / 2, M + 8, { align: 'center' })

  const qrSize = 34
  const qrX = stubX + (STUB_W - qrSize) / 2
  const qrY = M + 12
  doc.setDrawColor(...GRAY_LIGHT)
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, 2, 2, 'FD')
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)
  }
  doc.setFont('courier', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...INK)
  doc.text(tk.ticket_number, stubX + STUB_W / 2, qrY + qrSize + 7, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.setTextColor(...GRAY)
  doc.text(doc.splitTextToSize(t('buyerTickets.modalHint'), STUB_W - 8), stubX + STUB_W / 2, qrY + qrSize + 12, { align: 'center' })
}

const downloadingId = ref<string | null>(null)
async function downloadTicket(tk: TicketWithDetails) {
  if (downloadingId.value) return
  downloadingId.value = tk.id
  try {
    await ensure(tk.id, tk.qr_token)
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: [190, 95], orientation: 'landscape' })
    drawTicketPage(doc, tk, qrCache.value[tk.id] || null, tk.order?.order_number || '')
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
    await Promise.all(group.tickets.map((tk) => ensure(tk.id, tk.qr_token)))
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: [190, 95], orientation: 'landscape' })
    group.tickets.forEach((tk, i) => {
      if (i > 0) doc.addPage([190, 95], 'landscape')
      drawTicketPage(doc, tk, qrCache.value[tk.id] || null, group.orderNumber)
    })
    doc.save(`billets-${group.orderNumber || group.orderId.slice(0, 8)}.pdf`)
  } catch (e) {
    console.error('[mes-billets] échec génération PDF du groupe :', e)
  } finally {
    downloadingGroupId.value = null
  }
}

const statusClasses: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  valid: 'bg-green-100 text-tikeo-success',
  used: 'bg-tikeo-gray-light text-tikeo-gray-text',
  cancelled: 'bg-red-100 text-tikeo-error',
  refunded: 'bg-blue-100 text-tikeo-blue',
  expired: 'bg-tikeo-gray-light text-tikeo-gray-text',
}
</script>

<template>
  <div class="mx-auto max-w-tikeo-container px-4 py-6 md:px-6">
    <AccountNav />

    <h1 class="mb-6 text-xl font-bold text-tikeo-black">{{ t('header.myTickets') }}</h1>

    <p v-if="errorMessage" class="mb-4 border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{{ errorMessage }}</p>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-20 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>

    <div v-else-if="tickets.length === 0" class="flex flex-col items-center gap-3 border border-dashed border-tikeo-border p-10 text-center">
      <p class="text-sm font-semibold text-tikeo-black">{{ t('buyerTickets.empty') }}</p>
      <p class="max-w-sm text-xs text-tikeo-gray-text">{{ t('buyerTickets.emptyHint') }}</p>
      <NuxtLink to="/evenements" class="btn-primary mt-1">{{ t('common.browseEvents') }}</NuxtLink>
    </div>

    <template v-else>
      <ul class="space-y-3">
        <li v-for="group in paginatedGroups" :key="group.orderId" class="overflow-hidden border border-tikeo-border bg-white">
          <!-- En-tête compact du groupe (une commande = une ligne) -->
          <button
            type="button"
            class="flex w-full items-center gap-3 p-3 text-left transition hover:bg-tikeo-gray-light/60"
            @click="toggleGroup(group.orderId)"
          >
            <div class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-gradient-to-br from-tikeo-orange to-tikeo-orange-strong">
              <img v-if="group.event?.cover_image" :src="group.event.cover_image" :alt="group.event?.title" class="h-14 w-14 object-cover" />
              <span v-else class="text-xs font-bold text-white">Tikeo</span>
            </div>

            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-bold text-tikeo-black">{{ group.event?.title }}</p>
              <p class="mt-0.5 truncate text-xs text-tikeo-gray-text">
                {{ group.event ? formatDate(group.event.start_date) : '' }} · {{ group.event?.city }}
              </p>
            </div>

            <span class="hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline-block" :class="groupStatusSummary(group).classes">
              {{ groupStatusSummary(group).label }}
            </span>
            <span class="shrink-0 rounded-full bg-tikeo-gray-light px-2 py-0.5 text-[11px] font-semibold text-tikeo-gray-text">
              {{ t('buyerTickets.ticketsCount', group.tickets.length) }}
            </span>

            <svg
              class="h-4 w-4 shrink-0 text-tikeo-gray-text transition-transform"
              :class="{ 'rotate-180': expanded.has(group.orderId) }"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.19l3.71-3.96a.75.75 0 111.1 1.02l-4.25 4.5a.75.75 0 01-1.1 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
            </svg>
          </button>

          <!-- Détail des billets de la commande, replié par défaut -->
          <div v-if="expanded.has(group.orderId)" class="border-t border-tikeo-border">
            <div class="flex flex-wrap items-center justify-between gap-2 bg-tikeo-gray-light/40 px-3 py-2">
              <NuxtLink v-if="group.event?.slug" :to="`/e/${group.event.slug}`" class="text-xs font-semibold text-tikeo-orange">
                {{ t('buyerOrders.viewEvent') }}
              </NuxtLink>
              <span v-else />
              <button
                v-if="group.tickets.length > 1"
                type="button"
                class="rounded border border-tikeo-orange px-2.5 py-1 text-[11px] font-semibold text-tikeo-orange transition hover:bg-tikeo-orange hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="downloadingGroupId === group.orderId"
                @click="downloadGroup(group)"
              >
                {{ downloadingGroupId === group.orderId ? t('buyerTickets.downloadingAll') : t('buyerTickets.downloadAll') }}
              </button>
            </div>

            <ul class="divide-y divide-tikeo-border">
              <li v-for="tk in group.tickets" :key="tk.id" class="flex items-center gap-3 px-3 py-2.5">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center border border-tikeo-border bg-white p-0.5">
                  <img v-if="qrCache[tk.id]" :src="qrCache[tk.id]" :alt="`QR — ${tk.ticket_number}`" class="h-full w-full object-contain" />
                </div>

                <div class="min-w-0 flex-1">
                  <p class="truncate text-xs font-semibold text-tikeo-black">{{ tk.ticket_type?.name }}</p>
                  <p class="truncate font-mono text-[11px] text-tikeo-gray-text">{{ t('buyerTickets.ticketNumber', { number: tk.ticket_number }) }}</p>
                </div>

                <span class="hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:inline-block" :class="statusClasses[tk.status]">
                  {{ t(`ticketStatus.${tk.status}`) }}
                </span>

                <div class="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    class="rounded border border-tikeo-border px-2 py-1 text-[11px] font-semibold text-tikeo-black transition hover:bg-tikeo-gray-light"
                    @click="openTicket(tk)"
                  >
                    {{ t('buyerTickets.view') }}
                  </button>
                  <button
                    type="button"
                    class="rounded bg-tikeo-orange px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-tikeo-orange-strong disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="downloadingId === tk.id"
                    @click="downloadTicket(tk)"
                  >
                    {{ downloadingId === tk.id ? t('buyerTickets.downloading') : t('buyerTickets.download') }}
                  </button>
                </div>
              </li>
            </ul>
          </div>
        </li>
      </ul>

      <!-- Pagination des commandes -->
      <div v-if="pageCount > 1" class="mt-5 flex items-center justify-center gap-3">
        <button
          type="button"
          class="rounded border border-tikeo-border px-3 py-1.5 text-xs font-semibold text-tikeo-black transition hover:bg-tikeo-gray-light disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="currentPage === 1"
          @click="currentPage--"
        >
          {{ t('buyerTickets.pagePrev') }}
        </button>
        <span class="text-xs text-tikeo-gray-text">{{ t('buyerTickets.pageOf', { current: currentPage, total: pageCount }) }}</span>
        <button
          type="button"
          class="rounded border border-tikeo-border px-3 py-1.5 text-xs font-semibold text-tikeo-black transition hover:bg-tikeo-gray-light disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="currentPage === pageCount"
          @click="currentPage++"
        >
          {{ t('buyerTickets.pageNext') }}
        </button>
      </div>
    </template>

    <!-- Modale « Voir » : billet agrandi -->
    <Teleport to="body">
      <div v-if="selectedTicket" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" @click.self="closeTicket">
        <div class="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-xl">
          <div class="relative h-32 w-full bg-gradient-to-br from-tikeo-orange to-tikeo-orange-strong">
            <img
              v-if="selectedTicket.event?.cover_image"
              :src="selectedTicket.event.cover_image"
              :alt="selectedTicket.event?.title"
              class="h-32 w-full object-cover"
            />
            <span v-else class="flex h-32 w-full items-center justify-center text-base font-bold tracking-wide text-white">Tikeo</span>
            <button
              type="button"
              class="absolute right-2 top-2 rounded-full bg-black/40 px-2 py-1 text-xs font-semibold text-white hover:bg-black/60"
              @click="closeTicket"
            >
              ✕ {{ t('buyerTickets.close') }}
            </button>
          </div>

          <div class="p-5">
            <p class="text-base font-bold text-tikeo-black">{{ selectedTicket.event?.title }}</p>
            <p class="mt-1 text-xs text-tikeo-gray-text">
              {{ selectedTicket.event ? formatDateLong(selectedTicket.event.start_date) : '' }}
            </p>
            <p class="text-xs text-tikeo-gray-text">{{ selectedTicket.event?.location_name || selectedTicket.event?.city }}</p>

            <div class="mt-4 border-t border-dashed border-tikeo-border pt-4">
              <p class="text-[10px] font-semibold uppercase tracking-wide text-tikeo-gray-text">{{ t('buyerTickets.typeLabel') }}</p>
              <p class="text-sm font-bold text-tikeo-black">{{ selectedTicket.ticket_type?.name }}</p>
              <p class="mt-2 text-[10px] font-semibold uppercase tracking-wide text-tikeo-gray-text">{{ t('buyerTickets.numberLabel') }}</p>
              <p class="font-mono text-sm font-bold text-tikeo-black">{{ selectedTicket.ticket_number }}</p>
            </div>

            <div class="mt-4 flex flex-col items-center gap-2">
              <img
                v-if="qrCache[selectedTicket.id]"
                :src="qrCache[selectedTicket.id]"
                :alt="`QR — ${selectedTicket.ticket_number}`"
                class="h-48 w-48 border border-tikeo-border p-2"
              />
              <p class="text-center text-[11px] text-tikeo-gray-text">{{ t('buyerTickets.modalHint') }}</p>
            </div>

            <button
              type="button"
              class="btn-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="downloadingId === selectedTicket.id"
              @click="downloadTicket(selectedTicket)"
            >
              {{ downloadingId === selectedTicket.id ? t('buyerTickets.downloading') : t('buyerTickets.download') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
