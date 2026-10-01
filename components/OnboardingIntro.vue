<script setup lang="ts">
/**
 * Introduction plein écran affichée à la toute première visite sur un
 * appareil : pages de présentation avec Précédent / Suivant, « Passer
 * l'introduction » et une croix pour fermer. Le contenu (titre, texte,
 * image ou emoji) est géré par l'admin (/admin/introduction).
 */
import type { OnboardingSlide } from '~/types/database'

const props = defineProps<{ slides: OnboardingSlide[] }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const { t } = useI18n()

const index = ref(0)
const direction = ref<'next' | 'prev'>('next')
const total = computed(() => props.slides.length)
const current = computed(() => props.slides[index.value])
const isLast = computed(() => index.value === total.value - 1)

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
  if (e.key === 'ArrowRight') next()
  else if (e.key === 'ArrowLeft') prev()
  else if (e.key === 'Escape') emit('close')
}

// Balayage tactile (mobile) : gauche = suivant, droite = précédent.
let touchX = 0
const onTouchStart = (e: TouchEvent) => (touchX = e.changedTouches[0].clientX)
function onTouchEnd(e: TouchEvent) {
  const dx = e.changedTouches[0].clientX - touchX
  if (Math.abs(dx) < 50) return
  dx < 0 ? next() : prev()
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  document.body.style.overflow = 'hidden'
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      :aria-label="t('engagement.introLabel')"
    >
      <div
        class="relative flex max-h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-tikeo-surface shadow-2xl sm:max-h-[92vh]"
        @touchstart.passive="onTouchStart"
        @touchend.passive="onTouchEnd"
      >
        <!-- Croix de fermeture -->
        <button
          type="button"
          class="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center bg-black/25 text-white backdrop-blur transition hover:bg-black/40"
          :aria-label="t('engagement.close')"
          @click="emit('close')"
        >
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <!-- Compteur de page -->
        <span class="absolute left-4 top-4 z-20 bg-black/25 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
          {{ t('engagement.pageOf', { current: index + 1, total }) }}
        </span>

        <!-- Zone visuelle (dégradé de marque + image ou emoji) -->
        <div class="relative h-60 shrink-0 overflow-hidden bg-tikeo-brand sm:h-64">
          <div class="pointer-events-none absolute -left-10 -top-10 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
          <div class="pointer-events-none absolute -bottom-12 -right-8 h-52 w-52 rounded-full bg-white/20 blur-3xl" />
          <Transition :name="direction === 'next' ? 'intro-slide-next' : 'intro-slide-prev'" mode="out-in">
            <div :key="current.id" class="absolute inset-0 flex items-center justify-center">
              <img v-if="current.image_url" :src="current.image_url" :alt="current.title" class="h-full w-full object-cover" />
              <span v-else class="intro-float select-none text-[92px] leading-none drop-shadow-lg">{{ current.emoji || '🎟️' }}</span>
            </div>
          </Transition>
          <div class="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />
        </div>

        <!-- Texte -->
        <div class="flex-1 overflow-y-auto px-6 pb-2 pt-6 text-center">
          <Transition :name="direction === 'next' ? 'intro-slide-next' : 'intro-slide-prev'" mode="out-in">
            <div :key="current.id">
              <h2 class="text-xl font-extrabold leading-tight text-tikeo-black sm:text-2xl">{{ current.title }}</h2>
              <p v-if="current.description" class="mt-3 whitespace-pre-line text-sm leading-relaxed text-tikeo-gray-text">{{ current.description }}</p>
            </div>
          </Transition>
        </div>

        <!-- Points de progression -->
        <div class="flex items-center justify-center gap-2 px-6 py-4" role="tablist">
          <button
            v-for="(s, i) in slides"
            :key="s.id"
            type="button"
            role="tab"
            :aria-selected="i === index"
            :aria-label="t('engagement.pageOf', { current: i + 1, total })"
            class="h-2 transition-all duration-300"
            :class="i === index ? 'w-7 bg-tikeo-orange' : 'w-2 bg-tikeo-border hover:bg-tikeo-gray-text/50'"
            @click="goTo(i)"
          />
        </div>

        <!-- Actions -->
        <div class="border-t border-tikeo-border px-6 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4">
          <div class="flex items-center gap-3">
            <button v-if="index > 0" type="button" class="btn-secondary flex-1" @click="prev">{{ t('engagement.previous') }}</button>
            <button type="button" class="btn-primary flex-1" @click="next">{{ isLast ? t('engagement.start') : t('engagement.next') }}</button>
          </div>
          <button v-if="!isLast" type="button" class="mt-3 block w-full text-center text-xs font-semibold text-tikeo-gray-text hover:text-tikeo-orange" @click="emit('close')">
            {{ t('engagement.skipIntro') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.intro-slide-next-enter-active,
.intro-slide-next-leave-active,
.intro-slide-prev-enter-active,
.intro-slide-prev-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.intro-slide-next-enter-from,
.intro-slide-prev-leave-to {
  opacity: 0;
  transform: translateX(28px);
}
.intro-slide-next-leave-to,
.intro-slide-prev-enter-from {
  opacity: 0;
  transform: translateX(-28px);
}
.intro-float {
  animation: intro-float 3.2s ease-in-out infinite;
}
@keyframes intro-float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-10px) scale(1.04); }
}
@media (prefers-reduced-motion: reduce) {
  .intro-float { animation: none; }
  .intro-slide-next-enter-active, .intro-slide-next-leave-active,
  .intro-slide-prev-enter-active, .intro-slide-prev-leave-active { transition: none; }
}
</style>
