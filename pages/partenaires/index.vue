<script setup lang="ts">
import type { PartnerCategory } from '~/types/database'
import { PARTNER_CATEGORIES, PARTNER_CATEGORY_ICONS, safeExternalUrl } from '~/composables/usePartners'

const { t } = useI18n()
const { partners, featured, loading, loaded } = usePartners()

useSeoMeta({
  title: () => `${t('partners.pageTitle')} | Tikeo`,
  description: () => t('partners.pageIntro'),
  ogTitle: () => `${t('partners.pageTitle')} | Tikeo`,
  ogDescription: () => t('partners.pageIntro'),
})

// Filtre par catégorie : seules les catégories réellement utilisées sont proposées.
const activeCategory = ref<PartnerCategory | 'all'>('all')
const categoriesInUse = computed(() => PARTNER_CATEGORIES.filter((c) => partners.value.some((p) => p.category === c)))
const visible = computed(() => (activeCategory.value === 'all' ? partners.value : partners.value.filter((p) => p.category === activeCategory.value)))
const visibleFeatured = computed(() => visible.value.filter((p) => p.is_featured))
const visibleRegular = computed(() => visible.value.filter((p) => !p.is_featured))
const showSkeleton = computed(() => loading.value || !loaded.value)

const benefits = computed(() => [
  { icon: 'users', title: t('partners.benefit1Title'), text: t('partners.benefit1Text') },
  { icon: 'megaphone', title: t('partners.benefit2Title'), text: t('partners.benefit2Text') },
  { icon: 'sparkles', title: t('partners.benefit3Title'), text: t('partners.benefit3Text') },
])
</script>

