<script setup lang="ts">
const { t } = useI18n()

const plans = computed(() => [
  {
    name: t('organizerPricingPage.essentialName'),
    tagline: t('organizerPricingPage.essentialTagline'),
    commission: t('organizerPricingPage.essentialCommission'),
    features: [
      t('organizerPricingPage.essentialFeature1'),
      t('organizerPricingPage.essentialFeature2'),
      t('organizerPricingPage.essentialFeature3'),
      t('organizerPricingPage.essentialFeature4'),
    ],
    highlight: false,
  },
  {
    name: t('organizerPricingPage.proName'),
    tagline: t('organizerPricingPage.proTagline'),
    badge: t('organizerPricingPage.proBadge'),
    commission: t('organizerPricingPage.proCommission'),
    features: [
      t('organizerPricingPage.proFeature1'),
      t('organizerPricingPage.proFeature2'),
      t('organizerPricingPage.proFeature3'),
      t('organizerPricingPage.proFeature4'),
    ],
    highlight: true,
  },
])

const faqs = computed(() => [
  { q: t('organizerPricingPage.faq1q'), a: t('organizerPricingPage.faq1a') },
  { q: t('organizerPricingPage.faq2q'), a: t('organizerPricingPage.faq2a') },
  { q: t('organizerPricingPage.faq3q'), a: t('organizerPricingPage.faq3a') },
])
</script>

<template>
  <div>
    <section class="border-b border-tikeo-border bg-tikeo-surface">
      <div class="mx-auto max-w-tikeo-container px-4 py-12 text-center md:px-6 md:py-16">
        <p class="mb-2 text-xs font-bold uppercase tracking-wide text-tikeo-orange">{{ t('organizerPricingPage.eyebrow') }}</p>
        <h1 class="mx-auto max-w-2xl text-2xl font-extrabold text-tikeo-black md:text-4xl">{{ t('organizerPricingPage.title') }}</h1>
        <p class="mx-auto mt-4 max-w-xl text-sm text-tikeo-gray-text md:text-base">{{ t('organizerPricingPage.intro') }}</p>
      </div>
    </section>

    <section class="mx-auto max-w-tikeo-container px-4 py-10 md:px-6 md:py-14">
      <div class="mx-auto grid max-w-3xl gap-5 md:grid-cols-2">
        <div
          v-for="plan in plans"
          :key="plan.name"
          class="relative flex flex-col border bg-tikeo-surface p-6"
          :class="plan.highlight ? 'border-tikeo-orange shadow-card-hover' : 'border-tikeo-border'"
        >
          <span
            v-if="plan.badge"
            class="absolute -top-3 left-6 bg-tikeo-orange px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
          >
            {{ plan.badge }}
          </span>
          <h2 class="text-lg font-bold text-tikeo-black">{{ plan.name }}</h2>
          <p class="mt-1 text-xs text-tikeo-gray-text">{{ plan.tagline }}</p>
          <p class="mt-4 text-2xl font-extrabold text-tikeo-orange">{{ plan.commission }}</p>
          <ul class="mt-5 flex-1 space-y-2.5">
            <li v-for="f in plan.features" :key="f" class="flex items-start gap-2 text-sm text-tikeo-black">
              <svg class="mt-0.5 h-4 w-4 shrink-0 text-tikeo-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {{ f }}
            </li>
          </ul>
          <NuxtLink to="/organisateur" class="mt-6" :class="plan.highlight ? 'btn-primary' : 'btn-secondary'">
            {{ t('organizerPricingPage.chooseButton') }}
          </NuxtLink>
        </div>
      </div>

      <div class="mx-auto mt-6 max-w-3xl border border-dashed border-tikeo-border p-5 text-center">
        <h3 class="text-sm font-bold text-tikeo-black">{{ t('organizerPricingPage.customName') }}</h3>
        <p class="mt-1 text-xs text-tikeo-gray-text">{{ t('organizerPricingPage.customTagline') }}</p>
        <p class="mx-auto mt-2 max-w-md text-sm text-tikeo-gray-text">{{ t('organizerPricingPage.customText') }}</p>
        <NuxtLink to="/contact" class="btn-secondary mt-4 inline-flex">{{ t('organizerPricingPage.customButton') }}</NuxtLink>
      </div>

      <p class="mx-auto mt-6 max-w-3xl text-center text-xs text-tikeo-gray-text">{{ t('organizerPricingPage.commissionNote') }}</p>
    </section>

    <section class="border-t border-tikeo-border bg-tikeo-surface-alt">
      <div class="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-14">
        <h2 class="mb-6 text-center text-lg font-bold text-tikeo-black md:text-xl">{{ t('organizerPricingPage.faqTitle') }}</h2>
        <div class="divide-y divide-tikeo-border border border-tikeo-border bg-tikeo-surface">
          <div v-for="f in faqs" :key="f.q" class="px-4 py-4">
            <h3 class="text-sm font-semibold text-tikeo-black">{{ f.q }}</h3>
            <p class="mt-1.5 text-sm text-tikeo-gray-text">{{ f.a }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-tikeo-container px-4 py-12 text-center md:px-6 md:py-16">
      <h2 class="text-lg font-bold text-tikeo-black md:text-xl">{{ t('organizerPricingPage.ctaTitle') }}</h2>
      <p class="mx-auto mt-2 max-w-md text-sm text-tikeo-gray-text">{{ t('organizerPricingPage.ctaText') }}</p>
      <NuxtLink to="/organisateur" class="btn-primary mt-5 inline-flex">{{ t('organizerPricingPage.ctaButton') }}</NuxtLink>
    </section>
  </div>
</template>
