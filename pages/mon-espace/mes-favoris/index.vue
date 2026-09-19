<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const { events, loading } = useFavoriteEvents()
</script>

<template>
  <div class="mx-auto max-w-tikeo-container px-4 py-6 md:px-6">
    <AccountNav />

    <h1 class="mb-6 text-xl font-bold text-tikeo-black">{{ t('header.favorites') }}</h1>

    <div v-if="loading" class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      <div v-for="i in 5" :key="i" class="h-56 animate-pulse bg-tikeo-surface-alt" />
    </div>

    <div v-else-if="events.length === 0" class="flex flex-col items-center gap-3 border border-dashed border-tikeo-border p-10 text-center">
      <p class="text-sm text-tikeo-gray-text">{{ t('buyerFavorites.empty') }}</p>
      <NuxtLink to="/evenements" class="btn-primary">{{ t('common.browseEvents') }}</NuxtLink>
    </div>

    <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      <EventCard v-for="event in events" :key="event.id" :event="event" />
    </div>
  </div>
</template>
