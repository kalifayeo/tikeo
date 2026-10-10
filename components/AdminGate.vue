<script setup lang="ts">
/**
 * Cadre commun des pages « porte » de l'administration (activation du 2FA,
 * vérification à chaque connexion) : hors de la mise en page admin, rien
 * d'autre de l'administration n'est visible tant que le 2FA n'est pas passé.
 * Fond encre à trame de perforation, carte « billet » avec filet de marque.
 */
defineProps<{ title: string; subtitle?: string; icon?: string; wide?: boolean }>()
</script>

<template>
  <div class="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-tikeo-ink px-4 py-10">
    <div class="pointer-events-none absolute -right-32 -top-32 -z-10 h-96 w-96 rounded-full bg-[#FF7A00]/15 blur-3xl" aria-hidden="true" />
    <div class="pointer-events-none absolute -bottom-40 -left-24 -z-10 h-96 w-96 rounded-full bg-[#0057B8]/25 blur-3xl" aria-hidden="true" />
    <div
      class="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
      style="background-image: radial-gradient(circle, #fff 1.2px, transparent 1.6px); background-size: 22px 22px"
      aria-hidden="true"
    />

    <div class="org-pop w-full" :class="wide ? 'max-w-lg' : 'max-w-md'">
      <div class="relative overflow-hidden bg-tikeo-surface shadow-2xl">
        <div class="org-line absolute inset-x-0 top-0 h-1 bg-tikeo-brand" aria-hidden="true" />

        <div class="flex flex-col items-center gap-3 border-b border-dashed border-tikeo-border px-6 pb-6 pt-8 text-center">
          <img src="/logo-tikeo.png" alt="Tikeo" class="h-9 w-auto" />
          <span class="flex h-14 w-14 items-center justify-center bg-tikeo-ink text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">
            <AppIcon :name="icon || 'shield-check'" class="h-7 w-7" :stroke="1.8" />
          </span>
          <div>
            <h1 class="font-display text-2xl font-extrabold tracking-tight text-tikeo-black">{{ title }}</h1>
            <p v-if="subtitle" class="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-tikeo-gray-text">{{ subtitle }}</p>
          </div>
        </div>

        <div class="p-6 md:p-7">
          <slot />
        </div>
      </div>

      <div class="mt-5 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-white/70">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>