<template>
  <div>
    <!-- Bandeau d'en-tête -->
    <section class="relative isolate overflow-hidden bg-tikeo-ink text-white">
      <div class="absolute inset-x-0 top-0 h-1 bg-tikeo-brand" aria-hidden="true" />
      <div class="pointer-events-none absolute -right-24 -top-24 -z-10 h-80 w-80 rounded-full bg-[#FF7A00]/20 blur-3xl" aria-hidden="true" />
      <div class="pointer-events-none absolute -bottom-32 left-1/3 -z-10 h-72 w-72 rounded-full bg-tikeo-blue/30 blur-3xl" aria-hidden="true" />
      <div
        class="pointer-events-none absolute inset-y-0 left-0 hidden w-3 lg:block"
        style="background-image: radial-gradient(circle, rgb(243 245 249) 3px, transparent 3.5px); background-size: 12px 18px; background-position: -6px 0"
        aria-hidden="true"
      />
      <div class="mx-auto max-w-tikeo-container px-4 py-14 md:px-6 md:py-24">
        <p class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/60">
          <span class="h-[3px] w-6 bg-[#FF7A00]" aria-hidden="true" />{{ t('partners.eyebrow') }}
        </p>
        <h1 class="mt-3 max-w-3xl font-display text-[2.1rem] font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">{{ t('partners.pageTitle') }}</h1>
        <p class="mt-5 max-w-xl text-sm leading-relaxed text-white/75 md:text-lg">{{ t('partners.pageIntro') }}</p>
        <div class="mt-7 flex flex-wrap gap-3">
          <NuxtLink to="/contact?sujet=partenaire" class="btn-brand"><AppIcon name="handshake" class="h-5 w-5" :stroke="2" />{{ t('partners.ctaButton') }}</NuxtLink>
          <a href="#partners-list" class="inline-flex h-12 items-center justify-center gap-2 border border-white/25 px-6 text-sm font-bold text-white transition-colors hover:border-white hover:bg-white/10">{{ t('partners.discover') }}</a>
        </div>
        <p v-if="partners.length" class="mt-10 flex items-baseline gap-3">
          <span class="font-display text-5xl font-extrabold text-[#FF7A00]">{{ partners.length }}</span>
          <span class="text-sm font-semibold text-white/70">{{ t('partners.countLabel', partners.length) }}</span>
        </p>
      </div>
    </section>

    <section id="partners-list" class="mx-auto max-w-tikeo-container scroll-mt-24 px-4 py-12 md:px-6 md:py-16">
      <!-- Filtres par catégorie -->
      <div v-if="categoriesInUse.length > 1" class="no-scrollbar -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0" role="tablist" :aria-label="t('partners.filterLabel')">
        <button
          type="button"
          role="tab"
          :aria-selected="activeCategory === 'all'"
          class="flex h-10 shrink-0 items-center gap-2 border px-4 text-sm font-bold transition-colors"
          :class="activeCategory === 'all' ? 'border-tikeo-ink bg-tikeo-ink text-white dark:border-[#FF7A00] dark:bg-[#FF7A00] dark:text-tikeo-ink' : 'border-tikeo-border bg-tikeo-surface text-tikeo-black hover:border-tikeo-ink dark:hover:border-[#FF7A00]'"
          @click="activeCategory = 'all'"
        >
          {{ t('partners.all') }}
        </button>
        <button
          v-for="c in categoriesInUse"
          :key="c"
          type="button"
          role="tab"
          :aria-selected="activeCategory === c"
          class="flex h-10 shrink-0 items-center gap-2 border px-4 text-sm font-bold transition-colors"
          :class="activeCategory === c ? 'border-tikeo-ink bg-tikeo-ink text-white dark:border-[#FF7A00] dark:bg-[#FF7A00] dark:text-tikeo-ink' : 'border-tikeo-border bg-tikeo-surface text-tikeo-black hover:border-tikeo-ink dark:hover:border-[#FF7A00]'"
          @click="activeCategory = c"
        >
          <AppIcon :name="PARTNER_CATEGORY_ICONS[c]" class="h-4 w-4" />{{ t(`partners.categories.${c}`) }}
        </button>
      </div>

      <!-- Chargement -->
      <div v-if="showSkeleton" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="i in 3" :key="i" class="h-52 animate-pulse bg-tikeo-border" />
      </div>

      <!-- Aucun partenaire -->
      <AdminEmpty v-else-if="!partners.length" icon="handshake" :text="t('partners.empty')" />

      <template v-else>
        <!-- Mis en avant -->
        <div v-if="visibleFeatured.length" class="mb-12">
          <h2 class="mb-5 flex items-center gap-2 font-display text-xl font-extrabold tracking-tight text-tikeo-black md:text-2xl">
            <span class="h-[3px] w-6 bg-[#FF7A00]" aria-hidden="true" />{{ t('partners.featuredTitle') }}
          </h2>
          <ul class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <li v-for="p in visibleFeatured" :key="p.id" class="org-panel org-card-hover group relative flex flex-col p-5">
              <span class="absolute right-0 top-0 flex items-center gap-1 bg-[#FF7A00] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-tikeo-ink">
                <AppIcon name="star" class="h-3 w-3" :stroke="2.4" />{{ t('partners.featuredBadge') }}
              </span>
              <div class="flex items-center gap-4">
                <span class="block h-24 w-24 shrink-0 border border-tikeo-border"><PartnerLogo :partner="p" /></span>
                <div class="min-w-0">
                  <h3 class="font-display text-xl font-extrabold leading-tight text-tikeo-black">{{ p.name }}</h3>
                  <p class="mt-1 flex items-center gap-1.5 text-xs font-semibold text-tikeo-gray-text">
                    <AppIcon :name="PARTNER_CATEGORY_ICONS[p.category]" class="h-3.5 w-3.5 text-tikeo-orange" />{{ t(`partners.categories.${p.category}`) }}
                  </p>
                </div>
              </div>
              <p v-if="p.description" class="mt-4 text-sm leading-relaxed text-tikeo-gray-text">{{ p.description }}</p>
              <a
                v-if="safeExternalUrl(p.website_url)"
                :href="safeExternalUrl(p.website_url)"
                target="_blank"
                rel="noopener noreferrer nofollow"
                class="acc-link mt-auto inline-flex items-center gap-1.5 self-start pt-5"
              >
                {{ t('partners.visit') }}<AppIcon name="arrow-up-right" class="h-4 w-4" :stroke="2.2" />
              </a>
            </li>
          </ul>
        </div>

        <!-- Tous les autres -->
        <div v-if="visibleRegular.length">
          <h2 v-if="visibleFeatured.length" class="mb-5 flex items-center gap-2 font-display text-xl font-extrabold tracking-tight text-tikeo-black md:text-2xl">
            <span class="h-[3px] w-6 bg-tikeo-blue" aria-hidden="true" />{{ t('partners.othersTitle') }}
          </h2>
          <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            <li v-for="p in visibleRegular" :key="p.id">
              <component
                :is="safeExternalUrl(p.website_url) ? 'a' : 'div'"
                v-bind="safeExternalUrl(p.website_url) ? { href: safeExternalUrl(p.website_url), target: '_blank', rel: 'noopener noreferrer nofollow' } : {}"
                class="org-panel org-card-hover group flex h-full flex-col"
              >
                <span class="block h-28 border-b border-tikeo-border"><PartnerLogo :partner="p" /></span>
                <span class="flex flex-1 flex-col p-3">
                  <span class="truncate text-sm font-bold text-tikeo-black">{{ p.name }}</span>
                  <span class="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-tikeo-gray-text">
                    <AppIcon :name="PARTNER_CATEGORY_ICONS[p.category]" class="h-3 w-3 text-tikeo-orange" />{{ t(`partners.categories.${p.category}`) }}
                  </span>
                  <span v-if="p.description" class="mt-2 line-clamp-2 text-xs leading-relaxed text-tikeo-gray-text">{{ p.description }}</span>
                </span>
              </component>
            </li>
          </ul>
        </div>
      </template>
    </section>

    <!-- Pourquoi devenir partenaire -->
    <section class="border-y border-tikeo-border bg-tikeo-surface">
      <div class="mx-auto max-w-tikeo-container px-4 py-12 md:px-6 md:py-16">
        <SectionHeading :eyebrow="t('partners.whyEyebrow')" :title="t('partners.whyTitle')" :text="t('partners.whyText')" />
        <ul class="mt-8 grid gap-6 md:grid-cols-3">
          <li v-for="b in benefits" :key="b.title" class="flex gap-4 md:flex-col md:gap-3">
            <span class="flex h-11 w-11 shrink-0 items-center justify-center bg-tikeo-ink text-white dark:bg-tikeo-orange dark:text-tikeo-ink"><AppIcon :name="b.icon" class="h-5 w-5" /></span>
            <div>
              <h3 class="font-display text-base font-bold text-tikeo-black">{{ b.title }}</h3>
              <p class="mt-1 text-sm leading-relaxed text-tikeo-gray-text">{{ b.text }}</p>
            </div>
          </li>
        </ul>
        <div class="mt-10">
          <NuxtLink to="/contact?sujet=partenaire" class="btn-ink">{{ t('partners.ctaButton') }}<AppIcon name="arrow-right" class="h-4 w-4" :stroke="2.2" /></NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>
