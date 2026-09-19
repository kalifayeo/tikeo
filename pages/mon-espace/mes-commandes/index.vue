<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const { orders, loading, errorMessage } = useMyOrders()

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

const statusClasses: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-tikeo-success',
  failed: 'bg-red-100 text-tikeo-error',
  cancelled: 'bg-tikeo-gray-light text-tikeo-gray-text',
  refunded: 'bg-blue-100 text-tikeo-blue',
}
</script>

<template>
  <div class="mx-auto max-w-tikeo-container px-4 py-6 md:px-6">
    <AccountNav />

    <h1 class="mb-6 text-xl font-bold text-tikeo-black">{{ t('placeholderPages.myOrders') }}</h1>

    <p v-if="errorMessage" class="mb-4 border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{{ errorMessage }}</p>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-24 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>

    <div v-else-if="orders.length === 0" class="flex flex-col items-center gap-3 border border-dashed border-tikeo-border p-10 text-center">
      <p class="text-sm text-tikeo-gray-text">{{ t('buyerOrders.empty') }}</p>
      <NuxtLink to="/evenements" class="btn-primary">{{ t('common.browseEvents') }}</NuxtLink>
    </div>

    <ul v-else class="space-y-3">
      <li v-for="order in orders" :key="order.id" class="border border-tikeo-border p-4">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p class="text-sm font-semibold text-tikeo-black">{{ order.event?.title || t('buyerOrders.orderNumber', { number: order.order_number }) }}</p>
            <p class="text-xs text-tikeo-gray-text">{{ t('buyerOrders.orderNumber', { number: order.order_number }) }} · {{ formatDate(order.created_at) }}</p>
          </div>
          <span class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="statusClasses[order.status]">
            {{ t(`orderStatus.${order.status}`) }}
          </span>
        </div>

        <ul class="mt-3 space-y-1 border-t border-tikeo-border pt-3 text-sm text-tikeo-gray-text">
          <li v-for="item in order.items" :key="item.id">
            {{ t('buyerOrders.ticketsLine', { quantity: item.quantity, name: item.ticket_type?.name || '—' }) }}
          </li>
        </ul>

        <div class="mt-3 flex items-center justify-between border-t border-tikeo-border pt-3">
          <p class="text-sm font-semibold text-tikeo-black">{{ t('buyerOrders.total') }} : {{ order.total.toLocaleString('fr-FR') }} FCFA</p>
          <NuxtLink v-if="order.event?.slug" :to="`/e/${order.event.slug}`" class="text-xs font-semibold text-tikeo-orange">
            {{ t('buyerOrders.viewEvent') }}
          </NuxtLink>
        </div>
      </li>
    </ul>
  </div>
</template>
