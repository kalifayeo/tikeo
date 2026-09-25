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
</script>

<template>
  <section class="mx-auto max-w-tikeo-container px-4 py-8 md:px-6">
    <div class="border border-tikeo-border bg-tikeo-surface p-5 md:p-8">
      <div class="mb-6 text-center md:text-left">
        <h2 class="text-lg font-semibold text-tikeo-black">{{ t('trustStats.title') }}</h2>
        <p class="text-sm text-tikeo-gray-text">{{ t('trustStats.subtitle') }}</p>
      </div>

      <div v-if="stats.loaded && stats.events > 0" class="mb-8 grid grid-cols-3 gap-3 border-y border-tikeo-border py-5">
        <div v-for="item in statItems" :key="item.label" class="text-center">
          <p class="text-2xl font-extrabold text-tikeo-orange md:text-3xl">{{ item.value.toLocaleString('fr-FR') }}{{ item.suffix }}</p>
          <p class="mt-1 text-xs text-tikeo-gray-text md:text-sm">{{ item.label }}</p>
        </div>
      </div>

      <div class="grid gap-5 md:grid-cols-3">
        <div v-for="badge in badges" :key="badge.title" class="flex flex-col items-start gap-2.5">
          <span class="flex h-10 w-10 items-center justify-center bg-tikeo-orange/10 text-tikeo-orange">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" :d="badge.icon" />
            </svg>
          </span>
          <h3 class="text-sm font-bold text-tikeo-black">{{ badge.title }}</h3>
          <p class="text-xs leading-relaxed text-tikeo-gray-text">{{ badge.text }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
