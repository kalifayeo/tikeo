<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', adminPermission: 'tickets.view' })
import type { TicketWithAdminDetails, TicketStatus } from '~/types/database'

const { t } = useI18n()
const supabase = useSupabase()
const loading = ref(true)
const tickets = ref<TicketWithAdminDetails[]>([])
const buyerNames = ref<Record<string, string>>({})
const errorMessage = ref('')
const statusFilter = ref<'all' | TicketStatus>('all')
const search = ref('')

const statusLabels = computed<Record<string, string>>(() => ({
  pending: t('ticketStatus.pending'),
  valid: t('ticketStatus.valid'),
  used: t('ticketStatus.used'),
  cancelled: t('ticketStatus.cancelled'),
  refunded: t('ticketStatus.refunded'),
  expired: t('ticketStatus.expired'),
}))

const statusBadgeClass: Record<string, string> = {
  pending: 'text-tikeo-gray-text',
  valid: 'text-tikeo-blue',
  used: 'text-tikeo-success',
  cancelled: 'text-tikeo-error',
  refunded: 'text-tikeo-error',
  expired: 'text-tikeo-gray-text',
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data, error } = await supabase
      .from('tickets')
      .select('*, event:events(id, title, city), ticket_type:ticket_types(id, name, price), order:orders(id, order_number)')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error
    tickets.value = (data as unknown as TicketWithAdminDetails[]) ?? []

    const userIds = [...new Set(tickets.value.map((tk) => tk.user_id).filter(Boolean))]
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds)
      buyerNames.value = Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, p.full_name]))
    }
  } catch (e: any) {
    errorMessage.value = e?.message || t('adminTickets.errorLoad')
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  let list = tickets.value
  if (statusFilter.value !== 'all') list = list.filter((tk) => tk.status === statusFilter.value)
  const term = search.value.trim().toLowerCase()
  if (term) {
    list = list.filter((tk) =>
      [tk.ticket_number, tk.event?.title, buyerNames.value[tk.user_id]]
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
    <h1 class="mb-6 text-xl font-bold text-tikeo-black">{{ t('adminTickets.title') }}</h1>

    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <input v-model="search" type="text" :placeholder="t('adminTickets.searchPlaceholder')" class="input-field w-full sm:max-w-xs" />
      <select v-model="statusFilter" class="input-field w-full sm:w-auto">
        <option value="all">{{ t('adminTickets.filterAll') }}</option>
        <option v-for="(label, key) in statusLabels" :key="key" :value="key">{{ label }}</option>
      </select>
    </div>

    <p v-if="errorMessage" class="mb-4 border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{{ errorMessage }}</p>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 4" :key="i" class="h-14 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>

    <div v-else-if="filtered.length === 0" class="border border-dashed border-tikeo-border p-10 text-center text-sm text-tikeo-gray-text">
      {{ t('adminTickets.empty') }}
    </div>

    <template v-else>
      <!-- Cartes empilées : lisibles sans défilement horizontal sur mobile/petit écran -->
      <div class="flex flex-col gap-3 md:hidden">
        <div v-for="tk in filtered" :key="tk.id" class="border border-tikeo-border bg-tikeo-surface p-3">
          <div class="flex items-start justify-between gap-2">
            <p class="min-w-0 flex-1 truncate font-medium text-tikeo-black">{{ tk.event?.title || '—' }}</p>
            <span class="shrink-0 text-xs font-medium" :class="statusBadgeClass[tk.status]">{{ statusLabels[tk.status] }}</span>
          </div>
          <p class="mt-1 truncate font-mono text-xs text-tikeo-gray-text">{{ tk.ticket_number }}</p>
          <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tikeo-gray-text">
            <span>{{ t('adminTickets.colType') }} : {{ tk.ticket_type?.name || '—' }}</span>
            <span>{{ t('adminTickets.colBuyer') }} : {{ buyerNames[tk.user_id] || '—' }}</span>
            <span>{{ (tk.ticket_type?.price ?? 0).toLocaleString('fr-FR') }} FCFA</span>
            <span>{{ new Date(tk.created_at).toLocaleDateString('fr-FR') }}</span>
          </div>
        </div>
      </div>

      <!-- Tableau classique : à partir de md, l'écran est assez large pour toutes les colonnes -->
      <div class="hidden overflow-x-auto md:block">
        <table class="w-full border border-tikeo-border text-left text-sm">
          <thead class="bg-tikeo-surface-alt text-xs uppercase text-tikeo-gray-text">
            <tr>
              <th class="px-3 py-2">{{ t('adminTickets.colTicket') }}</th>
              <th class="px-3 py-2">{{ t('adminTickets.colEvent') }}</th>
              <th class="px-3 py-2">{{ t('adminTickets.colType') }}</th>
              <th class="px-3 py-2">{{ t('adminTickets.colBuyer') }}</th>
              <th class="px-3 py-2">{{ t('adminTickets.colPrice') }}</th>
              <th class="px-3 py-2">{{ t('adminTickets.colStatus') }}</th>
              <th class="px-3 py-2">{{ t('adminTickets.colDate') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-tikeo-border">
            <tr v-for="tk in filtered" :key="tk.id">
              <td class="whitespace-nowrap px-3 py-2 font-mono text-xs text-tikeo-black">{{ tk.ticket_number }}</td>
              <td class="px-3 py-2 font-medium text-tikeo-black">{{ tk.event?.title || '—' }}</td>
              <td class="px-3 py-2 text-tikeo-gray-text">{{ tk.ticket_type?.name || '—' }}</td>
              <td class="px-3 py-2 text-tikeo-gray-text">{{ buyerNames[tk.user_id] || '—' }}</td>
              <td class="px-3 py-2 text-tikeo-gray-text">{{ (tk.ticket_type?.price ?? 0).toLocaleString('fr-FR') }} FCFA</td>
              <td class="px-3 py-2 font-medium" :class="statusBadgeClass[tk.status]">{{ statusLabels[tk.status] }}</td>
              <td class="whitespace-nowrap px-3 py-2 text-tikeo-gray-text">{{ new Date(tk.created_at).toLocaleDateString('fr-FR') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
