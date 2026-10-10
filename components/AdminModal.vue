<script setup lang="ts">
/**
 * Pop-up de détail de l'administration (messages, avis) : fenêtre centrée sur
 * ordinateur, feuille plein-largeur sur mobile. Fermeture : croix, clic en
 * dehors, Échap. Navigation précédent / suivant : boutons ou flèches ← →
 * (hors saisie de texte). Le défilement de la page derrière est bloqué.
 * Slots : `header`, `default` (corps), `footer`.
 */
const props = defineProps<{ open: boolean; position?: string; hasPrev?: boolean; hasNext?: boolean }>()
const emit = defineEmits<{ close: []; prev: []; next: [] }>()
const { t } = useI18n()

function onKey(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'Escape') return emit('close')
  const el = e.target as HTMLElement | null
  const typing = el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable)
  if (typing) return
  if (e.key === 'ArrowLeft' && props.hasPrev) emit('prev')
  if (e.key === 'ArrowRight' && props.hasNext) emit('next')
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.documentElement.style.overflow = ''
})
watch(
  () => props.open,
  (v) => {
    if (import.meta.client) document.documentElement.style.overflow = v ? 'hidden' : ''
  }
)
</script>

<template>
  <Teleport to="body">
    <Transition name="amodal">
      <div v-if="open" class="fixed inset-0 z-[100] flex items-end justify-center bg-tikeo-ink/70 backdrop-blur-[2px] sm:items-center sm:p-6" role="dialog" aria-modal="true" @click.self="emit('close')">
        <div class="amodal__panel flex max-h-[94vh] w-full flex-col bg-tikeo-surface shadow-2xl sm:max-h-[88vh] sm:max-w-2xl">
          <div class="h-1 shrink-0 bg-tikeo-brand" aria-hidden="true" />
          <header class="flex shrink-0 items-start gap-3 border-b border-tikeo-border px-4 py-4 md:px-6">
            <div class="min-w-0 flex-1"><slot name="header" /></div>
            <div class="flex shrink-0 items-center gap-1">
              <button v-if="hasPrev !== undefined" type="button" class="flex h-9 w-9 items-center justify-center border border-tikeo-border text-tikeo-black transition-colors hover:border-tikeo-ink disabled:opacity-30 dark:hover:border-[#FF7A00]" :disabled="!hasPrev" :aria-label="t('adminModal.prev')" @click="emit('prev')">
                <AppIcon name="chevron-left" class="h-4 w-4" :stroke="2.4" />
              </button>
              <button v-if="hasNext !== undefined" type="button" class="flex h-9 w-9 items-center justify-center border border-tikeo-border text-tikeo-black transition-colors hover:border-tikeo-ink disabled:opacity-30 dark:hover:border-[#FF7A00]" :disabled="!hasNext" :aria-label="t('adminModal.next')" @click="emit('next')">
                <AppIcon name="chevron-right" class="h-4 w-4" :stroke="2.4" />
              </button>
              <button type="button" class="ml-1 flex h-9 w-9 items-center justify-center bg-tikeo-ink text-white transition-colors hover:bg-[#FF7A00] hover:text-tikeo-ink dark:bg-[#FF7A00] dark:text-tikeo-ink dark:hover:bg-white" :aria-label="t('adminModal.close')" @click="emit('close')">
                <AppIcon name="close" class="h-4 w-4" :stroke="2.6" />
              </button>
            </div>
          </header>
          <div class="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6"><slot /></div>
          <footer v-if="$slots.footer" class="shrink-0 border-t border-tikeo-border bg-tikeo-surface-alt px-4 py-3 md:px-6"><slot name="footer" /></footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.amodal-enter-active,
.amodal-leave-active {
  transition: opacity 0.22s ease;
}
.amodal-enter-active .amodal__panel,
.amodal-leave-active .amodal__panel {
  transition: transform 0.3s var(--ease-tikeo), opacity 0.22s ease;
}
.amodal-enter-from,
.amodal-leave-to {
  opacity: 0;
}
.amodal-enter-from .amodal__panel,
.amodal-leave-to .amodal__panel {
  transform: translateY(24px) scale(0.98);
  opacity: 0;
}
</style>
