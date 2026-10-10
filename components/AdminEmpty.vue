<script setup lang="ts">
/** Bloc « rien à afficher » des pages d'administration (icône + message). */
withDefaults(defineProps<{ icon?: string; text: string }>(), { icon: 'inbox' })
</script>

<template>
  <div class="acc-empty">
    <span class="flex h-14 w-14 items-center justify-center bg-tikeo-surface-alt text-tikeo-gray-text"><AppIcon :name="icon" class="h-7 w-7" /></span>
    <p class="text-sm font-semibold text-tikeo-gray-text">{{ text }}</p>
    <slot />
  </div>
</template>
