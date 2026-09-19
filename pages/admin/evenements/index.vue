<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
import type { EventRecord } from '~/types/database'

const { t } = useI18n()
const supabase = useSupabase()
const loading = ref(true)
const events = ref<EventRecord[]>([])
const errorMessage = ref('')

const statusLabels = computed<Record<string, string>>(() => ({
  draft: t('eventStatus.draft'),
  published: t('eventStatus.published'),
  paused: t('eventStatus.paused'),
  sold_out: t('eventStatus.soldOut'),
  completed: t('eventStatus.completed'),
  cancelled: t('eventStatus.cancelled'),
}))

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: false })
    if (error) throw error
    events.value = (data as unknown as EventRecord[]) ?? []
  } catch (e: any) {
    errorMessage.value = e?.message || t('adminEvents.errorLoad')
  } finally {
    loading.value = false
  }
}

async function setStatus(event: EventRecord, status: EventRecord['status']) {
  const { error } = await supabase.from('events').update({ status }).eq('id', event.id)
  if (!error) event.status = status
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-8 md:px-6">
    <h1 class="mb-6 text-xl font-bold text-tikeo-black">{{ t('adminEvents.title') }}</h1>

    <p v-if="errorMessage" class="mb-4 border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{{ errorMessage }}</p>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 4" :key="i" class="h-14 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>

    <div v-else-if="events.length === 0" class="border border-dashed border-tikeo-border p-10 text-center text-sm text-tikeo-gray-text">
      {{ t('adminEvents.empty') }}
    </div>

    <table v-else class="w-full border border-tikeo-border text-left text-sm">
      <thead class="bg-tikeo-surface-alt text-xs uppercase text-tikeo-gray-text">
        <tr>
          <th class="px-3 py-2">{{ t('adminEvents.colEvent') }}</th>
          <th class="px-3 py-2">{{ t('adminEvents.colCity') }}</th>
          <th class="px-3 py-2">{{ t('adminEvents.colDate') }}</th>
          <th class="px-3 py-2">{{ t('adminEvents.colStatus') }}</th>
          <th class="px-3 py-2">{{ t('adminEvents.colActions') }}</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-tikeo-border">
        <tr v-for="event in events" :key="event.id">
          <td class="px-3 py-2 font-medium text-tikeo-black">{{ event.title }}</td>
          <td class="px-3 py-2 text-tikeo-gray-text">{{ event.city || '—' }}</td>
          <td class="px-3 py-2 text-tikeo-gray-text">{{ new Date(event.start_date).toLocaleDateString('fr-FR') }}</td>
          <td class="px-3 py-2">{{ statusLabels[event.status] }}</td>
          <td class="px-3 py-2">
            <div class="flex gap-2">
              <button
                v-if="event.status !== 'published'"
                type="button"
                class="border border-tikeo-border px-2 py-1 text-xs hover:border-tikeo-success hover:text-tikeo-success"
                @click="setStatus(event, 'published')"
              >
                {{ t('adminEvents.publish') }}
              </button>
              <button
                v-if="event.status === 'published'"
                type="button"
                class="border border-tikeo-border px-2 py-1 text-xs hover:border-yellow-500 hover:text-yellow-600"
                @click="setStatus(event, 'paused')"
              >
                {{ t('adminEvents.suspend') }}
              </button>
              <button
                type="button"
                class="border border-tikeo-border px-2 py-1 text-xs hover:border-tikeo-error hover:text-tikeo-error"
                @click="setStatus(event, 'cancelled')"
              >
                {{ t('adminEvents.cancel') }}
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
