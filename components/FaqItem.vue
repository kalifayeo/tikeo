<script setup lang="ts">
/**
 * Ligne d'accordéon (question / réponse) : ouverture animée sans JS de
 * mesure (grille 0fr → 1fr), bouton +/− carré. Utilisée par la FAQ et par
 * la page tarifs organisateurs.
 */
defineProps<{
  question: string
  answer: string
  open: boolean
}>()
defineEmits<{ (e: 'toggle'): void }>()
</script>

<template>
  <div>
    <button
      type="button"
      class="group flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-tikeo-surface-alt md:px-6 md:py-5"
      :aria-expanded="open"
      @click="$emit('toggle')"
    >
      <span class="font-display text-[15px] font-bold leading-snug text-tikeo-black md:text-lg">{{ question }}</span>
      <span
        class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center border transition-colors duration-200"
        :class="open ? 'border-[#FF7A00] bg-[#FF7A00] text-tikeo-ink' : 'border-tikeo-border text-tikeo-black group-hover:border-tikeo-ink dark:group-hover:border-[#FF7A00]'"
      >
        <AppIcon :name="open ? 'minus' : 'plus'" class="h-4 w-4" :stroke="2.6" />
      </span>
    </button>
    <div
      class="grid transition-[grid-template-rows] duration-300 ease-out"
      :class="open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
    >
      <div class="overflow-hidden">
        <p class="px-5 pb-5 text-sm leading-relaxed text-tikeo-gray-text md:px-6 md:pb-6 md:text-[15px]" :class="open ? '' : 'invisible'">{{ answer }}</p>
      </div>
    </div>
  </div>
</template>
