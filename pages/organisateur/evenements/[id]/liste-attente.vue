<script setup lang="ts">
definePageMeta({ layout: 'organisateur', middleware: 'organizer' })

/**
 * Liste d'attente d'un événement : qui attend, combien de billets ils
 * veulent, et un bouton pour les prévenir d'un coup par email quand des
 * places se libèrent (voir server/api/events/[id]/notify-waitlist.post.ts).
 */
interface WaitlistEntry {
  id: string
  email: string
  quantity_wanted: number
  status: 'waiting' | 'notified'
  notified_at: string | null
  notified_count: number
  created_at: string
}

const { t } = useI18n()
const route = useRoute()
const eventId = route.params.id as string
const supabase = useSupabase()
const { csrfHeader } = useCsrf()

const eventTitle = ref('')
const entries = ref<WaitlistEntry[]>([])
const loading = ref(true)
const errorMsg = ref('')
const notifying = ref(false)
const notifyResult = ref<number | null>(null)

const totalWanted = computed(() => entries.value.reduce((s, e) => s + e.quantity_wanted, 0))

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [{ data: ev }, { data: list, error }] = await Promise.all([
      supabase.from('events').select('title').eq('id', eventId).maybeSingle(),
      supabase.from('waitlist_entries').select('*').eq('event_id', eventId).order('created_at', { ascending: true }),
    ])
    if (error) throw error
    eventTitle.value = ev?.title || ''
    entries.value = (list as unknown as WaitlistEntry[]) ?? []
  } catch (e: any) {
    errorMsg.value = e?.message || t('waitlistAdmin.loadError')
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function notifyAll() {
  if (notifying.value || !entries.value.length) return
  notifying.value = true
  errorMsg.value = ''
  notifyResult.value = null
  try {
    const res = await $fetch<{ notified: number }>(`/api/events/${eventId}/notify-waitlist`, {
      method: 'POST',
      headers: await csrfHeader(),
    })
    notifyResult.value = res.notified
    await load()
  } catch (e: any) {
    errorMsg.value = e?.data?.statusMessage || t('waitlistAdmin.notifyError')
  } finally {
    notifying.value = false
  }
}

const fmtDate = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-8 md:px-6">
    <NuxtLink to="/organisateur/evenements" class="text-xs font-semibold text-tikeo-orange">← {{ t('ticketStats.backToEvents') }}</NuxtLink>
    <div class="mb-6 mt-2 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-tikeo-black">{{ t('waitlistAdmin.title') }}</h1>
        <p v-if="eventTitle" class="mt-1 text-sm text-tikeo-gray-text">{{ eventTitle }}</p>
      </div>
      <button type="button" class="btn-primary !py-2 text-xs" :disabled="notifying || !entries.length" @click="notifyAll">
        {{ notifying ? t('waitlistAdmin.notifying') : t('waitlistAdmin.notifyButton') }}
      </button>
    </div>

    <p v-if="errorMsg" class="mb-4 border border-tikeo-error/30 bg-tikeo-error/10 px-3 py-2 text-xs text-tikeo-error">{{ errorMsg }}</p>
    <p v-if="notifyResult !== null" class="mb-4 border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-700">
      {{ t('waitlistAdmin.notifySuccess', { n: notifyResult }) }}
    </p>

    <div v-if="!loading" class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div class="border border-tikeo-border bg-tikeo-surface p-3">
        <p class="text-xs text-tikeo-gray-text">{{ t('waitlistAdmin.peopleCount') }}</p>
        <p class="mt-1 text-xl font-bold text-tikeo-black">{{ entries.length }}</p>
      </div>
      <div class="border border-tikeo-border bg-tikeo-surface p-3">
        <p class="text-xs text-tikeo-gray-text">{{ t('waitlistAdmin.ticketsWanted') }}</p>
        <p class="mt-1 text-xl font-bold text-tikeo-black">{{ totalWanted }}</p>
      </div>
    </div>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 4" :key="i" class="h-12 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>
    <p v-else-if="!entries.length" class="border border-tikeo-border bg-tikeo-surface p-6 text-center text-sm text-tikeo-gray-text">{{ t('waitlistAdmin.empty') }}</p>
    <ul v-else class="divide-y divide-tikeo-border border border-tikeo-border bg-tikeo-surface">
      <li v-for="e in entries" :key="e.id" class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
        <div class="min-w-0">
          <p class="truncate font-medium text-tikeo-black">{{ e.email }}</p>
          <p class="text-xs text-tikeo-gray-text">{{ t('waitlistAdmin.wants', { n: e.quantity_wanted }) }} · {{ fmtDate(e.created_at) }}</p>
        </div>
        <span v-if="e.status === 'notified'" class="shrink-0 bg-tikeo-blue/10 px-2 py-0.5 text-[10px] font-bold uppercase text-tikeo-blue">
          {{ t('waitlistAdmin.notifiedBadge', { n: e.notified_count }) }}
        </span>
        <span v-else class="shrink-0 bg-tikeo-gray-text/10 px-2 py-0.5 text-[10px] font-bold uppercase text-tikeo-gray-text">{{ t('waitlistAdmin.waitingBadge') }}</span>
      </li>
    </ul>
  </div>
</template>
