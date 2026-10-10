<script setup lang="ts">
const { t } = useI18n()
const { stats } = useHomeStats()

const badges = computed(() => [
  {
    title: t('trustStats.badgePaymentTitle'),
    text: t('trustStats.badgePaymentText'),
    icon: 'M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM3 10h18M16 15h2',
  },
  {
    title: t('trustStats.badgeQrTitle'),
    text: t('trustStats.badgeQrText'),
    icon: 'M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 2h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm4 0h2v2h-2v-2zm0-8h2v2h-2v-2z',
  },
  {
    title: t('trustStats.badgeSupportTitle'),
    text: t('trustStats.badgeSupportText'),
    icon: 'M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  },
])

const statItems = computed(() => [
  { value: stats.value.events, suffix: '+', label: t('trustStats.statEvents') },
  { value: stats.value.organizers, suffix: '+', label: t('trustStats.statOrganizers') },
  { value: stats.value.cities, suffix: '', label: t('trustStats.statCities') },
])

// Logos réellement utilisés au paiement (public/paiement/*).
const payments = [
  { name: 'Orange Money', src: '/paiement/orange-money.png' },
  { name: 'MTN MoMo', src: '/paiement/mtn.png' },
  { name: 'Moov Money', src: '/paiement/moov.png' },
  { name: 'Wave', src: '/paiement/wave.png' },
  { name: 'Djamo', src: '/paiement/djamo.png' },
  { name: 'Carte bancaire', src: '/paiement/carte.png' },
]
const showStats = computed(() => stats.value.loaded && stats.value.events > 0)
</script>

<template>
  <section class="mt-14 border-y border-tikeo-border bg-tikeo-surface md:mt-20">
    <div class="mx-auto max-w-tikeo-container px-4 py-12 md:px-6 md:py-16">
      <div class="grid gap-10 lg:gap-16" :class="showStats ? 'lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]' : ''">
        <!-- Chiffres réels (calculés en base, jamais inventés) -->
        <div v-if="showStats">
          <h2 class="font-display text-2xl font-extrabold tracking-tight text-tikeo-black md:text-4xl">{{ t('trustStats.title') }}</h2>
          <p class="mt-2 text-sm text-tikeo-gray-text md:text-base">{{ t('trustStats.subtitle') }}</p>
          <dl class="mt-8 grid grid-cols-3 gap-4">
            <div v-for="item in statItems" :key="item.label" class="flex flex-col-reverse justify-end">
              <dt class="mt-1 text-xs leading-snug text-tikeo-gray-text md:text-sm">{{ item.label }}</dt>
              <dd class="font-display text-3xl font-extrabold text-tikeo-black md:text-5xl">{{ item.value.toLocaleString('fr-FR') }}{{ item.suffix }}</dd>
            </div>
          </dl>
        </div>

        <div>
          <h2 v-if="!showStats" class="mb-8 font-display text-2xl font-extrabold tracking-tight text-tikeo-black md:text-4xl">{{ t('trustStats.title') }}</h2>
          <ul class="grid gap-6 md:grid-cols-3">
            <li v-for="badge in badges" :key="badge.title" class="flex gap-4 md:flex-col md:gap-3">
              <span class="flex h-11 w-11 shrink-0 items-center justify-center bg-tikeo-ink text-white dark:bg-tikeo-orange dark:text-tikeo-ink">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" :d="badge.icon" />
                </svg>
              </span>
              <div>
                <h3 class="font-display text-base font-bold text-tikeo-black">{{ badge.title }}</h3>
                <p class="mt-1 text-sm leading-relaxed text-tikeo-gray-text">{{ badge.text }}</p>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <!-- Moyens de paiement -->
      <div class="mt-10 flex flex-col gap-4 border-t border-tikeo-border pt-6 md:flex-row md:items-center md:gap-8">
        <p class="text-sm font-semibold text-tikeo-black">{{ t('trustStats.payWith') }}</p>
        <ul class="flex flex-wrap items-center gap-2.5">
          <li v-for="p in payments" :key="p.name">
            <img :src="p.src" :alt="p.name" :title="p.name" width="44" height="44" loading="lazy" class="h-11 w-11 border border-tikeo-border bg-white object-contain p-1" />
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
