<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const { events, loading } = useFavoriteEvents()
</script>

<template>
  <AccountShell :title="t('header.favorites')" :subtitle="t('account.subtitleFavorites')" width="full">
    <div v-if="loading" class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-4 xl:grid-cols-5">
      <div v-for="i in 5" :key="i" class="h-72 animate-pulse bg-tikeo-border" />
    </div>

    <div v-else-if="events.length === 0" class="acc-empty mx-auto max-w-3xl">
      <span class="flex h-14 w-14 items-center justify-center bg-tikeo-ink text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">
        <AppIcon name="heart" class="h-7 w-7" />
      </span>
      <p class="text-sm text-tikeo-gray-text">{{ t('buyerFavorites.empty') }}</p>
      <NuxtLink to="/evenements" class="btn-ink">{{ t('common.browseEvents') }}</NuxtLink>
    </div>

    <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-4 xl:grid-cols-5">
      <EventCard v-for="event in events" :key="event.id" :event="event" variant="grid" />
    </div>
  </AccountShell>
</template>
