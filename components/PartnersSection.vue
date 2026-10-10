<script setup lang="ts">
import { PARTNER_CATEGORY_ICONS, safeExternalUrl } from '~/composables/usePartners'
/**
 * Section « Nos partenaires » de l'accueil. Les partenaires viennent de
 * /admin/partenaires. Mis en avant = grandes cartes ; les autres défilent
 * en bandeau de logos (pause au survol, immobile si l'utilisateur préfère
 * réduire les animations). La section disparaît tant qu'aucun partenaire
 * n'est actif : jamais de bloc vide sur l'accueil.
 */
const { t } = useI18n()
const { partners, featured, regular } = usePartners()

const hasPartners = computed(() => partners.value.length > 0)
// Le bandeau défile sur lui-même : on duplique la liste pour une boucle sans saut.
const marqueeItems = computed(() => (regular.value.length ? [...regular.value, ...regular.value] : []))
// Peu de logos : un bandeau qui défile serait vide par moments, on les range en grille.
const useMarquee = computed(() => regular.value.length >= 6)
</script>

<template>
  <section v-if="hasPartners" class="relative mt-14 overflow-hidden bg-tikeo-ink text-white md:mt-20" aria-labelledby="partners-title">
    <div class="absolute inset-x-0 top-0 h-1 bg-tikeo-brand" aria-hidden="true" />
    <div class="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#FF7A00]/20 blur-3xl" aria-hidden="true" />
    <div class="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-tikeo-blue/30 blur-3xl" aria-hidden="true" />
    <div
      class="pointer-events-none absolute inset-y-0 left-0 hidden w-3 lg:block"
      style="background-image: radial-gradient(circle, rgb(243 245 249) 3px, transparent 3.5px); background-size: 12px 18px; background-position: -6px 0"
      aria-hidden="true"
    />

    <div class="relative mx-auto max-w-tikeo-container px-4 py-14 md:px-6 md:py-20">
      <div class="flex flex-wrap items-end justify-between gap-6">
        <div class="max-w-2xl">
          <p class="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/60">
            <span class="h-[3px] w-6 bg-[#FF7A00]" aria-hidden="true" />{{ t('partners.eyebrow') }}
          </p>
          <h2 id="partners-title" class="font-display text-3xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">{{ t('partners.title') }}</h2>
          <p class="mt-3 text-sm leading-relaxed text-white/70 md:text-base">{{ t('partners.subtitle') }}</p>
        </div>
        <NuxtLink to="/partenaires" class="group inline-flex h-11 items-center gap-2 border border-white/25 px-5 text-sm font-bold text-white transition-colors hover:border-[#FF7A00] hover:bg-[#FF7A00] hover:text-tikeo-ink">
          {{ t('partners.seeAll') }}
          <AppIcon name="arrow-right" class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" :stroke="2.2" />
        </NuxtLink>
      </div>

      <!-- Partenaires mis en avant -->
      <ul v-if="featured.length" class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="p in featured" :key="p.id" class="partner-card group relative flex flex-col border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
          <span class="absolute right-0 top-0 flex items-center gap-1 bg-[#FF7A00] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-tikeo-ink">
            <AppIcon name="star" class="h-3 w-3" :stroke="2.4" />{{ t('partners.featuredBadge') }}
          </span>
          <div class="flex items-center gap-4">
            <span class="block h-20 w-20 shrink-0 border border-white/10 shadow-lg"><PartnerLogo :partner="p" /></span>
            <div class="min-w-0">
              <h3 class="truncate font-display text-lg font-extrabold leading-tight">{{ p.name }}</h3>
              <p class="mt-1 flex items-center gap-1.5 text-xs font-semibold text-white/60">
                <AppIcon :name="PARTNER_CATEGORY_ICONS[p.category]" class="h-3.5 w-3.5 text-[#FF7A00]" />{{ t(`partners.categories.${p.category}`) }}
              </p>
            </div>
          </div>
          <p v-if="p.description" class="mt-4 line-clamp-3 text-sm leading-relaxed text-white/70">{{ p.description }}</p>
          <a
            v-if="safeExternalUrl(p.website_url)"
            :href="safeExternalUrl(p.website_url)"
            target="_blank"
            rel="noopener noreferrer nofollow"
            class="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-bold text-white underline decoration-[#FF7A00] decoration-2 underline-offset-[6px] transition-colors hover:text-[#FF9A3D]"
          >
            {{ t('partners.visit') }}<AppIcon name="arrow-up-right" class="h-4 w-4" :stroke="2.2" />
          </a>
        </li>
      </ul>

      <!-- Autres partenaires : bandeau défilant, ou grille s'ils sont peu nombreux -->
      <div v-if="regular.length" class="mt-10">
        <div v-if="useMarquee" class="partner-marquee group/marquee relative -mx-4 overflow-hidden md:-mx-6">
          <div class="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-tikeo-ink to-transparent md:w-32" aria-hidden="true" />
          <div class="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-tikeo-ink to-transparent md:w-32" aria-hidden="true" />
          <ul class="partner-track flex w-max">
            <li v-for="(p, i) in marqueeItems" :key="`${p.id}-${i}`" class="mr-4" :aria-hidden="i >= regular.length ? 'true' : undefined">
              <component
                :is="safeExternalUrl(p.website_url) ? 'a' : 'div'"
                v-bind="safeExternalUrl(p.website_url) ? { href: safeExternalUrl(p.website_url), target: '_blank', rel: 'noopener noreferrer nofollow', tabindex: i >= regular.length ? -1 : undefined } : {}"
                :title="p.name"
                class="partner-tile block h-24 w-40 border border-white/10 md:h-28 md:w-48"
              >
                <PartnerLogo :partner="p" />
              </component>
            </li>
          </ul>
        </div>
        <ul v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <li v-for="p in regular" :key="p.id">
            <component
              :is="safeExternalUrl(p.website_url) ? 'a' : 'div'"
              v-bind="safeExternalUrl(p.website_url) ? { href: safeExternalUrl(p.website_url), target: '_blank', rel: 'noopener noreferrer nofollow' } : {}"
              :title="p.name"
              class="partner-tile block h-24 border border-white/10 md:h-28"
            >
              <PartnerLogo :partner="p" />
            </component>
          </li>
        </ul>
      </div>

      <!-- Appel à devenir partenaire -->
      <div class="mt-12 flex flex-col items-start justify-between gap-4 border border-dashed border-white/20 p-5 sm:flex-row sm:items-center md:p-6">
        <div class="flex items-center gap-4">
          <span class="flex h-12 w-12 shrink-0 items-center justify-center bg-[#FF7A00] text-tikeo-ink"><AppIcon name="handshake" class="h-6 w-6" :stroke="2" /></span>
          <div>
            <p class="font-display text-lg font-extrabold">{{ t('partners.ctaTitle') }}</p>
            <p class="text-sm text-white/70">{{ t('partners.ctaText') }}</p>
          </div>
        </div>
        <NuxtLink to="/contact?sujet=partenaire" class="btn-brand shrink-0">{{ t('partners.ctaButton') }}</NuxtLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.partner-card {
  transition: transform 0.3s var(--ease-tikeo), border-color 0.2s ease, background-color 0.2s ease;
}
.partner-card:hover {
  transform: translateY(-4px);
  border-color: rgb(255 122 0 / 0.6);
  background-color: rgb(255 255 255 / 0.07);
}
.partner-tile {
  transition: transform 0.3s var(--ease-tikeo), border-color 0.2s ease, box-shadow 0.3s ease;
}
a.partner-tile:hover {
  transform: translateY(-3px);
  border-color: #ff7a00;
  box-shadow: 0 14px 26px -12px rgb(0 0 0 / 0.55);
}
.partner-track {
  animation: partner-scroll 40s linear infinite;
}
.partner-marquee:hover .partner-track,
.partner-marquee:focus-within .partner-track {
  animation-play-state: paused;
}
@keyframes partner-scroll {
  to {
    transform: translateX(-50%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .partner-track {
    animation: none;
    flex-wrap: wrap;
    width: auto;
  }
  .partner-card,
  .partner-tile {
    transition: none;
  }
}
</style>
