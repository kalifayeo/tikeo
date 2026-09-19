<script setup lang="ts">
definePageMeta({ layout: 'organisateur', middleware: 'organizer' })
import type { EventRecord } from '~/types/database'

const { t } = useI18n()
const supabase = useSupabase()
const { ensureOrganizer } = useOrganizer()

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
const statusColors: Record<string, string> = {
  draft: 'bg-tikeo-gray-light text-tikeo-gray-text',
  published: 'bg-tikeo-success/10 text-tikeo-success',
  paused: 'bg-yellow-500/10 text-yellow-600',
  sold_out: 'bg-tikeo-blue/10 text-tikeo-blue',
  completed: 'bg-tikeo-gray-light text-tikeo-gray-text',
  cancelled: 'bg-tikeo-error/10 text-tikeo-error',
}

const pendingRequestEventIds = ref<Set<string>>(new Set())

// Copier le lien personnalisé de l'événement (cahier des charges §14-16/§35)
const { buildEventUrl } = useEventPublicUrl()
const copiedEventId = ref<string | null>(null)
async function copyEventLink(event: EventRecord) {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return
  const url = buildEventUrl({ slug: event.slug }).url
  await navigator.clipboard.writeText(url)
  copiedEventId.value = event.id
  setTimeout(() => {
    if (copiedEventId.value === event.id) copiedEventId.value = null
  }, 2000)
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const organizer = await ensureOrganizer()
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('organizer_id', organizer!.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    events.value = (data as unknown as EventRecord[]) ?? []

    const { data: pending } = await supabase
      .from('event_edit_requests')
      .select('event_id')
      .eq('organizer_id', organizer!.id)
      .eq('status', 'pending')
    pendingRequestEventIds.value = new Set((pending ?? []).map((p: any) => p.event_id))
  } catch (e: any) {
    errorMessage.value = e?.message || t('organizerEvents.loadError')
  } finally {
    loading.value = false
  }
}

async function toggleStatus(event: EventRecord) {
  const next = event.status === 'published' ? 'paused' : 'published'
  const { error } = await supabase.from('events').update({ status: next }).eq('id', event.id)
  if (!error) event.status = next
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8 md:px-6">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-bold text-tikeo-black">{{ t('organizerEvents.title') }}</h1>
      <NuxtLink to="/organisateur/evenements/nouveau" class="btn-primary">{{ t('organizerEvents.createButton') }}</NuxtLink>
    </div>

    <p v-if="errorMessage" class="mb-4 border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{{ errorMessage }}</p>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 3" :key="i" class="h-16 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>

    <div v-else-if="events.length === 0" class="border border-dashed border-tikeo-border p-10 text-center text-sm text-tikeo-gray-text">
      {{ t('organizerEvents.emptyState') }}
      <NuxtLink to="/organisateur/evenements/nouveau" class="font-semibold text-tikeo-orange">{{ t('organizerEvents.createFirst') }}</NuxtLink>
    </div>

    <div v-else class="divide-y divide-tikeo-border border border-tikeo-border">
      <div v-for="event in events" :key="event.id" class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <p class="truncate font-semibold text-tikeo-black">{{ event.title }}</p>
          <p class="text-xs text-tikeo-gray-text">
            {{ new Date(event.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) }}
            <span v-if="event.city"> · {{ event.city }}</span>
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2 sm:shrink-0">
          <span class="px-2 py-1 text-xs font-semibold" :class="statusColors[event.status]">{{ statusLabels[event.status] }}</span>
          <span
            v-if="pendingRequestEventIds.has(event.id)"
            class="bg-tikeo-orange/10 px-2 py-1 text-xs font-semibold text-tikeo-orange"
            :title="t('organizerEvents.pendingBadgeTitle')"
          >
            {{ t('organizerEvents.pendingBadge') }}
          </span>
          <button
            v-if="event.status === 'published' || event.status === 'paused'"
            type="button"
            class="border border-tikeo-border px-2.5 py-1.5 text-xs font-semibold hover:border-tikeo-orange hover:text-tikeo-orange"
            @click="toggleStatus(event)"
          >
            {{ event.status === 'published' ? t('organizerEvents.pauseButton') : t('organizerEvents.republishButton') }}
          </button>
          <NuxtLink :to="`/organisateur/evenements/${event.id}/modifier`" class="border border-tikeo-border px-2.5 py-1.5 text-xs font-semibold hover:border-tikeo-orange hover:text-tikeo-orange">
            {{ t('organizerEvents.editButton') }}
          </NuxtLink>
          <NuxtLink :to="`/e/${event.slug}`" class="border border-tikeo-border px-2.5 py-1.5 text-xs font-semibold hover:border-tikeo-orange hover:text-tikeo-orange">
            {{ t('organizerEvents.viewButton') }}
          </NuxtLink>
          <button
            type="button"
            class="relative border border-tikeo-border px-2.5 py-1.5 text-xs font-semibold hover:border-tikeo-orange hover:text-tikeo-orange"
            @click="copyEventLink(event)"
          >
            {{ t('organizerEvents.copyLinkButton') }}
            <span v-if="copiedEventId === event.id" class="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-tikeo-black px-2 py-1 text-[11px] font-medium text-tikeo-surface">{{ t('organizerEvents.linkCopied') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
