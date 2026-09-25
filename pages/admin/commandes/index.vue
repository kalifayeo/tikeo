<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', adminPermission: 'orders.view' })
import type { OrderWithAdminDetails, OrderStatus } from '~/types/database'

const { t } = useI18n()
const supabase = useSupabase()
const authStore = useAuthStore()
const canConfirmPayment = computed(() => authStore.isSuperAdmin || authStore.hasPermission('payments.confirm'))
const loading = ref(true)
const orders = ref<OrderWithAdminDetails[]>([])
const buyerNames = ref<Record<string, string>>({})
const errorMessage = ref('')
const statusFilter = ref<'all' | OrderStatus>('all')
const search = ref('')

const statusLabels = computed<Record<string, string>>(() => ({
  pending: t('orderStatus.pending'),
  paid: t('orderStatus.paid'),
  failed: t('orderStatus.failed'),
  cancelled: t('orderStatus.cancelled'),
  refunded: t('orderStatus.refunded'),
}))

const statusBadgeClass: Record<string, string> = {
  pending: 'text-tikeo-gray-text',
  paid: 'text-tikeo-success',
  failed: 'text-tikeo-error',
  cancelled: 'text-tikeo-error',
  refunded: 'text-tikeo-error',
}

// ------------------------------------------------------------
// Confirmation manuelle d'un paiement reçu (le paiement en ligne n'est pas
// encore branché, voir composables/useEventDetail.ts). Déclenche la
// génération des billets et l'email de confirmation à l'acheteur
// (server/api/orders/[id]/confirm-payment.post.ts, migration 0019).
// ------------------------------------------------------------
const confirmingId = ref<string | null>(null)
const confirmedIds = ref<Set<string>>(new Set())

