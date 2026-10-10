<script setup lang="ts">
// Affiche les toasts de useToast() en bas de l'écran (au-dessus de la barre
// de navigation mobile). Un clic sur un toast le ferme.
const { toasts, dismiss } = useToast()
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-20 z-[9500] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite" role="status">
    <TransitionGroup name="toast">
      <button
        v-for="item in toasts"
        :key="item.id"
        type="button"
        class="pointer-events-auto flex max-w-sm items-center gap-3 border bg-tikeo-ink px-4 py-3 text-left text-sm font-semibold text-white shadow-card-hover"
        :class="item.type === 'error' ? 'border-tikeo-error' : item.type === 'info' ? 'border-white/20' : 'border-[#FF7A00]'"
        @click="dismiss(item.id)"
      >
        <span
          class="flex h-6 w-6 shrink-0 items-center justify-center text-tikeo-ink"
          :class="item.type === 'error' ? 'bg-tikeo-error text-white' : item.type === 'info' ? 'bg-white' : 'bg-[#FF7A00]'"
        >
          <AppIcon :name="item.type === 'error' ? 'alert' : item.type === 'info' ? 'info' : 'check'" class="h-4 w-4" :stroke="2.8" />
        </span>
        <span class="min-w-0">{{ item.text }}</span>
      </button>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.28s var(--ease-tikeo), transform 0.28s var(--ease-tikeo);
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(14px) scale(0.96);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
.toast-leave-active {
  position: absolute;
}
</style>
