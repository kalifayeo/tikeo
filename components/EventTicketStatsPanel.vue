<script setup lang="ts">
import type { EventTicketStats } from '~/composables/useEventTicketStats'

const props = defineProps<{ stats: EventTicketStats }>()
const { t, locale } = useI18n()

const nf = computed(() => new Intl.NumberFormat(locale.value))
const fmt = (n: number) => nf.value.format(n)

// --- Courbe SVG (cumul des billets vendus) + barres (ventes du jour) -----
const W = 640
const H = 220
const PAD = { l: 40, r: 12, t: 12, b: 28 }

const chart = computed(() => {
  const pts = props.stats.timeline
  if (!pts.length) return null
  const maxY = Math.max(...pts.map((p) => p.cumulative), 1)
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b
  const step = pts.length > 1 ? innerW / (pts.length - 1) : 0
  const x = (i: number) => PAD.l + (pts.length > 1 ? i * step : innerW / 2)
  const y = (v: number) => PAD.t + innerH - (v / maxY) * innerH
  const barW = Math.max(Math.min(innerW / pts.length - 4, 28), 3)
  return {
    maxY,
    line: pts.map((p, i) => `${x(i)},${y(p.cumulative)}`).join(' '),
    dots: pts.map((p, i) => ({ cx: x(i), cy: y(p.cumulative), p })),
    bars: pts.map((p, i) => ({ x: x(i) - barW / 2, y: y(p.sold), w: barW, h: PAD.t + innerH - y(p.sold), p })),
    baseY: PAD.t + innerH,
    ticks: [0, 0.5, 1].map((r) => ({ v: Math.round(maxY * r), y: y(maxY * r) })),
    first: pts[0].date,
    last: pts[pts.length - 1].date,
  }
})

const dayLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(locale.value, { day: '2-digit', month: 'short' })

