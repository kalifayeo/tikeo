<script setup lang="ts">
/**
 * Bouton carré à icône avec infobulle (Modifier, Dupliquer, Statistiques,
 * Voir, Copier le lien, Supprimer…). Devient un lien si `to` est fourni.
 * `label` sert à la fois d'infobulle et de nom accessible.
 */
const props = defineProps<{
  icon: string
  label: string
  to?: string
  danger?: boolean
  success?: boolean
  loading?: boolean
  disabled?: boolean
}>()
const emit = defineEmits<{ (e: 'click', ev: MouseEvent): void }>()
const cls = computed(() => ['org-icon-btn org-tip', props.danger ? 'is-danger' : '', props.success ? 'is-success' : ''])
</script>

<template>
  <NuxtLink v-if="to" :to="to" :class="cls" :data-tip="label" :aria-label="label">
    <AppIcon :name="icon" class="h-[18px] w-[18px]" />
  </NuxtLink>
  <button v-else type="button" :class="cls" :data-tip="label" :aria-label="label" :disabled="disabled || loading" @click="emit('click', $event)">
    <AppIcon v-if="!loading" :name="success ? 'check' : icon" class="h-[18px] w-[18px]" />
    <svg v-else class="h-[18px] w-[18px] animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" opacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
    </svg>
  </button>
</template>
