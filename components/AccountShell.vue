<script setup lang="ts">
/**
 * Gabarit commun de toutes les pages « Mon espace » (même univers que
 * l'accueil et la page événement) :
 *   1. un hero encre (trame de points « perforation », filet orange → bleu,
 *      étiquette « Mon espace », titre en Bricolage, sous-titre) ;
 *   2. la barre de navigation en pastilles (AccountNav) ;
 *   3. le contenu, centré dans une largeur adaptée à la page.
 *
 * Slots : `default` (contenu), `stats` (tuiles sous le titre, dans le hero),
 * `actions` (boutons à droite du titre, dans le hero).
 * `width` : 'full' (tableau de bord, favoris), 'wide' (listes, profil),
 * 'narrow' (réglages) — le contenu est toujours centré.
 * `identity` : affiche l'avatar de l'utilisateur à gauche du titre.
 */
const props = withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    width?: 'full' | 'wide' | 'narrow'
    identity?: boolean
  }>(),
  { width: 'wide', identity: false }
)

const { t } = useI18n()
const { profile } = useAuth()

const initials = computed(() => {
  const parts = (profile.value?.full_name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
})

const bodyWidth = computed(() => ({ full: '', wide: 'max-w-5xl', narrow: 'max-w-3xl' })[props.width])
</script>

<template>
  <div class="pb-10 md:pb-16">
    <!-- ============ Hero ============ -->
    <section class="relative isolate overflow-hidden bg-tikeo-ink text-white">
      <!-- Filet de marque -->
      <div class="absolute inset-x-0 top-0 h-1 bg-tikeo-brand" aria-hidden="true" />
      <!-- Trame de points : rappelle la perforation d'un billet -->
      <div
        class="pointer-events-none absolute inset-y-0 left-0 hidden w-3 lg:block"
        style="background-image: radial-gradient(circle, rgb(243 245 249) 3px, transparent 3.5px); background-size: 12px 18px; background-position: -6px 0"
        aria-hidden="true"
      />
      <!-- Halo orange discret -->
      <div class="pointer-events-none absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-[#FF7A00]/15 blur-3xl" aria-hidden="true" />

      <div class="mx-auto max-w-tikeo-container px-4 pb-7 pt-7 md:px-6 md:pb-10 md:pt-10">
        <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div class="flex min-w-0 items-center gap-4 md:gap-5">
            <UserAvatar
              v-if="identity"
              :avatar-url="profile?.avatar_url"
              :initials="initials"
              square
              size-class="h-16 w-16 md:h-20 md:w-20"
              text-class="text-xl md:text-2xl"
            />
            <div class="min-w-0">
              <p class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/60">
                <span class="h-[3px] w-6 bg-[#FF7A00]" aria-hidden="true" />
                {{ t('account.eyebrow') }}
              </p>
              <h1 class="mt-2 font-display text-[1.9rem] font-extrabold leading-[1.05] tracking-tight sm:text-4xl md:text-5xl">
                {{ title }}
              </h1>
              <p v-if="subtitle" class="mt-2 max-w-xl text-sm leading-relaxed text-white/75 md:text-base">{{ subtitle }}</p>
            </div>
          </div>

          <div v-if="$slots.actions" class="flex flex-wrap items-center gap-3 max-sm:w-full">
            <slot name="actions" />
          </div>
        </div>

        <div v-if="$slots.stats" class="mt-6 md:mt-8">
          <slot name="stats" />
        </div>
      </div>
    </section>

    <!-- ============ Navigation ============ -->
    <AccountNav />

    <!-- ============ Contenu ============ -->
    <div class="mx-auto max-w-tikeo-container px-4 pt-8 md:px-6 md:pt-12">
      <div class="mx-auto w-full" :class="bodyWidth">
        <slot />
      </div>
    </div>
  </div>
</template>