// --- Export CSV des billets émis ---
const exporting = ref(false)
const exportMsg = ref('')
async function handleExport() {
  exporting.value = true
  exportMsg.value = ''
  try {
    const n = await exportEventTicketsCsv(props.stats.event.id, props.stats.event.title)
    exportMsg.value = n ? t('ticketStats.exported', { n }) : t('ticketStats.exportEmpty')
  } catch {
    exportMsg.value = t('ticketStats.exportError')
  } finally {
    exporting.value = false
  }
}
const pct = (n: number, total: number) => (total ? Math.min(Math.round((n / total) * 100), 100) : 0)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-end gap-3">
      <span v-if="exportMsg" class="text-xs text-tikeo-gray-text">{{ exportMsg }}</span>
      <button type="button" class="btn-secondary !py-2 text-xs" :disabled="exporting" @click="handleExport">
        <AppIcon name="download" class="h-4 w-4" />{{ exporting ? '…' : t('ticketStats.exportCsv') }}
      </button>
    </div>

    <!-- Cartes de synthèse -->
    <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
      <div class="border border-tikeo-border p-3">
        <p class="text-xs text-tikeo-gray-text">{{ t('ticketStats.total') }}</p>
        <p class="mt-1 text-xl font-bold text-tikeo-black">{{ fmt(stats.totals.quantity) }}</p>
      </div>
      <div class="border border-tikeo-border p-3">
        <p class="text-xs text-tikeo-gray-text">{{ t('ticketStats.sold') }}</p>
        <p class="mt-1 text-xl font-bold text-tikeo-success">{{ fmt(stats.totals.sold) }}</p>
      </div>
      <div class="border border-tikeo-border p-3">
        <p class="text-xs text-tikeo-gray-text">{{ t('ticketStats.reserved') }}</p>
        <p class="mt-1 text-xl font-bold text-tikeo-orange">{{ fmt(stats.totals.reserved) }}</p>
      </div>
      <div class="border border-tikeo-border p-3">
        <p class="text-xs text-tikeo-gray-text">{{ t('ticketStats.remaining') }}</p>
        <p class="mt-1 text-xl font-bold text-tikeo-black">{{ fmt(stats.totals.remaining) }}</p>
      </div>
      <div class="col-span-2 border border-tikeo-border p-3 md:col-span-1">
        <p class="text-xs text-tikeo-gray-text">{{ t('ticketStats.revenue') }}</p>
        <p class="mt-1 text-xl font-bold text-tikeo-black">{{ fmt(stats.totals.revenue) }} <span class="text-xs font-normal">FCFA</span></p>
      </div>
    </div>

    <!-- Jauge globale -->
    <div>
      <div class="mb-1 flex justify-between text-xs text-tikeo-gray-text">
        <span>{{ t('ticketStats.progress') }}</span>
        <span class="font-semibold text-tikeo-black">{{ stats.totals.percentSold }}%</span>
      </div>
      <div class="flex h-3 w-full overflow-hidden bg-tikeo-surface-alt">
        <div class="bg-tikeo-success" :style="{ width: pct(stats.totals.sold, stats.totals.quantity) + '%' }" />
        <div class="bg-tikeo-orange" :style="{ width: pct(stats.totals.reserved, stats.totals.quantity) + '%' }" />
      </div>
      <p class="mt-1 text-[11px] text-tikeo-gray-text">
        <span class="text-tikeo-success">■</span> {{ t('ticketStats.sold') }}
        <span class="ml-3 text-tikeo-orange">■</span> {{ t('ticketStats.reserved') }}
      </p>
    </div>

    <p v-if="stats.event.max_tickets_per_buyer" class="text-xs text-tikeo-gray-text">
      {{ t('event.maxTicketsPerBuyerNotice', { n: stats.event.max_tickets_per_buyer }) }}
    </p>

    <!-- Détail par type de billet -->
    <div class="overflow-x-auto border border-tikeo-border">
      <table class="w-full min-w-[560px] text-left text-sm">
        <thead class="bg-tikeo-surface-alt text-xs text-tikeo-gray-text">
          <tr>
            <th class="px-3 py-2">{{ t('ticketStats.ticketType') }}</th>
            <th class="px-3 py-2 text-right">{{ t('ticketStats.price') }}</th>
            <th class="px-3 py-2 text-right">{{ t('ticketStats.total') }}</th>
            <th class="px-3 py-2 text-right">{{ t('ticketStats.sold') }}</th>
            <th class="px-3 py-2 text-right">{{ t('ticketStats.reserved') }}</th>
            <th class="px-3 py-2 text-right">{{ t('ticketStats.remaining') }}</th>
            <th class="px-3 py-2 text-right">{{ t('ticketStats.revenue') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tt in stats.types" :key="tt.id" class="border-t border-tikeo-border">
            <td class="px-3 py-2 font-semibold text-tikeo-black">
              {{ tt.name }}
              <span v-if="tt.remaining === 0" class="ml-1 text-[11px] font-semibold uppercase text-tikeo-error">{{ t('event.soldOut') }}</span>
            </td>
            <td class="px-3 py-2 text-right">{{ tt.price === 0 ? t('event.free') : fmt(tt.price) }}</td>
            <td class="px-3 py-2 text-right">{{ fmt(tt.quantity) }}</td>
            <td class="px-3 py-2 text-right text-tikeo-success">{{ fmt(tt.sold) }}</td>
            <td class="px-3 py-2 text-right text-tikeo-orange">{{ fmt(tt.reserved) }}</td>
            <td class="px-3 py-2 text-right">{{ fmt(tt.remaining) }}</td>
            <td class="px-3 py-2 text-right">{{ fmt(tt.revenue) }}</td>
          </tr>
          <tr v-if="!stats.types.length">
            <td colspan="7" class="px-3 py-6 text-center text-tikeo-gray-text">{{ t('ticketStats.noTypes') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Évolution des ventes -->
    <div>
      <h3 class="mb-2 text-sm font-bold text-tikeo-black">{{ t('ticketStats.evolution') }}</h3>
      <p v-if="!chart" class="border border-tikeo-border p-6 text-center text-sm text-tikeo-gray-text">{{ t('ticketStats.noSales') }}</p>
      <div v-else class="border border-tikeo-border p-3">
        <svg :viewBox="`0 0 ${W} ${H}`" class="h-auto w-full" role="img" :aria-label="t('ticketStats.evolution')">
          <g v-for="tk in chart.ticks" :key="tk.v">
            <line :x1="PAD.l" :x2="W - PAD.r" :y1="tk.y" :y2="tk.y" stroke="currentColor" stroke-opacity="0.12" />
            <text :x="PAD.l - 6" :y="tk.y + 3" text-anchor="end" font-size="10" fill="currentColor" fill-opacity="0.6">{{ tk.v }}</text>
          </g>
          <rect v-for="b in chart.bars" :key="'b' + b.p.date" :x="b.x" :y="b.y" :width="b.w" :height="b.h" fill="#F97316" fill-opacity="0.35">
            <title>{{ dayLabel(b.p.date) }} : {{ b.p.sold }}</title>
          </rect>
          <polyline :points="chart.line" fill="none" stroke="#16A34A" stroke-width="2" />
          <circle v-for="d in chart.dots" :key="'d' + d.p.date" :cx="d.cx" :cy="d.cy" r="3" fill="#16A34A">
            <title>{{ dayLabel(d.p.date) }} : {{ d.p.cumulative }} ({{ d.p.sold >= 0 ? '+' : '' }}{{ d.p.sold }})</title>
          </circle>
          <text :x="PAD.l" :y="H - 8" font-size="10" fill="currentColor" fill-opacity="0.6">{{ dayLabel(chart.first) }}</text>
          <text :x="W - PAD.r" :y="H - 8" text-anchor="end" font-size="10" fill="currentColor" fill-opacity="0.6">{{ dayLabel(chart.last) }}</text>
        </svg>
        <p class="mt-1 text-[11px] text-tikeo-gray-text">
          <span style="color: #16a34a">●</span> {{ t('ticketStats.cumulative') }}
          <span class="ml-3" style="color: #f97316">■</span> {{ t('ticketStats.perDay') }}
        </p>
      </div>
    </div>
  </div>
</template>
