<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', adminPermission: 'events.view' })
import type { EventRecord } from '~/types/database'

const { t } = useI18n()
const supabase = useSupabase()
const authStore = useAuthStore()
const loading = ref(true)
const events = ref<EventRecord[]>([])
const errorMessage = ref('')
const togglingId = ref<string | null>(null)
const search = ref('')
const statusFilter = ref<'all' | EventRecord['status']>('all')
const pendingCancel = ref<EventRecord | null>(null)

const canModerate = computed(() => authStore.isSuperAdmin || authStore.hasPermission('events.update') || authStore.hasPermission('events.validate'))

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

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return events.value.filter((e) => {
    if (statusFilter.value !== 'all' && e.status !== statusFilter.value) return false
    if (!q) return true
    return [e.title, e.city, e.location_name].some((v) => (v || '').toString().toLowerCase().includes(q))
  })
})

const filterChips = computed(() => [
  { value: 'all', label: t('adminCommon.all'), count: events.value.length },
  ...(['published', 'draft', 'paused', 'cancelled'] as const).map((s) => ({
    value: s,
    label: statusLabels.value[s],
    count: events.value.filter((e) => e.status === s).length,
  })),
])

function statusTone(status: string) {
  if (status === 'published') return 'success'
  if (status === 'paused' || status === 'sold_out') return 'warning'
  if (status === 'cancelled') return 'error'
  if (status === 'completed') return 'info'
  return 'neutral'
}

async function setStatus(event: EventRecord, status: EventRecord['status']) {
  togglingId.value = event.id
  errorMessage.value = ''
  try {
    const previous = event.status
    const { error } = await supabase.from('events').update({ status }).eq('id', event.id)
    if (error) throw error
    event.status = status
    // Journal d'activité : chaque changement de statut est tracé.
    await writeAuditLog({
      action: status === 'published' ? 'EVENT_PUBLISHED' : status === 'paused' ? 'EVENT_SUSPENDED' : status === 'cancelled' ? 'EVENT_CANCELLED' : 'EVENT_STATUS_CHANGED',
      entityType: 'events',
      entityId: event.id,
      metadata: { title: event.title, from: previous, to: status },
    })
  } catch (e: any) {
    errorMessage.value = e?.message || t('adminEvents.errorLoad')
  } finally {
    togglingId.value = null
  }
}

