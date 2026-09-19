<script setup lang="ts">
const { t } = useI18n()
const sections = computed(() =>
  Array.from({ length: 10 }, (_, i) => ({
    title: t(`termsPage.s${i + 1}Title`),
    text: t(`termsPage.s${i + 1}Text`),
  }))
)
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-14">
    <div class="mb-8">
      <h1 class="text-2xl font-extrabold text-tikeo-black md:text-3xl">{{ t('termsPage.title') }}</h1>
      <p class="mt-2 text-xs text-tikeo-gray-text">{{ t('termsPage.updatedAt') }}</p>
      <p class="mt-4 text-sm leading-relaxed text-tikeo-gray-text">{{ t('termsPage.intro') }}</p>
    </div>

    <div class="space-y-6">
      <section v-for="s in sections" :key="s.title">
        <h2 class="mb-2 text-sm font-bold text-tikeo-black md:text-base">{{ s.title }}</h2>
        <p class="text-sm leading-relaxed text-tikeo-gray-text">{{ s.text }}</p>
      </section>
    </div>
  </div>
</template>
