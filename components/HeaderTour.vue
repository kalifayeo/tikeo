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

// Pictogramme affiché dans la bulle selon le bouton présenté.
const TARGET_ICONS: Record<string, string> = {
  search: 'search', publish: 'calendar-plus', pricing: 'wallet', community: 'users', notifications: 'bell',
  favorites: 'heart', account: 'user', theme: 'sparkles', language: 'globe',
  'nav-home': 'home', 'nav-explore': 'compass', 'nav-scanner': 'scan', 'nav-profile': 'user', 'nav-settings': 'settings',
}
const stepIcon = computed(() => TARGET_ICONS[current.value?.target ?? ''] ?? 'info')

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
const CARD_W = 340
const CARD_H = 250 // hauteur estimée de la bulle (pour choisir dessus / dessous)
const tooltipStyle = computed(() => {
  const r = rect.value
  if (!r) return {}
  const w = Math.min(CARD_W, vw.value - 24)
  const cx = r.left + r.width / 2
  const left = Math.max(12, Math.min(cx - w / 2, vw.value - w - 12))
  const below = r.top + r.height + CARD_H < vh.value
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
        class="tour-spot pointer-events-none absolute border-2 border-[#FF7A00]"
        :style="{ top: rect.top + 'px', left: rect.left + 'px', width: rect.width + 'px', height: rect.height + 'px' }"
      >
        <span class="tour-ping absolute -inset-1 border-2 border-[#FF7A00]" aria-hidden="true" />
      </div>

      <!-- Bulle explicative -->
      <Transition name="tour-pop" mode="out-in">
        <div :key="current.id" class="absolute bg-tikeo-surface shadow-2xl" :style="tooltipStyle" @click.stop>
          <span class="absolute inset-x-0 top-0 h-1 bg-tikeo-brand" aria-hidden="true" />
          <span
            class="absolute h-4 w-4 rotate-45 bg-tikeo-surface"
            :class="tooltipBelow ? '-top-2' : '-bottom-2'"
            :style="arrowStyle"
          />
          <div class="relative p-4 pt-5">
            <div class="mb-3 flex items-center gap-3">
              <span class="flex h-11 w-11 shrink-0 items-center justify-center bg-tikeo-ink text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">
                <AppIcon :name="stepIcon" class="h-5 w-5" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-[11px] font-bold uppercase tracking-wider text-tikeo-orange">
                  {{ t('engagement.stepOf', { current: index + 1, total: active.length }) }}
                </p>
                <h3 class="font-display text-base font-extrabold leading-tight text-tikeo-black">{{ current.title }}</h3>
              </div>
              <button type="button" class="-mr-1 -mt-5 flex h-8 w-8 shrink-0 items-center justify-center text-tikeo-gray-text transition-colors hover:text-tikeo-black" :aria-label="t('engagement.close')" @click="emit('close')">
                <AppIcon name="close" class="h-4 w-4" :stroke="2.2" />
              </button>
            </div>
            <p v-if="current.description" class="text-sm leading-relaxed text-tikeo-gray-text">{{ current.description }}</p>

            <!-- Progression -->
            <div class="mt-4 flex gap-1" aria-hidden="true">
              <span v-for="(s, i) in active" :key="s.id" class="h-1 flex-1 transition-colors duration-300" :class="i <= index ? 'bg-[#FF7A00]' : 'bg-tikeo-border'" />
            </div>

            <div class="mt-4 flex items-center gap-2">
              <button
                v-if="index > 0"
                type="button"
                class="flex h-10 w-10 shrink-0 items-center justify-center border border-tikeo-border text-tikeo-black transition-colors hover:border-tikeo-ink dark:hover:border-[#FF7A00]"
                :aria-label="t('engagement.previous')"
                :title="t('engagement.previous')"
                @click="go(-1)"
              >
                <AppIcon name="arrow-left" class="h-[18px] w-[18px]" :stroke="2.2" />
              </button>
              <button type="button" class="btn-ink !h-10 flex-1 !text-[13px]" @click="go(1)">
                {{ isLast ? t('engagement.finish') : t('engagement.next') }}
                <AppIcon :name="isLast ? 'check' : 'arrow-right'" class="h-[18px] w-[18px]" :stroke="2.4" />
              </button>
            </div>
            <button v-if="!isLast" type="button" class="mx-auto mt-2.5 block text-[11px] font-bold text-tikeo-gray-text transition-colors hover:text-tikeo-orange" @click="emit('close')">
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
  box-shadow: 0 0 0 9999px rgba(11, 22, 48, 0.72);
  transition: top 0.35s cubic-bezier(0.22, 1, 0.36, 1), left 0.35s cubic-bezier(0.22, 1, 0.36, 1), width 0.35s cubic-bezier(0.22, 1, 0.36, 1), height 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
.tour-ping { animation: tour-ping 1.8s ease-out infinite; }
@keyframes tour-ping {
  0% { opacity: 0.9; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.18); }
}
.tour-pop-enter-active,
.tour-pop-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.tour-pop-enter-from,
.tour-pop-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}
@media (prefers-reduced-motion: reduce) {
  .tour-spot { transition: none; }
  .tour-ping { animation: none; display: none; }
  .tour-pop-enter-active, .tour-pop-leave-active { transition: none; }
}
</style>
