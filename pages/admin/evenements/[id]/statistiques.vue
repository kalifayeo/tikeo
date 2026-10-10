<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', adminPermission: 'events.view' })

const { t } = useI18n()
const route = useRoute()
const { loading, error, stats, load } = useEventTicketStats()

onMounted(() => load(route.params.id as string))
</script>

<template>
  <div>
    <NuxtLink to="/admin/evenements" class="inline-flex items-center gap-1.5 text-xs font-semibold text-tikeo-orange"><AppIcon name="arrow-left" class="h-4 w-4" />{{ t('ticketStats.backToEvents') }}</NuxtLink>
    <h1 class="mb-1 mt-2 text-xl font-bold text-tikeo-black">{{ t('ticketStats.title') }}</h1>
    <p v-if="stats" class="mb-6 text-sm text-tikeo-gray-text">{{ stats.event.title }}</p>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 4" :key="i" class="h-12 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>
    <p v-else-if="error" class="acc-alert-error">{{ t('ticketStats.loadError') }}</p>
    <EventTicketStatsPanel v-else-if="stats" :stats="stats" />
  </div>
</template>
