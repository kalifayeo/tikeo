<script setup lang="ts">
const { t } = useI18n()

useSeoMeta({
  title: () => `${t('termsPage.title')} | Tikeo`,
  description: () => t('termsPage.intro'),
})

const sections = computed(() =>
  Array.from({ length: 10 }, (_, i) => ({
    title: t(`termsPage.s${i + 1}Title`),
    text: t(`termsPage.s${i + 1}Text`),
  })),
)
</script>

<template>
  <LegalLayout
    :title="t('termsPage.title')"
    :updated-at="t('termsPage.updatedAt')"
    :intro="t('termsPage.intro')"
    :sections="sections"
    :other="{ to: '/confidentialite', label: t('privacyPage.title') }"
  />
</template>
