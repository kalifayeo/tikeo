<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
import type { EventEditRequest } from '~/types/database'

const { t } = useI18n()
const { user } = useAuth()
const { fetchAllRequests, approveRequest, rejectRequest } = useEventEditRequests()

const loading = ref(true)
const requests = ref<EventEditRequest[]>([])
const errorMessage = ref('')
const processingId = ref<string | null>(null)
const noteDrafts = reactive<Record<string, string>>({})
const filter = ref<'pending' | 'all'>('pending')

const fieldLabels = computed<Record<string, string>>(() => ({
  title: t('adminEditRequests.fieldTitle'),
  description: t('adminEditRequests.fieldDescription'),
  cover_image: t('adminEditRequests.fieldCoverImage'),
  seating_plan_url: t('adminEditRequests.fieldSeatingPlan'),
  category_id: t('adminEditRequests.fieldCategory'),
  start_date: t('adminEditRequests.fieldStartDate'),
  end_date: t('adminEditRequests.fieldEndDate'),
  location_name: t('adminEditRequests.fieldLocation'),
  address: t('adminEditRequests.fieldAddress'),
  city: t('adminEditRequests.fieldCity'),
  country: t('adminEditRequests.fieldCountry'),
}))

const visibleRequests = computed(() => (filter.value === 'pending' ? requests.value.filter((r) => r.status === 'pending') : requests.value))

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    requests.value = await fetchAllRequests()
  } catch (e: any) {
    errorMessage.value = e?.message || t('adminEditRequests.errorLoad')
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function handleApprove(request: EventEditRequest) {
  if (!user.value) return
  processingId.value = request.id
  errorMessage.value = ''
  try {
    await approveRequest(request, user.value.id, noteDrafts[request.id])
    await load()
  } catch (e: any) {
    errorMessage.value = e?.message || t('adminEditRequests.errorApprove')
  } finally {
    processingId.value = null
  }
}

async function handleReject(request: EventEditRequest) {
  if (!user.value) return
  const note = noteDrafts[request.id]
  if (!note) {
    errorMessage.value = t('adminEditRequests.errorNoteRequired')
    return
  }
  processingId.value = request.id
  errorMessage.value = ''
  try {
    await rejectRequest(request, user.value.id, note)
    await load()
  } catch (e: any) {
    errorMessage.value = e?.message || t('adminEditRequests.errorReject')
  } finally {
    processingId.value = null
  }
}

const statusLabels = computed<Record<string, string>>(() => ({
  pending: t('adminEditRequests.statusPending'),
  approved: t('adminEditRequests.statusApproved'),
  rejected: t('adminEditRequests.statusRejected'),
  cancelled: t('adminEditRequests.statusCancelled'),
}))
const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600',
  approved: 'bg-tikeo-success/10 text-tikeo-success',
  rejected: 'bg-tikeo-error/10 text-tikeo-error',
  cancelled: 'bg-tikeo-gray-light text-tikeo-gray-text',
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8 md:px-6">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-bold text-tikeo-black">{{ t('adminEditRequests.title') }}</h1>
      <div class="flex gap-2 text-xs font-semibold">
        <button type="button" class="border border-tikeo-border px-2.5 py-1" :class="filter === 'pending' ? 'border-tikeo-orange text-tikeo-orange' : 'text-tikeo-gray-text'" @click="filter = 'pending'">{{ t('adminEditRequests.filterPending') }}</button>
        <button type="button" class="border border-tikeo-border px-2.5 py-1" :class="filter === 'all' ? 'border-tikeo-orange text-tikeo-orange' : 'text-tikeo-gray-text'" @click="filter = 'all'">{{ t('adminEditRequests.filterAll') }}</button>
      </div>
    </div>

    <p v-if="errorMessage" class="mb-4 border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{{ errorMessage }}</p>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 3" :key="i" class="h-24 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>
    <div v-else-if="visibleRequests.length === 0" class="border border-dashed border-tikeo-border p-10 text-center text-sm text-tikeo-gray-text">
      {{ filter === 'pending' ? t('adminEditRequests.emptyPending') : t('adminEditRequests.emptyAll') }}
    </div>

    <div v-else class="flex flex-col gap-4">
      <div v-for="request in visibleRequests" :key="request.id" class="border border-tikeo-border p-4">
        <div class="mb-3 flex items-center justify-between">
          <div>
            <p class="font-semibold text-tikeo-black">{{ request.event?.title || t('adminEditRequests.deletedEvent') }}</p>
            <p class="text-xs text-tikeo-gray-text">
              {{ t('adminEditRequests.byOrganizer', { name: request.organizer?.name || t('adminEditRequests.noOrganizer') }) }} · {{ new Date(request.created_at).toLocaleString('fr-FR') }}
            </p>
          </div>
          <span class="px-2 py-1 text-xs font-semibold" :class="statusColors[request.status]">{{ statusLabels[request.status] }}</span>
        </div>

        <!-- Diff des champs de l'événement -->
        <table v-if="request.changes.event && Object.keys(request.changes.event).length" class="mb-3 w-full border border-tikeo-border text-left text-xs">
          <thead class="bg-tikeo-surface-alt uppercase text-tikeo-gray-text">
            <tr><th class="px-2 py-1">{{ t('adminEditRequests.colField') }}</th><th class="px-2 py-1">{{ t('adminEditRequests.colBefore') }}</th><th class="px-2 py-1">{{ t('adminEditRequests.colAfter') }}</th></tr>
          </thead>
          <tbody class="divide-y divide-tikeo-border">
            <tr v-for="(value, key) in request.changes.event" :key="key">
              <td class="px-2 py-1 font-semibold text-tikeo-black">{{ fieldLabels[key] || key }}</td>
              <td class="px-2 py-1 text-tikeo-gray-text">{{ (request.previous_snapshot.event as any)?.[key] ?? '—' }}</td>
              <td class="px-2 py-1 text-tikeo-black">{{ value ?? '—' }}</td>
            </tr>
          </tbody>
        </table>

        <!-- Diff des types de billets -->
        <table v-if="request.changes.ticket_types?.length" class="mb-3 w-full border border-tikeo-border text-left text-xs">
          <thead class="bg-tikeo-surface-alt uppercase text-tikeo-gray-text">
            <tr><th class="px-2 py-1">{{ t('adminEditRequests.colTicketName') }}</th><th class="px-2 py-1">{{ t('adminEditRequests.colTicketPrice') }}</th><th class="px-2 py-1">{{ t('adminEditRequests.colTicketQuantity') }}</th></tr>
          </thead>
          <tbody class="divide-y divide-tikeo-border">
            <tr v-for="ticket in request.changes.ticket_types" :key="ticket.id">
              <td class="px-2 py-1 font-semibold text-tikeo-black">{{ ticket.name }}</td>
              <td class="px-2 py-1">{{ ticket.price.toLocaleString('fr-FR') }} FCFA</td>
              <td class="px-2 py-1">{{ ticket.quantity }}</td>
            </tr>
          </tbody>
        </table>

        <p v-if="request.organizer_note" class="mb-3 text-xs italic text-tikeo-gray-text">{{ t('adminEditRequests.organizerNote', { note: request.organizer_note }) }}</p>
        <p v-if="request.admin_note" class="mb-3 text-xs italic text-tikeo-gray-text">{{ t('adminEditRequests.adminNote', { note: request.admin_note }) }}</p>

        <div v-if="request.status === 'pending'" class="flex flex-wrap items-center gap-2">
          <input v-model="noteDrafts[request.id]" type="text" :placeholder="t('adminEditRequests.notePlaceholder')" class="input-field flex-1 text-xs" />
          <button type="button" class="border border-tikeo-border px-3 py-1.5 text-xs font-semibold hover:border-tikeo-success hover:text-tikeo-success" :disabled="processingId === request.id" @click="handleApprove(request)">
            {{ t('adminEditRequests.approve') }}
          </button>
          <button type="button" class="border border-tikeo-border px-3 py-1.5 text-xs font-semibold hover:border-tikeo-error hover:text-tikeo-error" :disabled="processingId === request.id" @click="handleReject(request)">
            {{ t('adminEditRequests.reject') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
