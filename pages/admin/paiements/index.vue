<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
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

const statusBadgeClass: Record<string, string> = {
  pending: 'text-tikeo-gray-text',
  processing: 'text-tikeo-blue',
  success: 'text-tikeo-success',
  failed: 'text-tikeo-error',
  cancelled: 'text-tikeo-error',
  refunded: 'text-tikeo-error',
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

    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <input v-model="search" type="text" :placeholder="t('adminPayments.searchPlaceholder')" class="input-field w-full sm:max-w-xs" />
      <select v-model="statusFilter" class="input-field w-full sm:w-auto">
        <option value="all">{{ t('adminPayments.filterAll') }}</option>
        <option v-for="(label, key) in statusLabels" :key="key" :value="key">{{ label }}</option>
      </select>
    </div>

    <p v-if="errorMessage" class="mb-4 border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{{ errorMessage }}</p>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 4" :key="i" class="h-14 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>

    <div v-else-if="filtered.length === 0" class="border border-dashed border-tikeo-border p-10 text-center text-sm text-tikeo-gray-text">
      {{ t('adminPayments.empty') }}
    </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full border border-tikeo-border text-left text-sm">
        <thead class="bg-tikeo-surface-alt text-xs uppercase text-tikeo-gray-text">
          <tr>
            <th class="px-3 py-2">{{ t('adminPayments.colPayment') }}</th>
            <th class="px-3 py-2">{{ t('adminPayments.colOrder') }}</th>
            <th class="px-3 py-2">{{ t('adminPayments.colEvent') }}</th>
            <th class="px-3 py-2">{{ t('adminPayments.colProvider') }}</th>
            <th class="px-3 py-2">{{ t('adminPayments.colAmount') }}</th>
            <th class="px-3 py-2">{{ t('adminPayments.colStatus') }}</th>
            <th class="px-3 py-2">{{ t('adminPayments.colDate') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-tikeo-border">
          <tr v-for="p in filtered" :key="p.id">
            <td class="whitespace-nowrap px-3 py-2 font-mono text-xs text-tikeo-black">{{ p.transaction_reference || p.id.slice(0, 8) }}</td>
            <td class="px-3 py-2 text-tikeo-gray-text">{{ p.order?.order_number || '—' }}</td>
            <td class="px-3 py-2 font-medium text-tikeo-black">{{ p.order?.event?.title || '—' }}</td>
            <td class="px-3 py-2 capitalize text-tikeo-gray-text">{{ p.provider }}</td>
            <td class="px-3 py-2 text-tikeo-gray-text">{{ p.amount.toLocaleString('fr-FR') }} {{ p.currency }}</td>
            <td class="px-3 py-2 font-medium" :class="statusBadgeClass[p.status]">{{ statusLabels[p.status] }}</td>
            <td class="whitespace-nowrap px-3 py-2 text-tikeo-gray-text">{{ new Date(p.created_at).toLocaleDateString('fr-FR') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
