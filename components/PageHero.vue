<script setup lang="ts">
/**
 * En-tête compact « encre » des pages de tunnel (paiement, confirmation) :
 * même univers que l'accueil et la page événement (filet orange→bleu, trame
 * de perforation, étiquette en capitales, titre en Bricolage).
 * Slots : `default` (sous le titre), `aside` (à droite du titre).
 */
defineProps<{
  eyebrow?: string
  title: string
  subtitle?: string
  back?: boolean
  /** Barre d'étapes du tunnel (Billets → Paiement → Confirmation). */
  steps?: Array<{ label: string; state: 'done' | 'current' | 'todo' }>
}>()
const router = useRouter()
</script>

<template>
  <section class="relative isolate overflow-hidden bg-tikeo-ink text-white">
    <div class="absolute inset-x-0 top-0 h-1 bg-tikeo-brand" aria-hidden="true" />
    <div
      class="pointer-events-none absolute inset-y-0 left-0 hidden w-3 lg:block"
      style="background-image: radial-gradient(circle, rgb(243 245 249) 3px, transparent 3.5px); background-size: 12px 18px; background-position: -6px 0"
      aria-hidden="true"
    />
    <div class="pointer-events-none absolute -right-24 -top-24 -z-10 h-64 w-64 rounded-full bg-[#FF7A00]/15 blur-3xl" aria-hidden="true" />

    <div class="mx-auto max-w-tikeo-container px-4 py-6 md:px-6 md:py-9">
      <div class="flex items-center justify-between gap-4">
        <div class="flex min-w-0 items-center gap-3 md:gap-4">
          <button
            v-if="back"
            type="button"
            class="flex h-10 w-10 shrink-0 items-center justify-center border border-white/25 text-white transition-colors hover:border-[#FF7A00] hover:bg-[#FF7A00] hover:text-tikeo-ink"
            aria-label="Retour"
            @click="router.back()"
          >
            <AppIcon name="chevron-left" class="h-5 w-5" :stroke="2.4" />
          </button>
          <div class="min-w-0">
            <p v-if="eyebrow" class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/60">
              <span class="h-[3px] w-6 bg-[#FF7A00]" aria-hidden="true" />
              {{ eyebrow }}
            </p>
            <h1 class="font-display text-[1.6rem] font-extrabold leading-[1.1] tracking-tight sm:text-3xl md:text-4xl" :class="eyebrow ? 'mt-1.5' : ''">{{ title }}</h1>
            <p v-if="subtitle" class="mt-1.5 max-w-xl text-sm text-white/75">{{ subtitle }}</p>
          </div>
        </div>
        <div v-if="$slots.aside" class="shrink-0">
          <slot name="aside" />
        </div>
      </div>
      <ol v-if="steps?.length" class="mt-5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider md:mt-6 md:gap-3" aria-label="Étapes de la commande">
        <template v-for="(s, i) in steps" :key="s.label">
          <li class="flex items-center gap-2" :class="s.state === 'todo' ? 'text-white/45' : 'text-white'">
            <span
              class="flex h-6 w-6 shrink-0 items-center justify-center text-[11px]"
              :class="s.state === 'done' ? 'bg-[#FF7A00] text-tikeo-ink' : s.state === 'current' ? 'bg-white text-tikeo-ink' : 'border border-white/30'"
            >
              <AppIcon v-if="s.state === 'done'" name="check" class="h-3.5 w-3.5" :stroke="3" />
              <template v-else>{{ i + 1 }}</template>
            </span>
            <span class="hidden sm:inline">{{ s.label }}</span>
            <span v-if="s.state === 'current'" class="sm:hidden">{{ s.label }}</span>
          </li>
          <li v-if="i < steps.length - 1" class="h-px w-5 bg-white/25 md:w-10" aria-hidden="true" />
        </template>
      </ol>
      <div v-if="$slots.default" class="mt-5 md:mt-6">
        <slot />
      </div>
    </div>
  </section>
</template>
