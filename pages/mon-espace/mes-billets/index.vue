<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const { tickets, loading, errorMessage } = useMyTickets()

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

const statusClasses: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  valid: 'bg-green-100 text-tikeo-success',
  used: 'bg-tikeo-gray-light text-tikeo-gray-text',
  cancelled: 'bg-red-100 text-tikeo-error',
  refunded: 'bg-blue-100 text-tikeo-blue',
  expired: 'bg-tikeo-gray-light text-tikeo-gray-text',
}
</script>

<template>
  <div class="mx-auto max-w-tikeo-container px-4 py-6 md:px-6">
    <AccountNav />

    <h1 class="mb-6 text-xl font-bold text-tikeo-black">{{ t('header.myTickets') }}</h1>

    <p v-if="errorMessage" class="mb-4 border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{{ errorMessage }}</p>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 2" :key="i" class="h-28 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>

    <div v-else-if="tickets.length === 0" class="flex flex-col items-center gap-3 border border-dashed border-tikeo-border p-10 text-center">
      <p class="text-sm font-semibold text-tikeo-black">{{ t('buyerTickets.empty') }}</p>
      <p class="max-w-sm text-xs text-tikeo-gray-text">{{ t('buyerTickets.emptyHint') }}</p>
      <NuxtLink to="/evenements" class="btn-primary mt-1">{{ t('common.browseEvents') }}</NuxtLink>
    </div>

    <ul v-else class="grid gap-4 md:grid-cols-2">
      <li v-for="tk in tickets" :key="tk.id" class="flex gap-4 border border-tikeo-border p-4">
        <div class="flex h-20 w-20 shrink-0 items-center justify-center bg-tikeo-surface-alt text-[10px] text-tikeo-gray-text">
          {{ t('buyerTickets.qrPending') }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-2">
            <p class="truncate text-sm font-semibold text-tikeo-black">{{ tk.event?.title }}</p>
            <span class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="statusClasses[tk.status]">
              {{ t(`ticketStatus.${tk.status}`) }}
            </span>
          </div>
          <p class="mt-1 text-xs text-tikeo-gray-text">{{ tk.event ? formatDate(tk.event.start_date) : '' }} · {{ tk.event?.city }}</p>
          <p class="mt-1 text-xs text-tikeo-gray-text">{{ tk.ticket_type?.name }}</p>
          <p class="mt-2 font-mono text-[11px] text-tikeo-gray-text">{{ t('buyerTickets.ticketNumber', { number: tk.ticket_number }) }}</p>
          <NuxtLink v-if="tk.event?.slug" :to="`/e/${tk.event.slug}`" class="mt-2 inline-block text-xs font-semibold text-tikeo-orange">
            {{ t('buyerOrders.viewEvent') }}
          </NuxtLink>
        </div>
      </li>
    </ul>
  </div>
</template>