async function confirmCancel() {
  if (!pendingCancel.value) return
  const target = pendingCancel.value
  pendingCancel.value = null
  await setStatus(target, 'cancelled')
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-8 md:px-6">
    <h1 class="mb-6 text-xl font-bold text-tikeo-black">{{ t('adminEvents.title') }}</h1>

    <p v-if="errorMessage" class="acc-alert-error mb-4">{{ errorMessage }}</p>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 4" :key="i" class="h-16 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>

    <AdminEmpty v-else-if="events.length === 0" icon="calendar" :text="t('adminEvents.empty')" />

    <template v-else>
      <!-- Recherche + filtres par statut -->
      <div class="admin-toolbar">
        <AdminSearch v-model="search" :placeholder="t('adminEvents.search')" />
        <div class="flex flex-wrap gap-2">
          <button v-for="c in filterChips" :key="c.value" type="button" class="admin-chip" :class="statusFilter === c.value ? 'is-active' : ''" @click="statusFilter = c.value as any">
            {{ c.label }} <span class="opacity-60">{{ c.count }}</span>
          </button>
        </div>
      </div>

      <AdminEmpty v-if="filtered.length === 0" icon="search" :text="t('adminCommon.noResults')" />

      <template v-else>
        <!-- Cartes empilées (mobile) -->
        <div class="flex flex-col gap-3 md:hidden">
          <div v-for="event in filtered" :key="event.id" class="org-panel p-3">
            <div class="flex items-start justify-between gap-2">
              <p class="min-w-0 flex-1 truncate font-semibold text-tikeo-black">{{ event.title }}</p>
              <StatusPill :tone="statusTone(event.status)">{{ statusLabels[event.status] }}</StatusPill>
            </div>
            <p class="mt-1 flex items-center gap-3 text-xs text-tikeo-gray-text">
              <span class="inline-flex items-center gap-1"><AppIcon name="pin" class="h-3.5 w-3.5" />{{ event.city || '—' }}</span>
              <span class="inline-flex items-center gap-1"><AppIcon name="calendar" class="h-3.5 w-3.5" />{{ new Date(event.start_date).toLocaleDateString('fr-FR') }}</span>
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <OrgIconButton icon="chart" :label="t('ticketStats.button')" :to="`/admin/evenements/${event.id}/statistiques`" />
              <OrgIconButton v-if="event.status === 'published'" icon="external" :label="t('adminEvents.view')" :to="`/e/${event.slug}`" />
              <OrgIconButton v-if="event.status !== 'published' && event.status !== 'cancelled' && canModerate" icon="play" :label="t('adminEvents.publish')" :loading="togglingId === event.id" @click="setStatus(event, 'published')" />
              <OrgIconButton v-if="event.status === 'published' && canModerate" icon="pause" :label="t('adminEvents.suspend')" :loading="togglingId === event.id" @click="setStatus(event, 'paused')" />
              <OrgIconButton v-if="event.status !== 'cancelled' && canModerate" icon="ban" danger :label="t('adminEvents.cancel')" :disabled="togglingId === event.id" @click="pendingCancel = event" />
            </div>
          </div>
        </div>

        <!-- Tableau (md et plus) -->
        <div class="hidden overflow-x-auto md:block">
          <table class="w-full border border-tikeo-border text-left text-sm">
            <thead class="bg-tikeo-surface-alt text-tikeo-gray-text">
              <tr>
                <th class="px-3 py-3">{{ t('adminEvents.colEvent') }}</th>
                <th class="px-3 py-3">{{ t('adminEvents.colCity') }}</th>
                <th class="px-3 py-3">{{ t('adminEvents.colDate') }}</th>
                <th class="px-3 py-3">{{ t('adminEvents.colStatus') }}</th>
                <th class="px-3 py-3 text-right">{{ t('adminEvents.colActions') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-tikeo-border">
              <tr v-for="event in filtered" :key="event.id">
                <td class="px-3 py-3 font-semibold text-tikeo-black">{{ event.title }}</td>
                <td class="px-3 py-3 text-tikeo-gray-text">{{ event.city || '—' }}</td>
                <td class="px-3 py-3 text-tikeo-gray-text">{{ new Date(event.start_date).toLocaleDateString('fr-FR') }}</td>
                <td class="px-3 py-3"><StatusPill :tone="statusTone(event.status)">{{ statusLabels[event.status] }}</StatusPill></td>
                <td class="px-3 py-3">
                  <div class="flex justify-end gap-1.5">
                    <OrgIconButton icon="chart" :label="t('ticketStats.button')" :to="`/admin/evenements/${event.id}/statistiques`" />
                    <OrgIconButton v-if="event.status === 'published'" icon="external" :label="t('adminEvents.view')" :to="`/e/${event.slug}`" />
                    <OrgIconButton v-if="event.status !== 'published' && event.status !== 'cancelled' && canModerate" icon="play" :label="t('adminEvents.publish')" :loading="togglingId === event.id" @click="setStatus(event, 'published')" />
                    <OrgIconButton v-if="event.status === 'published' && canModerate" icon="pause" :label="t('adminEvents.suspend')" :loading="togglingId === event.id" @click="setStatus(event, 'paused')" />
                    <OrgIconButton v-if="event.status !== 'cancelled' && canModerate" icon="ban" danger :label="t('adminEvents.cancel')" :disabled="togglingId === event.id" @click="pendingCancel = event" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>

    <ConfirmDeleteModal
      :open="!!pendingCancel"
      :title="t('adminEvents.confirmCancelTitle')"
      :message="t('adminEvents.confirmCancelMessage', { name: pendingCancel?.title || '' })"
      :confirm-label="t('adminEvents.cancel')"
      @confirm="confirmCancel"
      @cancel="pendingCancel = null"
    />
  </div>
</template>
