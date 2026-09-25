<script setup lang="ts">
const { t } = useI18n()
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="mx-auto flex max-w-2xl flex-col items-center gap-3 px-6 py-20 text-center">
    <img src="/logo-tikeo.png" alt="Tikeo" class="h-10 w-auto" />
    <h1 class="text-xl font-bold text-tikeo-black">{{ title }}</h1>
    <p class="text-sm text-tikeo-gray-text">
      {{ description || t('common.comingSoon') }}
    </p>
    <NuxtLink to="/" class="btn-primary mt-2">{{ t('common.backHome') }}</NuxtLink>
  </div>
</template>
