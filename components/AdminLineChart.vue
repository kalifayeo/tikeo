<script setup lang="ts">
/**
 * Graphique en ligne minimaliste, en SVG pur (même esprit que le graphique
 * d'évolution des ventes de EventTicketStatsPanel.vue) : pas de dépendance
 * de rendu lourde pour une simple courbe de tendance dans un tableau de bord.
 */
const props = withDefaults(
  defineProps<{
    values: number[]
    labels?: string[]
    color?: string
    height?: number
  }>(),
  { color: '#FF7A00', height: 140 }
)

const W = 600
const H = computed(() => props.height)
const PAD = 24

const points = computed(() => {
  const vals = props.values.length ? props.values : [0]
  const max = Math.max(...vals, 1)
  const min = Math.min(...vals, 0)
  const range = max - min || 1
  const step = vals.length > 1 ? (W - PAD * 2) / (vals.length - 1) : 0
  return vals.map((v, i) => {
    const x = PAD + i * step
    const y = H.value - PAD - ((v - min) / range) * (H.value - PAD * 2)
    return { x, y, v }
  })
})

const linePoints = computed(() => points.value.map((p) => `${p.x},${p.y}`).join(' '))
const areaPoints = computed(() => {
  if (!points.value.length) return ''
  const first = points.value[0]
  const last = points.value[points.value.length - 1]
  return `${first.x},${H.value - PAD} ${linePoints.value} ${last.x},${H.value - PAD}`
})

const maxValue = computed(() => Math.max(...props.values, 1))
</script>

<template>
  <div>
    <svg :viewBox="`0 0 ${W} ${H}`" class="h-auto w-full" role="img" aria-hidden="true">
      <line :x1="PAD" :y1="H - PAD" :x2="W - PAD" :y2="H - PAD" stroke="currentColor" class="text-tikeo-border" stroke-width="1" />
      <polygon :points="areaPoints" :fill="color" opacity="0.08" />
      <polyline :points="linePoints" fill="none" :stroke="color" stroke-width="2" />
      <circle v-for="(p, i) in points" :key="i" :cx="p.x" :cy="p.y" r="2.5" :fill="color" />
    </svg>
    <div v-if="labels?.length" class="mt-1 flex justify-between text-[10px] text-tikeo-gray-text">
      <span>{{ labels[0] }}</span>
      <span>{{ labels[labels.length - 1] }}</span>
    </div>
  </div>
</template>
