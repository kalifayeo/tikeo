<script setup lang="ts">
const { t } = useI18n()
const steps = computed(() => [
  { title: t('organizerBanner.step1Title'), text: t('organizerBanner.step1Text') },
  { title: t('organizerBanner.step2Title'), text: t('organizerBanner.step2Text') },
  { title: t('organizerBanner.step3Title'), text: t('organizerBanner.step3Text') },
])
</script>

<template>
  <section class="mx-auto max-w-tikeo-container px-4 py-14 md:px-6 md:py-20">
    <div class="grid gap-10 bg-tikeo-ink p-6 text-white md:p-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
      <div class="flex flex-col items-start">
        <h2 class="font-display text-3xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">{{ t('organizerBanner.title') }}</h2>
        <p class="mt-4 max-w-md text-base leading-relaxed text-white/75">{{ t('organizerBanner.subtitle') }}</p>
        <NuxtLink
          to="/organisateur/evenements/nouveau"
          class="mt-7 inline-flex h-12 items-center justify-center bg-[#FF7A00] px-7 text-sm font-bold text-tikeo-ink transition-colors hover:bg-white"
        >
          {{ t('organizerBanner.cta') }}
        </NuxtLink>
      </div>

      <!-- Vraie séquence : la numérotation a un sens ici -->
      <ol class="relative space-y-7">
        <span class="absolute bottom-3 left-[17px] top-3 w-px bg-white/20" aria-hidden="true" />
        <li v-for="(step, i) in steps" :key="step.title" class="relative flex gap-5">
          <span class="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center bg-[#FF7A00] font-display text-base font-extrabold text-tikeo-ink">{{ i + 1 }}</span>
          <div class="pt-0.5">
            <h3 class="font-display text-lg font-bold">{{ step.title }}</h3>
            <p class="mt-1 text-sm leading-relaxed text-white/70">{{ step.text }}</p>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>
