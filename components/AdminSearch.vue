<script setup lang="ts">
/** Champ de recherche à icône pour les listes d'administration. */
defineProps<{ modelValue: string; placeholder?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()
</script>

<template>
  <div class="admin-search">
    <AppIcon name="search" />
    <input type="search" :value="modelValue" :placeholder="placeholder" :aria-label="placeholder" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)" />
  </div>
</template>
