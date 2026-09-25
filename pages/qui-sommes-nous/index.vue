<script setup lang="ts">
const { t } = useI18n()
const { stats } = useHomeStats()

const values = computed(() => [
  { title: t('aboutPage.value1Title'), text: t('aboutPage.value1Text'), icon: 'shield' },
  { title: t('aboutPage.value2Title'), text: t('aboutPage.value2Text'), icon: 'bolt' },
  { title: t('aboutPage.value3Title'), text: t('aboutPage.value3Text'), icon: 'pin' },
])

const icons: Record<string, string> = {
  shield: 'M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z',
  bolt: 'M13 2L4 14h6l-1 8 9-12h-6l1-8z',
  pin: 'M12 21s7-6.5 7-11a7 7 0 10-14 0c0 4.5 7 11 7 11zM12 13a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
}
</script>

<template>
  <div>
    <section class="border-b border-tikeo-border bg-tikeo-surface">
      <div class="mx-auto max-w-tikeo-container px-4 py-12 text-center md:px-6 md:py-16">
        <p class="mb-2 text-xs font-bold uppercase tracking-wide text-tikeo-orange">{{ t('aboutPage.eyebrow') }}</p>
        <h1 class="mx-auto max-w-2xl text-2xl font-extrabold text-tikeo-black md:text-4xl">{{ t('aboutPage.title') }}</h1>
        <p class="mx-auto mt-4 max-w-xl text-sm text-tikeo-gray-text md:text-base">{{ t('aboutPage.intro') }}</p>
      </div>
    </section>

    <section class="mx-auto max-w-tikeo-container px-4 py-10 md:px-6 md:py-14">
      <div class="grid gap-8 md:grid-cols-2 md:items-center">
        <div>
          <h2 class="mb-3 text-lg font-bold text-tikeo-black md:text-xl">{{ t('aboutPage.missionTitle') }}</h2>
          <p class="text-sm leading-relaxed text-tikeo-gray-text md:text-base">{{ t('aboutPage.missionText') }}</p>
        </div>
        <div class="grid grid-cols-3 gap-3 border border-tikeo-border bg-tikeo-surface p-5 text-center">
          <div>
            <p class="text-xl font-extrabold text-tikeo-orange md:text-2xl">{{ stats.events }}+</p>
            <p class="mt-1 text-[11px] text-tikeo-gray-text md:text-xs">{{ t('aboutPage.statsEventsLabel') }}</p>
          </div>
          <div>
            <p class="text-xl font-extrabold text-tikeo-orange md:text-2xl">{{ stats.organizers }}+</p>
            <p class="mt-1 text-[11px] text-tikeo-gray-text md:text-xs">{{ t('aboutPage.statsOrganizersLabel') }}</p>
          </div>
          <div>
            <p class="text-xl font-extrabold text-tikeo-orange md:text-2xl">{{ stats.cities }}+</p>
            <p class="mt-1 text-[11px] text-tikeo-gray-text md:text-xs">{{ t('aboutPage.statsCitiesLabel') }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="border-y border-tikeo-border bg-tikeo-surface-alt">
      <div class="mx-auto max-w-tikeo-container px-4 py-10 md:px-6 md:py-14">
        <h2 class="mb-6 text-center text-lg font-bold text-tikeo-black md:text-xl">{{ t('aboutPage.valuesTitle') }}</h2>
        <div class="grid gap-4 md:grid-cols-3">
          <div v-for="v in values" :key="v.title" class="border border-tikeo-border bg-tikeo-surface p-5">
            <div class="mb-3 flex h-10 w-10 items-center justify-center bg-tikeo-orange/10 text-tikeo-orange">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" :d="icons[v.icon]" />
              </svg>
            </div>
            <h3 class="mb-1.5 text-sm font-bold text-tikeo-black">{{ v.title }}</h3>
            <p class="text-sm text-tikeo-gray-text">{{ v.text }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-tikeo-container px-4 py-12 text-center md:px-6 md:py-16">
      <h2 class="text-lg font-bold text-tikeo-black md:text-xl">{{ t('aboutPage.ctaTitle') }}</h2>
      <p class="mx-auto mt-2 max-w-md text-sm text-tikeo-gray-text">{{ t('aboutPage.ctaText') }}</p>
      <NuxtLink to="/organisateur" class="btn-primary mt-5 inline-flex">{{ t('aboutPage.ctaButton') }}</NuxtLink>
    </section>
  </div>
</template>
