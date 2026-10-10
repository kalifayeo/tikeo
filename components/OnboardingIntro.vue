<script setup lang="ts">
/**
 * Introduction affichée à la toute première visite sur un appareil. Le
 * contenu (titre, texte, image ou icône) est géré par l'admin
 * (/admin/introduction). Aucun emoji : seulement des icônes SVG.
 *
 * Mise en page :
 *  - mobile : carte centrée dans l'écran (marges autour, elle ne prend plus
 *    tout l'écran) — scène colorée en haut (bord de billet perforé), texte et
 *    boutons en bas, balayage gauche/droite pour naviguer ;
 *  - desktop : fenêtre en deux volets — scène à gauche, texte à droite.
 * Barre de progression « stories » cliquable, Précédent / Suivant, Passer.
 */
import type { OnboardingSlide } from '~/types/database'

const props = defineProps<{ slides: OnboardingSlide[] }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const { t } = useI18n()

const index = ref(0)
const direction = ref<'next' | 'prev'>('next')
const total = computed(() => props.slides.length)
const current = computed(() => props.slides[index.value])
const currentIcon = computed(() => resolveIntroIcon(current.value?.icon))
const isLast = computed(() => index.value === total.value - 1)
const counter = computed(() => String(index.value + 1).padStart(2, '0'))
const totalLabel = computed(() => String(total.value).padStart(2, '0'))

function next() {
  if (isLast.value) return emit('close')
  direction.value = 'next'
  index.value++
}
function prev() {
  if (index.value === 0) return
  direction.value = 'prev'
  index.value--
}
function goTo(i: number) {
  direction.value = i > index.value ? 'next' : 'prev'
  index.value = i
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowRight' || e.key === 'Enter') next()
  else if (e.key === 'ArrowLeft') prev()
  else if (e.key === 'Escape') emit('close')
}

// Balayage tactile : gauche = suivant, droite = précédent (on ignore les gestes surtout verticaux).
let touchX = 0
let touchY = 0
function onTouchStart(e: TouchEvent) {
  touchX = e.changedTouches[0].clientX
  touchY = e.changedTouches[0].clientY
}
function onTouchEnd(e: TouchEvent) {
  const dx = e.changedTouches[0].clientX - touchX
  const dy = e.changedTouches[0].clientY - touchY
  if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return
  dx < 0 ? next() : prev()
}

// Précharge l'image de la page suivante : le changement de page reste fluide.
watch(
  index,
  (i) => {
    const url = props.slides[i + 1]?.image_url
    if (url && import.meta.client) new Image().src = url
  },
  { immediate: true }
)

