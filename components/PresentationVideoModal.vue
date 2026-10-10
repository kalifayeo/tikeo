<script setup lang="ts">
// Fenêtre de lecture de la vidéo de présentation. Ouverte via
// usePresentationVideo().open() depuis le hero, la barre du haut, etc.
// La lecture démarre à l'ouverture et s'arrête à la fermeture (le lecteur est
// retiré du DOM). Échap, clic sur le fond ou bouton ✕ ferment la fenêtre.
const { t } = useI18n()
const { isOpen, source, poster, close } = usePresentationVideo()

const failed = ref(false)
const closeBtn = ref<HTMLButtonElement | null>(null)

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) close()
}

watch(isOpen, async (open) => {
  if (!import.meta.client) return
  document.documentElement.style.overflow = open ? 'hidden' : ''
  if (open) {
    failed.value = false
    window.addEventListener('keydown', onKey)
    await nextTick()
    closeBtn.value?.focus()
  } else {
    window.removeEventListener('keydown', onKey)
  }
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    document.documentElement.style.overflow = ''
    window.removeEventListener('keydown', onKey)
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[9300] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6"
        role="dialog"
        aria-modal="true"
        :aria-label="t('presentationVideo.title')"
        @click.self="close"
      >
        <div class="pv-card relative w-full max-w-4xl border border-white/10 bg-tikeo-ink shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
          <span class="absolute inset-x-0 top-0 h-[3px] bg-tikeo-brand" aria-hidden="true" />

          <div class="flex items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
            <div class="min-w-0">
              <p class="truncate font-display text-base font-extrabold text-white sm:text-lg">{{ t('presentationVideo.title') }}</p>
              <p class="truncate text-xs text-white/60 sm:text-[13px]">{{ t('presentationVideo.subtitle') }}</p>
            </div>
            <button
              ref="closeBtn"
              type="button"
              class="flex h-10 w-10 shrink-0 items-center justify-center border border-white/25 text-white transition-colors hover:border-[#FF7A00] hover:bg-[#FF7A00] hover:text-tikeo-ink"
              :aria-label="t('presentationVideo.close')"
              @click="close"
            >
              <AppIcon name="close" class="h-5 w-5" :stroke="2.4" />
            </button>
          </div>

          <div class="relative aspect-video w-full bg-black">
            <template v-if="source && !failed">
              <iframe
                v-if="source.kind === 'embed'"
                :src="source.src"
                class="absolute inset-0 h-full w-full"
                :title="t('presentationVideo.title')"
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                allowfullscreen
                referrerpolicy="strict-origin-when-cross-origin"
              />
              <video
                v-else
                :src="source.src"
                :poster="poster || undefined"
                class="absolute inset-0 h-full w-full bg-black object-contain"
                controls
                autoplay
                playsinline
                preload="metadata"
                @error="failed = true"
              />
            </template>

            <div v-else class="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <span class="flex h-14 w-14 items-center justify-center rounded-full bg-[#FF7A00]/15 text-[#FF9A3D]">
                <svg class="h-7 w-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z" /></svg>
              </span>
              <p class="font-display text-lg font-extrabold text-white">{{ t('presentationVideo.unavailableTitle') }}</p>
              <p class="max-w-sm text-sm text-white/65">{{ t('presentationVideo.unavailableText') }}</p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.pv-card {
  animation: pv-in 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.1);
}
@keyframes pv-in {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .pv-card {
    animation: none;
  }
}
</style>
