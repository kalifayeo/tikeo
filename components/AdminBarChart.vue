<script setup lang="ts">
/** Barres horizontales simples (top événements par revenu, etc.), en SVG pur. */
const props = withDefaults(
  defineProps<{
    items: { label: string; value: number }[]
    color?: string
    formatValue?: (v: number) => string
  }>(),
  { color: '#FF7A00' }
)

const maxValue = computed(() => Math.max(...props.items.map((i) => i.value), 1))
function widthPct(v: number) {
  return Math.max(2, Math.round((v / maxValue.value) * 100))
}
function format(v: number) {
  return props.formatValue ? props.formatValue(v) : String(v)
}
</script>

<template>
  <div class="space-y-2.5">
    <div v-for="(item, i) in items" :key="i">
      <div class="mb-0.5 flex items-center justify-between text-xs">
        <span class="truncate text-tikeo-black">{{ item.label }}</span>
        <span class="shrink-0 pl-2 font-semibold text-tikeo-black">{{ format(item.value) }}</span>
      </div>
      <div class="h-1.5 w-full bg-tikeo-surface-alt">
        <div class="h-1.5" :style="{ width: widthPct(item.value) + '%', backgroundColor: color }" />
      </div>
    </div>
  </div>
</template>
