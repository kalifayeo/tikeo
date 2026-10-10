<script setup lang="ts">
/**
 * Champ de formulaire avec libellé visible (au-dessus), marque « * » pour les
 * champs obligatoires ou « (optionnel) », et aide facultative. Le slot reçoit
 * `id` : à poser sur l'input pour que le libellé soit cliquable et lu par les
 * lecteurs d'écran.
 */
defineProps<{ label: string; required?: boolean; optional?: boolean; hint?: string }>()
const { t } = useI18n()
const id = useId()
</script>

<template>
  <div class="min-w-0">
    <label :for="id" class="mb-1.5 flex flex-wrap items-center gap-x-1.5 text-[13px] font-bold text-tikeo-black">
      {{ label }}
      <span v-if="required" class="text-tikeo-error" aria-hidden="true">*</span>
      <span v-else-if="optional" class="text-[11px] font-medium text-tikeo-gray-text">({{ t('eventForm.optional') }})</span>
    </label>
    <slot :id="id" />
    <p v-if="hint" class="mt-1 text-xs text-tikeo-gray-text">{{ hint }}</p>
  </div>
</template>
