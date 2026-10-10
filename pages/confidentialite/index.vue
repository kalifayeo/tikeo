<script setup lang="ts">
const { t } = useI18n()

useSeoMeta({
  title: () => `${t('privacyPage.title')} | Tikeo`,
  description: () => t('privacyPage.intro'),
})

const sections = computed(() =>
  Array.from({ length: 8 }, (_, i) => ({
    title: t(`privacyPage.s${i + 1}Title`),
    text: t(`privacyPage.s${i + 1}Text`),
  })),
)
</script>

<template>
  <LegalLayout
    :title="t('privacyPage.title')"
    :updated-at="t('privacyPage.updatedAt')"
    :intro="t('privacyPage.intro')"
    :sections="sections"
    :other="{ to: '/conditions', label: t('termsPage.title') }"
  />
</template>
