<script setup lang="ts">
/**
 * Nombre qui s'incrémente jusqu'à sa valeur (tableau de bord, revenus).
 * Pas d'animation si l'utilisateur a demandé « réduire les animations ».
 */
const props = withDefaults(defineProps<{ value: number; duration?: number; suffix?: string }>(), { duration: 900, suffix: '' })

const shown = ref(0)
let raf = 0

function run(to: number) {
  cancelAnimationFrame(raf)
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduce || typeof window === 'undefined') {
    shown.value = to
    return
  }
  const from = shown.value
  const start = performance.now()
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / props.duration)
    const eased = 1 - Math.pow(1 - p, 4)
    shown.value = Math.round(from + (to - from) * eased)
    if (p < 1) raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

onMounted(() => run(props.value))
watch(() => props.value, (v) => run(v))
onBeforeUnmount(() => cancelAnimationFrame(raf))

const text = computed(() => shown.value.toLocaleString('fr-FR'))
</script>

<template>
  <span class="tabular-nums">{{ text }}{{ suffix }}</span>
</template>
