<script setup lang="ts">
definePageMeta({ layout: 'organisateur', middleware: 'organizer' })

const { t } = useI18n()
const route = useRoute()
const { loading, error, stats, load } = useEventTicketStats()

onMounted(() => load(route.params.id as string))
</script>

<template>
  <div>
    <OrgPageHeader
      :eyebrow="t('organizerNav.fallbackTitle')"
      :title="t('ticketStats.title')"
      :subtitle="stats?.event.title"
      icon="chart"
      :back="{ to: '/organisateur/evenements', label: t('ticketStats.backToEvents') }"
    />
    <div class="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
      <div v-if="loading" class="space-y-3">
        <div v-for="i in 4" :key="i" class="org-skeleton h-14" />
      </div>
      <p v-else-if="error" class="acc-alert-error">{{ t('ticketStats.loadError') }}</p>
      <div v-else-if="stats" class="org-rise">
        <EventTicketStatsPanel :stats="stats" />
      </div>
    </div>
  </div>
</template>
