<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', adminPermission: 'payments.view' })
import type { PaymentWithAdminDetails, PaymentStatus } from '~/types/database'

const { t } = useI18n()
const supabase = useSupabase()
const loading = ref(true)
const payments = ref<PaymentWithAdminDetails[]>([])
const errorMessage = ref('')
const statusFilter = ref<'all' | PaymentStatus>('all')
const search = ref('')

const statusLabels = computed<Record<string, string>>(() => ({
  pending: t('paymentStatus.pending'),
  processing: t('paymentStatus.processing'),
  success: t('paymentStatus.success'),
  failed: t('paymentStatus.failed'),
  cancelled: t('paymentStatus.cancelled'),
  refunded: t('paymentStatus.refunded'),
}))

const statusTone: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  pending: 'warning',
  processing: 'info',
  success: 'success',
  failed: 'error',
  cancelled: 'error',
  refunded: 'neutral',
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*, order:orders(id, order_number, user_id, event:events(id, title))')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error
    payments.value = (data as unknown as PaymentWithAdminDetails[]) ?? []
  } catch (e: any) {
    errorMessage.value = e?.message || t('adminPayments.errorLoad')
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  let list = payments.value
  if (statusFilter.value !== 'all') list = list.filter((p) => p.status === statusFilter.value)
  const term = search.value.trim().toLowerCase()
  if (term) {
    list = list.filter((p) =>
      [p.transaction_reference, p.order?.order_number, p.order?.event?.title, p.provider]
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
    <h1 class="mb-6 text-xl font-bold text-tikeo-black">{{ t('adminPayments.title') }}</h1>

    <div class="admin-toolbar">
      <AdminSearch v-model="search" :placeholder="t('adminPayments.searchPlaceholder')" />
      <select v-model="statusFilter" class="h-11 w-full border border-tikeo-border bg-tikeo-surface px-3 text-sm font-semibold text-tikeo-black focus:border-[#FF7A00] focus:outline-none sm:w-auto">
        <option value="all">{{ t('adminPayments.filterAll') }}</option>
        <option v-for="(label, key) in statusLabels" :key="key" :value="key">{{ label }}</option>
      </select>
    </div>

    <p v-if="errorMessage" class="acc-alert-error mb-4">{{ errorMessage }}</p>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 4" :key="i" class="h-14 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>

    <AdminEmpty v-else-if="filtered.length === 0" icon="card" :text="t('adminPayments.empty')" />

    <template v-else>
      <!-- Cartes empilées : lisibles sans défilement horizontal sur mobile/petit écran -->
      <div class="flex flex-col gap-3 md:hidden">
        <div v-for="p in filtered" :key="p.id" class="org-panel p-3">
          <div class="flex items-start justify-between gap-2">
            <p class="min-w-0 flex-1 truncate font-medium text-tikeo-black">{{ p.order?.event?.title || '—' }}</p>
            <StatusPill :tone="statusTone[p.status] || 'neutral'">{{ statusLabels[p.status] }}</StatusPill>
          </div>
          <p class="mt-1 truncate font-mono text-xs text-tikeo-gray-text">{{ p.transaction_reference || p.id.slice(0, 8) }}</p>
          <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tikeo-gray-text">
            <span>{{ t('adminPayments.colOrder') }} : {{ p.order?.order_number || '—' }}</span>
            <span class="capitalize">{{ p.provider }}</span>
            <span>{{ p.amount.toLocaleString('fr-FR') }} {{ p.currency }}</span>
            <span>{{ new Date(p.created_at).toLocaleDateString('fr-FR') }}</span>
          </div>
        </div>
      </div>

      <!-- Tableau classique : à partir de md, l'écran est assez large pour toutes les colonnes -->
      <div class="hidden overflow-x-auto md:block">
        <table class="w-full border border-tikeo-border text-left text-sm">
          <thead class="bg-tikeo-surface-alt text-tikeo-gray-text">
            <tr>
              <th class="px-3 py-3">{{ t('adminPayments.colPayment') }}</th>
              <th class="px-3 py-3">{{ t('adminPayments.colOrder') }}</th>
              <th class="px-3 py-3">{{ t('adminPayments.colEvent') }}</th>
              <th class="px-3 py-3">{{ t('adminPayments.colProvider') }}</th>
              <th class="px-3 py-3">{{ t('adminPayments.colAmount') }}</th>
              <th class="px-3 py-3">{{ t('adminPayments.colStatus') }}</th>
              <th class="px-3 py-3">{{ t('adminPayments.colDate') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-tikeo-border">
            <tr v-for="p in filtered" :key="p.id">
              <td class="whitespace-nowrap px-3 py-2 font-mono text-xs text-tikeo-black">{{ p.transaction_reference || p.id.slice(0, 8) }}</td>
              <td class="px-3 py-3 text-tikeo-gray-text">{{ p.order?.order_number || '—' }}</td>
              <td class="px-3 py-3 font-medium text-tikeo-black">{{ p.order?.event?.title || '—' }}</td>
              <td class="px-3 py-3 capitalize text-tikeo-gray-text">{{ p.provider }}</td>
              <td class="px-3 py-3 text-tikeo-gray-text">{{ p.amount.toLocaleString('fr-FR') }} {{ p.currency }}</td>
              <td class="px-3 py-3"><StatusPill :tone="statusTone[p.status] || 'neutral'">{{ statusLabels[p.status] }}</StatusPill></td>
              <td class="whitespace-nowrap px-3 py-2 text-tikeo-gray-text">{{ new Date(p.created_at).toLocaleDateString('fr-FR') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
