<script setup lang="ts">
/**
 * Fenêtre de confirmation avant une suppression (billet, commande,
 * notification). Fermeture : bouton Annuler, clic à l'extérieur ou touche Échap.
 */
defineProps<{
  open: boolean
  title: string
  message?: string
  warning?: string
  confirmLabel?: string
  loading?: boolean
  errorMessage?: string
}>()
const emit = defineEmits<{ (e: 'confirm'): void; (e: 'cancel'): void }>()
const { t } = useI18n()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="alertdialog"
      aria-modal="true"
      @click.self="emit('cancel')"
      @keydown.esc="emit('cancel')"
    >
      <div class="w-full max-w-sm bg-tikeo-surface p-5 shadow-2xl">
        <h2 class="text-base font-bold text-tikeo-black">{{ title }}</h2>
        <p v-if="message" class="mt-2 text-sm text-tikeo-gray-text">{{ message }}</p>
        <p v-if="warning" class="mt-3 border border-tikeo-orange/40 bg-tikeo-orange/5 px-3 py-2 text-xs font-medium text-tikeo-orange">{{ warning }}</p>
        <p v-if="errorMessage" class="mt-3 text-xs text-tikeo-error">{{ errorMessage }}</p>
        <div class="mt-5 flex gap-2">
          <button type="button" class="btn-secondary flex-1 text-xs" :disabled="loading" @click="emit('cancel')">{{ t('buyerDelete.cancel') }}</button>
          <button
            type="button"
            class="flex-1 bg-tikeo-error px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="loading"
            @click="emit('confirm')"
          >
            {{ loading ? t('buyerDelete.deleting') : confirmLabel || t('buyerDelete.delete') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