async function confirmPayment(order: OrderWithAdminDetails) {
  confirmingId.value = order.id
  errorMessage.value = ''
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) throw new Error('Session expirée, reconnectez-vous.')

    const { csrfHeader } = useCsrf()
    await $fetch(`/api/orders/${order.id}/confirm-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, ...(await csrfHeader()) },
      body: { provider: 'manual' },
    })

    order.status = 'paid'
    confirmedIds.value.add(order.id)
  } catch (e: any) {
    errorMessage.value = e?.data?.statusMessage || e?.message || t('adminOrders.errorConfirm')
  } finally {
    confirmingId.value = null
  }
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*, event:events(id, title, city)')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error
    orders.value = (data as unknown as OrderWithAdminDetails[]) ?? []

    const userIds = [...new Set(orders.value.map((o) => o.user_id).filter(Boolean))]
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds)
      buyerNames.value = Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, p.full_name]))
    }
  } catch (e: any) {
    errorMessage.value = e?.message || t('adminOrders.errorLoad')
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  let list = orders.value
  if (statusFilter.value !== 'all') list = list.filter((o) => o.status === statusFilter.value)
  const term = search.value.trim().toLowerCase()
  if (term) {
    list = list.filter((o) =>
      [o.order_number, o.event?.title, buyerNames.value[o.user_id]]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(term))
    )
  }
  return list
})

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-8 md:px-6">
    <h1 class="mb-6 text-xl font-bold text-tikeo-black">{{ t('adminOrders.title') }}</h1>

    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <input v-model="search" type="text" :placeholder="t('adminOrders.searchPlaceholder')" class="input-field w-full sm:max-w-xs" />
      <select v-model="statusFilter" class="input-field w-full sm:w-auto">
        <option value="all">{{ t('adminOrders.filterAll') }}</option>
        <option v-for="(label, key) in statusLabels" :key="key" :value="key">{{ label }}</option>
      </select>
    </div>

    <p v-if="errorMessage" class="mb-4 border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{{ errorMessage }}</p>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 4" :key="i" class="h-14 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>

    <div v-else-if="filtered.length === 0" class="border border-dashed border-tikeo-border p-10 text-center text-sm text-tikeo-gray-text">
      {{ t('adminOrders.empty') }}
    </div>

    <template v-else>
      <!-- Cartes empilées : lisibles sans défilement horizontal sur mobile/petit écran -->
      <div class="flex flex-col gap-3 md:hidden">
        <div v-for="o in filtered" :key="o.id" class="border border-tikeo-border bg-tikeo-surface p-3">
          <div class="flex items-start justify-between gap-2">
            <p class="min-w-0 flex-1 truncate font-medium text-tikeo-black">{{ o.event?.title || '—' }}</p>
            <span class="shrink-0 text-xs font-medium" :class="statusBadgeClass[o.status]">{{ statusLabels[o.status] }}</span>
          </div>
          <p class="mt-1 truncate font-mono text-xs text-tikeo-gray-text">{{ o.order_number }}</p>
          <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tikeo-gray-text">
            <span>{{ buyerNames[o.user_id] || '—' }}</span>
            <span>{{ o.total.toLocaleString('fr-FR') }} FCFA</span>
            <span>{{ new Date(o.created_at).toLocaleDateString('fr-FR') }}</span>
          </div>
          <div v-if="o.status === 'pending' && canConfirmPayment" class="mt-3">
            <button
              type="button"
              class="border border-tikeo-border px-2.5 py-1.5 text-xs font-semibold hover:border-tikeo-success hover:text-tikeo-success"
              :disabled="confirmingId === o.id"
              @click="confirmPayment(o)"
            >
              {{ confirmingId === o.id ? t('adminOrders.confirming') : t('adminOrders.confirmPayment') }}
            </button>
            <p v-if="confirmedIds.has(o.id)" class="mt-1 text-xs text-tikeo-success">{{ t('adminOrders.confirmedNotice') }}</p>
          </div>
        </div>
      </div>

      <!-- Tableau classique : à partir de md, l'écran est assez large pour toutes les colonnes -->
      <div class="hidden overflow-x-auto md:block">
        <table class="w-full border border-tikeo-border text-left text-sm">
          <thead class="bg-tikeo-surface-alt text-xs uppercase text-tikeo-gray-text">
            <tr>
              <th class="px-3 py-2">{{ t('adminOrders.colOrder') }}</th>
              <th class="px-3 py-2">{{ t('adminOrders.colEvent') }}</th>
              <th class="px-3 py-2">{{ t('adminOrders.colBuyer') }}</th>
              <th class="px-3 py-2">{{ t('adminOrders.colTotal') }}</th>
              <th class="px-3 py-2">{{ t('adminOrders.colStatus') }}</th>
              <th class="px-3 py-2">{{ t('adminOrders.colDate') }}</th>
              <th class="px-3 py-2">{{ t('adminOrders.colActions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-tikeo-border">
            <tr v-for="o in filtered" :key="o.id">
              <td class="whitespace-nowrap px-3 py-2 font-mono text-xs text-tikeo-black">{{ o.order_number }}</td>
              <td class="px-3 py-2 font-medium text-tikeo-black">{{ o.event?.title || '—' }}</td>
              <td class="px-3 py-2 text-tikeo-gray-text">{{ buyerNames[o.user_id] || '—' }}</td>
              <td class="px-3 py-2 text-tikeo-gray-text">{{ o.total.toLocaleString('fr-FR') }} FCFA</td>
              <td class="px-3 py-2 font-medium" :class="statusBadgeClass[o.status]">{{ statusLabels[o.status] }}</td>
              <td class="whitespace-nowrap px-3 py-2 text-tikeo-gray-text">{{ new Date(o.created_at).toLocaleDateString('fr-FR') }}</td>
              <td class="px-3 py-2">
                <template v-if="o.status === 'pending' && canConfirmPayment">
                  <button
                    type="button"
                    class="border border-tikeo-border px-2 py-1 text-xs hover:border-tikeo-success hover:text-tikeo-success"
                    :disabled="confirmingId === o.id"
                    @click="confirmPayment(o)"
                  >
                    {{ confirmingId === o.id ? t('adminOrders.confirming') : t('adminOrders.confirmPayment') }}
                  </button>
                </template>
                <span v-else-if="confirmedIds.has(o.id)" class="text-xs text-tikeo-success">{{ t('adminOrders.confirmedNotice') }}</span>
                <span v-else class="text-xs text-tikeo-gray-text">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