const primaryEl = ref<HTMLButtonElement | null>(null)
onMounted(() => {
  window.addEventListener('keydown', onKey)
  document.body.style.overflow = 'hidden'
  nextTick(() => primaryEl.value?.focus({ preventScroll: true }))
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div
      class="intro-backdrop fixed inset-0 z-[100] flex items-center justify-center bg-tikeo-ink/75 p-4 backdrop-blur-md md:p-6"
      role="dialog"
      aria-modal="true"
      :aria-label="t('engagement.introLabel')"
    >
      <div
        class="intro-card relative flex h-[min(620px,86dvh)] w-full max-w-[400px] flex-col overflow-hidden bg-tikeo-surface shadow-2xl md:h-[min(600px,92vh)] md:max-w-4xl md:flex-row"
        @touchstart.passive="onTouchStart"
        @touchend.passive="onTouchEnd"
      >
        <!-- ============ Scène (visuel) ============ -->
        <div class="intro-stage relative h-[190px] shrink-0 overflow-hidden bg-tikeo-ink min-[400px]:h-[210px] md:h-auto md:w-[46%]">
          <!-- Fond de marque -->
          <div class="absolute inset-0 bg-tikeo-brand opacity-95" />
          <div class="intro-dots absolute inset-0 opacity-30" aria-hidden="true" />
          <div class="intro-blob pointer-events-none absolute -left-16 -top-16 h-60 w-60 rounded-full bg-white/25 blur-3xl" />
          <div class="intro-blob pointer-events-none absolute -bottom-20 -right-10 h-72 w-72 rounded-full bg-[#FFB066]/40 blur-3xl [animation-delay:-3s]" />

          <!-- Visuel de la page -->
          <Transition :name="direction === 'next' ? 'stage-next' : 'stage-prev'" mode="out-in">
            <div :key="current.id" class="absolute inset-0 flex items-center justify-center px-8 pb-4 pt-12 md:pb-6 md:pt-16">
              <template v-if="current.image_url">
                <img :src="current.image_url" :alt="current.title" class="intro-kenburns absolute inset-0 h-full w-full object-cover" />
                <div class="absolute inset-0 bg-gradient-to-t from-tikeo-ink/50 via-transparent to-tikeo-ink/20" />
              </template>
              <!-- Sans image : billet flottant portant l'icône -->
              <div v-else class="intro-float relative">
                <div class="relative flex h-28 w-28 items-center justify-center bg-white shadow-[0_24px_60px_-12px_rgba(0,0,0,0.45)] md:h-56 md:w-56">
                  <span class="absolute -left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-[#FF7A00]/90" aria-hidden="true" />
                  <span class="absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-[#0057B8]/90" aria-hidden="true" />
                  <span class="absolute inset-x-5 bottom-4 border-t-2 border-dashed border-tikeo-border" aria-hidden="true" />
                  <AppIcon :name="currentIcon" class="h-14 w-14 text-tikeo-ink md:h-24 md:w-24" :stroke="1.5" />
                </div>
                <span class="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center bg-tikeo-ink text-[#FF9A3D] shadow-lg"><AppIcon name="sparkles" class="h-5 w-5" /></span>
              </div>
            </div>
          </Transition>

          <!-- Barre supérieure : progression cliquable + fermeture -->
          <div class="absolute inset-x-0 top-0 z-10 flex items-center gap-3 px-4 pt-3.5 md:px-5 md:pt-5">
            <div class="flex flex-1 gap-1.5" role="tablist">
              <button
                v-for="(s, i) in slides"
                :key="s.id"
                type="button"
                role="tab"
                :aria-selected="i === index"
                :aria-label="t('engagement.pageOf', { current: i + 1, total })"
                class="group h-6 flex-1 py-[10px]"
                @click="goTo(i)"
              >
                <span class="block h-[3px] w-full overflow-hidden bg-white/35">
                  <span class="block h-full bg-white transition-all duration-500 ease-out" :style="{ width: i <= index ? '100%' : '0%' }" />
                </span>
              </button>
            </div>
            <button
              type="button"
              class="flex h-9 w-9 shrink-0 items-center justify-center bg-tikeo-ink/35 text-white backdrop-blur transition hover:bg-tikeo-ink/55"
              :aria-label="t('engagement.close')"
              @click="emit('close')"
            >
              <AppIcon name="close" class="h-5 w-5" :stroke="2.2" />
            </button>
          </div>

          <!-- Bord de billet perforé (bas sur mobile, côté droit sur desktop) -->
          <div class="intro-edge-h pointer-events-none absolute inset-x-0 bottom-0 h-[10px] md:hidden" aria-hidden="true" />
          <div class="intro-edge-v pointer-events-none absolute inset-y-0 right-0 hidden w-[10px] md:block" aria-hidden="true" />
        </div>

        <!-- ============ Texte + actions ============ -->
        <div class="flex min-h-0 flex-1 flex-col md:w-[54%]">
          <div class="flex-1 overflow-y-auto px-5 pb-3 pt-5 md:flex md:flex-col md:justify-center md:px-12 md:py-10">
            <Transition :name="direction === 'next' ? 'intro-slide-next' : 'intro-slide-prev'" mode="out-in">
              <div :key="current.id">
                <p class="mb-3 flex items-center gap-2 font-display text-sm font-extrabold tracking-wider text-tikeo-orange">
                  <span class="h-3 w-1 bg-[#FF7A00]" aria-hidden="true" />
                  {{ counter }}<span class="text-tikeo-gray-text/60">/ {{ totalLabel }}</span>
                </p>
                <h2 class="font-display text-[23px] font-extrabold leading-[1.1] text-tikeo-black md:text-[34px]">{{ current.title }}</h2>
                <p v-if="current.description" class="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-tikeo-gray-text md:mt-4 md:text-base">{{ current.description }}</p>
              </div>
            </Transition>
          </div>

          <div class="px-5 pb-4 pt-2 md:px-12 md:pb-8">
            <div class="flex items-stretch gap-3">
              <button
                v-if="index > 0"
                type="button"
                class="flex h-12 w-12 shrink-0 items-center justify-center border border-tikeo-border text-tikeo-black transition-colors hover:border-tikeo-ink dark:hover:border-[#FF7A00]"
                :aria-label="t('engagement.previous')"
                :title="t('engagement.previous')"
                @click="prev"
              >
                <AppIcon name="arrow-left" class="h-5 w-5" :stroke="2.2" />
              </button>
              <button ref="primaryEl" type="button" class="btn-ink !h-12 flex-1 !text-[15px]" @click="next">
                {{ isLast ? t('engagement.start') : t('engagement.next') }}
                <AppIcon :name="isLast ? 'check' : 'arrow-right'" class="h-5 w-5" :stroke="2.4" />
              </button>
            </div>
            <button v-if="!isLast" type="button" class="mx-auto mt-3 flex items-center gap-1 text-xs font-bold text-tikeo-gray-text transition-colors hover:text-tikeo-orange" @click="emit('close')">
              {{ t('engagement.skipIntro') }}
            </button>
            <div v-else class="mt-3 h-4" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.intro-backdrop { animation: intro-fade 0.3s ease both; }
.intro-card { animation: intro-rise 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; }
@keyframes intro-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes intro-rise { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: none; } }

/* Motif de points + bord de billet perforé (couleur = fond de la carte) */
.intro-dots {
  background-image: radial-gradient(rgba(255, 255, 255, 0.55) 1.2px, transparent 1.4px);
  background-size: 18px 18px;
}
.intro-edge-h {
  background-image: radial-gradient(circle at 50% 100%, rgb(var(--tikeo-surface)) 5px, transparent 5.5px);
  background-size: 20px 10px;
}
.intro-edge-v {
  background-image: radial-gradient(circle at 100% 50%, rgb(var(--tikeo-surface)) 5px, transparent 5.5px);
  background-size: 10px 20px;
}

.intro-float { animation: intro-float 3.6s ease-in-out infinite; }
@keyframes intro-float {
  0%, 100% { transform: translateY(0) rotate(-3deg); }
  50% { transform: translateY(-12px) rotate(2deg); }
}
.intro-blob { animation: intro-blob 9s ease-in-out infinite; }
@keyframes intro-blob {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(18px, 14px) scale(1.12); }
}
.intro-kenburns { animation: intro-kenburns 12s ease-out both; }
@keyframes intro-kenburns { from { transform: scale(1.08); } to { transform: scale(1); } }

