<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const { orders, loading, errorMessage, hideOrders } = useMyOrders()

// Suppression de l'historique (masquage) avec confirmation.
const orderToDelete = ref<string | null>(null)
const deleting = ref(false)
const deleteError = ref('')
function askDelete(id: string) {
  deleteError.value = ''
  orderToDelete.value = id
}
async function confirmDelete() {
  if (!orderToDelete.value) return
  deleting.value = true
  const ok = await hideOrders([orderToDelete.value])
  deleting.value = false
  if (ok) orderToDelete.value = null
  else deleteError.value = t('buyerDelete.error')
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

const statusClasses: Record<string, string> = {
  pending: 'bg-[#FF7A00]/15 text-tikeo-orange',
  paid: 'bg-tikeo-success/10 text-tikeo-success',
  failed: 'bg-tikeo-error/10 text-tikeo-error',
  cancelled: 'bg-tikeo-surface-alt text-tikeo-gray-text',
  refunded: 'bg-tikeo-blue/10 text-tikeo-blue',
}
</script>

<template>
  <AccountShell :title="t('placeholderPages.myOrders')" :subtitle="t('account.subtitleOrders')" width="wide">
    <p v-if="errorMessage" class="acc-alert-error mb-5">{{ errorMessage }}</p>

    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="h-32 animate-pulse bg-tikeo-border" />
    </div>

    <div v-else-if="orders.length === 0" class="acc-empty">
      <span class="flex h-14 w-14 items-center justify-center bg-tikeo-ink text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">
        <AppIcon name="wallet" class="h-7 w-7" />
      </span>
      <p class="text-sm text-tikeo-gray-text">{{ t('buyerOrders.empty') }}</p>
      <NuxtLink to="/evenements" class="btn-ink">{{ t('common.browseEvents') }}</NuxtLink>
    </div>

    <ul v-else class="space-y-4">
      <li v-for="order in orders" :key="order.id">
        <article class="flex bg-tikeo-surface shadow-card transition-shadow duration-300 hover:shadow-card-hover">
          <span class="w-1.5 shrink-0" :class="order.status === 'paid' ? 'bg-[#FF7A00]' : 'bg-tikeo-border'" aria-hidden="true" />

          <div class="min-w-0 flex-1 p-4 md:p-5">
            <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div class="min-w-0">
                <h3 class="truncate font-display text-lg font-bold leading-tight tracking-tight text-tikeo-black md:text-xl">
                  {{ order.event?.title || t('buyerOrders.orderNumber', { number: order.order_number }) }}
                </h3>
                <p class="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-tikeo-gray-text md:text-sm">
                  <span class="font-mono">{{ t('buyerOrders.orderNumber', { number: order.order_number }) }}</span>
                  <span aria-hidden="true">·</span>
                  <span>{{ formatDate(order.created_at) }}</span>
                </p>
              </div>
              <span class="acc-tag" :class="statusClasses[order.status]">{{ t(`orderStatus.${order.status}`) }}</span>
            </div>

            <ul class="mt-4 space-y-1.5 border-t-2 border-dashed border-tikeo-gray-text/25 pt-4 text-sm text-tikeo-gray-text">
              <li v-for="item in order.items" :key="item.id" class="flex items-center gap-2">
                <AppIcon name="ticket" class="h-4 w-4 shrink-0 text-tikeo-orange" />
                {{ t('buyerOrders.ticketsLine', { quantity: item.quantity, name: item.ticket_type?.name || '—' }) }}
              </li>
            </ul>

            <div class="mt-4 flex flex-wrap items-end justify-between gap-3">
              <p class="leading-tight">
                <span class="acc-label block">{{ t('buyerOrders.total') }}</span>
                <span class="font-display text-2xl font-extrabold text-tikeo-black">
                  {{ order.total.toLocaleString('fr-FR') }} <span class="text-sm font-semibold text-tikeo-gray-text">FCFA</span>
                </span>
              </p>
              <div class="flex items-center gap-4">
                <NuxtLink v-if="order.event?.slug" :to="`/e/${order.event.slug}`" class="text-[13px] font-bold text-tikeo-black underline decoration-[#FF7A00] decoration-2 underline-offset-[5px] hover:text-tikeo-orange">
                  {{ t('buyerOrders.viewEvent') }}
                </NuxtLink>
                <!-- Une commande en attente de paiement ne se supprime pas : elle expire d'elle-même. -->
                <button
                  v-if="order.status !== 'pending'"
                  type="button"
                  class="acc-btn-ghost !h-9 !px-3 !text-xs hover:!border-tikeo-error hover:!text-tikeo-error"
                  :aria-label="t('buyerDelete.orderAria', { number: order.order_number })"
                  @click="askDelete(order.id)"
                >
                  <TrashIcon />
                  <span class="hidden sm:inline">{{ t('buyerDelete.delete') }}</span>
                </button>
              </div>
            </div>
          </div>
        </article>
      </li>
    </ul>

    <ConfirmDeleteModal
      :open="!!orderToDelete"
      :title="t('buyerDelete.orderTitle')"
      :message="t('buyerDelete.orderBody')"
      :loading="deleting"
      :error-message="deleteError"
      @confirm="confirmDelete"
      @cancel="orderToDelete = null"
    />
  </AccountShell>
</template>
