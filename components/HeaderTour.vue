<script setup lang="ts">
/**
 * Visite guidée : met en lumière, un par un, les boutons importants du
 * header (repérés par l'attribut `data-tour="<cible>"`) avec une bulle
 * explicative. Les étapes sont gérées par l'admin (/admin/introduction) ;
 * une étape dont la cible n'est pas visible sur l'écran actuel (ex. un
 * bouton desktop sur mobile) est simplement ignorée.
 */
import type { TourStep } from '~/types/database'

const props = defineProps<{ steps: TourStep[] }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const { t } = useI18n()

function findTarget(target: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)
  for (const n of nodes) {
    const r = n.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return n
  }
  return null
}

const active = ref<TourStep[]>([])
const index = ref(0)
const rect = ref<{ top: number; left: number; width: number; height: number } | null>(null)
const vw = ref(0)
const vh = ref(0)
const current = computed(() => active.value[index.value])
const isLast = computed(() => index.value === active.value.length - 1)

const PAD = 6

function measure() {
  vw.value = window.innerWidth
  vh.value = window.innerHeight
  const step = current.value
  const el = step ? findTarget(step.target) : null
  if (!el) {
    // Cible devenue introuvable (ex. redimensionnement) : on passe à la suivante.
    rect.value = null
    if (index.value < active.value.length - 1) {
      index.value++
      nextTick(measure)
    } else {
      emit('close')
    }
    return
  }
  const r = el.getBoundingClientRect()
  rect.value = { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 }
}

let raf = 0
function schedule() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(measure)
}

function go(delta: 1 | -1) {
  const nextIndex = index.value + delta
  if (nextIndex < 0) return
  if (nextIndex >= active.value.length) return emit('close')
  index.value = nextIndex
  nextTick(measure)
}

// Bulle : sous la cible (ou au-dessus si elle est en bas d'écran), centrée
// sur la cible mais toujours contenue dans l'écran.
const CARD_W = 320
const tooltipStyle = computed(() => {
  const r = rect.value
  if (!r) return {}
  const w = Math.min(CARD_W, vw.value - 24)
  const cx = r.left + r.width / 2
  const left = Math.max(12, Math.min(cx - w / 2, vw.value - w - 12))
  const below = r.top + r.height + 190 < vh.value
  return below
    ? { width: `${w}px`, left: `${left}px`, top: `${r.top + r.height + 14}px` }
    : { width: `${w}px`, left: `${left}px`, bottom: `${vh.value - r.top + 14}px` }
})
const arrowStyle = computed(() => {
  const r = rect.value
  if (!r) return {}
  const w = Math.min(CARD_W, vw.value - 24)
  const cx = r.left + r.width / 2
  const left = Math.max(12, Math.min(cx - w / 2, vw.value - w - 12))
  return { left: `${Math.max(16, Math.min(cx - left - 8, w - 32))}px` }
})
const tooltipBelow = computed(() => !!rect.value && rect.value.top + rect.value.height + 190 < vh.value)

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowRight' || e.key === 'Enter') go(1)
  else if (e.key === 'ArrowLeft') go(-1)
  else if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  // Le header se masque au scroll : on repart du haut de page et on fige le défilement.
  window.scrollTo({ top: 0 })
  document.body.style.overflow = 'hidden'
  active.value = props.steps.filter((s) => findTarget(s.target))
  if (!active.value.length) return emit('close')
  measure()
  window.addEventListener('resize', schedule)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', schedule)
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div v-if="current && rect" class="fixed inset-0 z-[110]" role="dialog" aria-modal="true" :aria-label="t('engagement.tourLabel')">
      <!-- Calque qui bloque les clics pendant la visite -->
      <div class="absolute inset-0" @click="go(1)" />

      <!-- Projecteur sur la cible : l'ombre géante assombrit tout le reste -->
      <div
        class="tour-spot pointer-events-none absolute border-2 border-tikeo-orange"
        :style="{ top: rect.top + 'px', left: rect.left + 'px', width: rect.width + 'px', height: rect.height + 'px' }"
      />

      <!-- Bulle explicative -->
      <Transition name="tour-pop" mode="out-in">
        <div :key="current.id" class="absolute bg-tikeo-surface p-4 shadow-2xl" :style="tooltipStyle" @click.stop>
          <span
            class="absolute h-4 w-4 rotate-45 bg-tikeo-surface"
            :class="tooltipBelow ? '-top-2' : '-bottom-2'"
            :style="arrowStyle"
          />
          <div class="relative">
            <div class="mb-1 flex items-center justify-between">
              <span class="text-[11px] font-bold uppercase tracking-wide text-tikeo-orange">
                {{ t('engagement.stepOf', { current: index + 1, total: active.length }) }}
              </span>
              <button type="button" class="-mr-1 p-1 text-tikeo-gray-text hover:text-tikeo-black" :aria-label="t('engagement.close')" @click="emit('close')">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <h3 class="text-base font-bold text-tikeo-black">{{ current.title }}</h3>
            <p v-if="current.description" class="mt-1 text-sm leading-relaxed text-tikeo-gray-text">{{ current.description }}</p>

            <div class="mt-3 flex items-center gap-1.5">
              <span v-for="(s, i) in active" :key="s.id" class="h-1.5 transition-all" :class="i === index ? 'w-5 bg-tikeo-orange' : 'w-1.5 bg-tikeo-border'" />
            </div>

            <div class="mt-4 flex items-center gap-2">
              <button v-if="index > 0" type="button" class="btn-secondary !px-3 !py-2 text-xs" @click="go(-1)">{{ t('engagement.previous') }}</button>
              <button type="button" class="btn-primary flex-1 !px-3 !py-2 text-xs" @click="go(1)">{{ isLast ? t('engagement.finish') : t('engagement.next') }}</button>
            </div>
            <button v-if="!isLast" type="button" class="mt-2 block w-full text-center text-[11px] font-semibold text-tikeo-gray-text hover:text-tikeo-orange" @click="emit('close')">
              {{ t('engagement.skipTour') }}
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped>
.tour-spot {
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.62), 0 0 0 4px rgba(255, 122, 0, 0.25);
  transition: top 0.3s ease, left 0.3s ease, width 0.3s ease, height 0.3s ease;
  animation: tour-pulse 1.8s ease-in-out infinite;
}
@keyframes tour-pulse {
  0%, 100% { box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.62), 0 0 0 4px rgba(255, 122, 0, 0.25); }
  50% { box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.62), 0 0 0 9px rgba(255, 122, 0, 0.1); }
}
.tour-pop-enter-active,
.tour-pop-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.tour-pop-enter-from,
.tour-pop-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
@media (prefers-reduced-motion: reduce) {
  .tour-spot { animation: none; transition: none; }
}
</style>
