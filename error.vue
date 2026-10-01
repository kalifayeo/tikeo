<script setup lang="ts">
import type { NuxtError } from '#app'

// Page d'erreur globale : 404 personnalisée + erreurs inattendues.
// Le message technique n'est jamais affiché au visiteur (il reste dans les logs).
const props = defineProps<{ error: NuxtError }>()
const { t } = useI18n()

const is404 = computed(() => props.error?.statusCode === 404)

useSeoMeta({
  title: () => (is404.value ? t('notFoundPage.title404') : t('notFoundPage.titleError')),
  robots: 'noindex, nofollow',
})

function goHome() {
  clearError({ redirect: '/' })
}
function goEvents() {
  clearError({ redirect: '/evenements' })
}
</script>

<template>
  <NuxtLayout name="default">
    <section class="mx-auto flex max-w-xl flex-col items-center px-4 py-16 text-center md:py-24">
      <p class="text-7xl font-extrabold tracking-tight text-tikeo-orange md:text-8xl" aria-hidden="true">
        {{ is404 ? t('notFoundPage.code404') : error?.statusCode || '500' }}
      </p>
      <h1 class="mt-4 text-2xl font-bold text-tikeo-black md:text-3xl">
        {{ is404 ? t('notFoundPage.title404') : t('notFoundPage.titleError') }}
      </h1>
      <p class="mt-3 text-sm text-tikeo-gray-text md:text-base">
        {{ is404 ? t('notFoundPage.text404') : t('notFoundPage.textError') }}
      </p>
      <div class="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <button type="button" class="btn-primary" @click="goHome">{{ t('notFoundPage.home') }}</button>
        <button type="button" class="btn-secondary" @click="goEvents">{{ t('notFoundPage.events') }}</button>
      </div>
    </section>
  </NuxtLayout>
</template>
