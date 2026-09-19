<script setup lang="ts">
definePageMeta({ layout: 'organisateur', middleware: 'organizer' })
const { t } = useI18n()
</script>

<template>
  <div class="mx-auto flex max-w-lg flex-col items-center gap-3 px-6 py-16 text-center">
    <div class="flex h-14 w-14 items-center justify-center rounded-full bg-tikeo-orange/10 text-tikeo-orange">
      <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 2h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm4 0h2v2h-2v-2zm0-8h2v2h-2v-2z" />
      </svg>
    </div>
    <h1 class="text-lg font-bold text-tikeo-black">{{ t('organizerScanner.title') }}</h1>
    <p class="text-sm text-tikeo-gray-text">{{ t('organizerScanner.description') }}</p>
    <NuxtLink to="/organisateur/evenements" class="btn-primary mt-2">{{ t('organizerScanner.viewEvents') }}</NuxtLink>
  </div>
</template>
