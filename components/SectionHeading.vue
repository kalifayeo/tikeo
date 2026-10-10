<script setup lang="ts">
/**
 * Titre de section « maison » : étiquette en capitales avec filet orange,
 * titre en Bricolage, texte d'introduction optionnel. Même vocabulaire que
 * l'accueil et PageHero — réutilisé par les pages d'information
 * (FAQ, tarifs, qui sommes-nous, contact).
 */
defineProps<{
  eyebrow?: string
  title: string
  text?: string
  center?: boolean
}>()
</script>

<template>
  <div :class="center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'">
    <p
      v-if="eyebrow"
      class="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-tikeo-gray-text"
      :class="center ? 'justify-center' : ''"
    >
      <span class="h-[3px] w-6 bg-[#FF7A00]" aria-hidden="true" />
      {{ eyebrow }}
    </p>
    <h2 class="font-display text-2xl font-extrabold leading-[1.1] tracking-tight text-tikeo-black md:text-4xl">{{ title }}</h2>
    <p v-if="text" class="mt-3 text-sm leading-relaxed text-tikeo-gray-text md:text-base">{{ text }}</p>
  </div>
</template>
