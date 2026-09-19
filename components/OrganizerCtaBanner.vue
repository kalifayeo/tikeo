<script setup lang="ts">
const { t } = useI18n()
const steps = computed(() => [
  { title: t('organizerBanner.step1Title'), text: t('organizerBanner.step1Text'), icon: 'M12 4v16m8-8H4' },
  { title: t('organizerBanner.step2Title'), text: t('organizerBanner.step2Text'), icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { title: t('organizerBanner.step3Title'), text: t('organizerBanner.step3Text'), icon: 'M3 3v18h18M9 17V9m4 8V5m4 12v-6' },
])
</script>

<template>
  <section class="mx-auto max-w-tikeo-container px-4 py-8 md:px-6">
    <div class="relative overflow-hidden bg-tikeo-brand p-6 text-white md:p-10">
      <div class="relative z-10 grid gap-8 md:grid-cols-[1.1fr_1.4fr] md:items-center">
        <div>
          <p class="mb-2 text-xs font-bold uppercase tracking-wide text-white/80">{{ t('organizerBanner.eyebrow') }}</p>
          <h2 class="text-2xl font-extrabold leading-tight md:text-3xl">{{ t('organizerBanner.title') }}</h2>
          <p class="mt-3 text-sm text-white/90 md:text-base">
            {{ t('organizerBanner.subtitle') }}
          </p>
          <NuxtLink to="/organisateur/evenements/nouveau" class="mt-5 inline-flex items-center justify-center gap-2 bg-white px-6 py-3 text-sm font-bold text-tikeo-black transition hover:bg-white/90">
            {{ t('organizerBanner.cta') }}
          </NuxtLink>
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          <div v-for="(step, i) in steps" :key="step.title" class="border border-white/25 bg-white/10 p-4 backdrop-blur-sm">
            <span class="mb-2 flex h-8 w-8 items-center justify-center bg-white/15 text-xs font-bold">{{ i + 1 }}</span>
            <svg class="mb-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" :d="step.icon" />
            </svg>
            <h3 class="text-sm font-bold">{{ step.title }}</h3>
            <p class="mt-1 text-xs text-white/85">{{ step.text }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