/* Changement de page : le texte glisse, le visuel se fond et zoome légèrement */
.intro-slide-next-enter-active, .intro-slide-next-leave-active,
.intro-slide-prev-enter-active, .intro-slide-prev-leave-active,
.stage-next-enter-active, .stage-next-leave-active,
.stage-prev-enter-active, .stage-prev-leave-active {
  transition: opacity 0.24s ease, transform 0.24s ease;
}
.intro-slide-next-enter-from, .intro-slide-prev-leave-to { opacity: 0; transform: translateX(26px); }
.intro-slide-next-leave-to, .intro-slide-prev-enter-from { opacity: 0; transform: translateX(-26px); }
.stage-next-enter-from, .stage-prev-leave-to { opacity: 0; transform: scale(0.92) translateX(24px); }
.stage-next-leave-to, .stage-prev-enter-from { opacity: 0; transform: scale(0.92) translateX(-24px); }

@media (prefers-reduced-motion: reduce) {
  .intro-backdrop, .intro-card, .intro-float, .intro-blob, .intro-kenburns { animation: none; }
  .intro-slide-next-enter-active, .intro-slide-next-leave-active,
  .intro-slide-prev-enter-active, .intro-slide-prev-leave-active,
  .stage-next-enter-active, .stage-next-leave-active,
  .stage-prev-enter-active, .stage-prev-leave-active { transition: none; }
}
</style>
