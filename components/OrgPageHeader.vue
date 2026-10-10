<script setup lang="ts">
/**
 * En-tête commun des pages de l'espace organisateur : même univers que le hero
 * de « Mon espace » (fond encre, filet orange → bleu, trame de perforation,
 * halo orange, titre en Bricolage) mais plus compact.
 *
 * Slots : `actions` (boutons à droite du titre), `stats` (tuiles sous le titre).
 * Props : `back` = lien de retour affiché au-dessus du titre.
 */
defineProps<{
  title: string
  subtitle?: string
  eyebrow?: string
  icon?: string
  back?: { to: string; label: string }
}>()
</script>

<template>
  <section class="relative isolate overflow-hidden bg-tikeo-ink text-white">
    <div class="org-line absolute inset-x-0 top-0 h-1 bg-tikeo-brand" aria-hidden="true" />
    <div
      class="pointer-events-none absolute inset-y-0 left-0 hidden w-3 lg:block"
      style="background-image: radial-gradient(circle, rgb(243 245 249) 3px, transparent 3.5px); background-size: 12px 18px; background-position: -6px 0"
      aria-hidden="true"
    />
    <div class="pointer-events-none absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-[#FF7A00]/15 blur-3xl" aria-hidden="true" />
    <div class="pointer-events-none absolute -bottom-32 left-1/3 -z-10 h-64 w-64 rounded-full bg-[#0057B8]/20 blur-3xl" aria-hidden="true" />

    <div class="mx-auto max-w-6xl px-4 pb-7 pt-7 md:px-8 md:pb-9 md:pt-9">
      <NuxtLink
        v-if="back"
        :to="back.to"
        class="org-rise mb-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white/70 transition-colors hover:text-[#FF7A00]"
      >
        <AppIcon name="arrow-left" class="h-4 w-4" />
        {{ back.label }}
      </NuxtLink>

      <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div class="org-rise min-w-0" style="--i: 1">
          <p v-if="eyebrow" class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/60">
            <span class="h-[3px] w-6 bg-[#FF7A00]" aria-hidden="true" />
            {{ eyebrow }}
          </p>
          <h1 class="mt-2 flex items-center gap-3 font-display text-[1.7rem] font-extrabold leading-[1.05] tracking-tight sm:text-4xl">
            <span v-if="icon" class="hidden h-11 w-11 shrink-0 items-center justify-center bg-[#FF7A00] text-tikeo-ink sm:flex">
              <AppIcon :name="icon" class="h-6 w-6" :stroke="2" />
            </span>
            <span class="min-w-0 break-words">{{ title }}</span>
          </h1>
          <p v-if="subtitle" class="mt-2 max-w-xl text-sm leading-relaxed text-white/75 md:text-base">{{ subtitle }}</p>
        </div>
        <div v-if="$slots.actions" class="org-rise flex flex-wrap items-center gap-3 max-sm:w-full" style="--i: 2">
          <slot name="actions" />
        </div>
      </div>

      <div v-if="$slots.stats" class="mt-6 md:mt-8">
        <slot name="stats" />
      </div>
    </div>
  </section>
</template>
