<script setup lang="ts">
/** Bloc titré d'un formulaire en plusieurs parties (étapes de création d'événement). */
defineProps<{ title: string; icon?: string }>()
</script>

<template>
  <section class="flex flex-col gap-4">
    <h2 class="flex items-center gap-2 border-b border-tikeo-border pb-2 text-[13px] font-extrabold uppercase tracking-wider text-tikeo-black">
      <span class="h-3 w-1 bg-[#FF7A00]" aria-hidden="true" />
      <AppIcon v-if="icon" :name="icon" class="h-4 w-4 text-tikeo-orange" />
      {{ title }}
    </h2>
    <slot />
  </section>
</template>
