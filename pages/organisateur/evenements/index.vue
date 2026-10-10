<script setup lang="ts">
definePageMeta({ layout: 'organisateur', middleware: 'organizer' })
import type { EventRecord } from '~/types/database'

const { t, locale } = useI18n()
const supabase = useSupabase()
const router = useRouter()
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
  draft: 'bg-tikeo-surface-alt text-tikeo-gray-text',
  published: 'bg-tikeo-success/10 text-tikeo-success is-live',
  paused: 'bg-yellow-500/10 text-yellow-600',
  sold_out: 'bg-tikeo-blue/10 text-tikeo-blue',
  completed: 'bg-tikeo-surface-alt text-tikeo-gray-text',
  cancelled: 'bg-tikeo-error/10 text-tikeo-error',
}

function dayOf(date: string) {
  return new Date(date).toLocaleDateString(locale.value, { day: '2-digit' })
}
function monthOf(date: string) {
  return new Date(date).toLocaleDateString(locale.value, { month: 'short' }).replace('.', '')
}

const pendingRequestEventIds = ref<Set<string>>(new Set())

// ── À venir / Passés ────────────────────────────────────────────────────────
// Un événement terminé disparaît des listes publiques (accueil, recherche…) ;
// l'organisateur, lui, le retrouve ici dans l'onglet « Passés » pour consulter
// ses statistiques, ses revenus ou le dupliquer. `now` avance toutes les minutes
// pour que le basculement se fasse tout seul, sans recharger la page.
type EventsTab = 'upcoming' | 'past' | 'all'
const tab = ref<EventsTab>('upcoming')
const search = ref('')
const now = ref(Date.now())
let nowTimer: ReturnType<typeof setInterval> | undefined

function isPast(event: EventRecord) {
  return isEventPast(event.start_date, event.end_date, now.value)
}
const upcomingEvents = computed(() =>
  events.value.filter((e) => !isPast(e)).sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
)
const pastEvents = computed(() =>
  events.value.filter((e) => isPast(e)).sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
)
const visibleEvents = computed(() => {
  const base = tab.value === 'upcoming' ? upcomingEvents.value : tab.value === 'past' ? pastEvents.value : [...upcomingEvents.value, ...pastEvents.value]
  const q = search.value.trim().toLowerCase()
  if (!q) return base
  return base.filter((e) => `${e.title} ${e.city ?? ''} ${e.location_name ?? ''}`.toLowerCase().includes(q))
})
const tabs = computed<{ value: EventsTab; label: string; count: number }[]>(() => [
  { value: 'upcoming', label: t('organizerEvents.tabUpcoming'), count: upcomingEvents.value.length },
  { value: 'past', label: t('organizerEvents.tabPast'), count: pastEvents.value.length },
  { value: 'all', label: t('organizerEvents.tabAll'), count: events.value.length },
])
const emptyTabMessage = computed(() => {
  if (search.value.trim()) return t('organizerEvents.noResults')
  return tab.value === 'past' ? t('organizerEvents.emptyPast') : t('organizerEvents.emptyUpcoming')
})

function formatEventDate(date: string) {
  return new Date(date).toLocaleDateString(locale.value, { day: '2-digit', month: 'long', year: 'numeric' })
}

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

// Dupliquer un événement : crée un BROUILLON (rien n'est publié) avec les mêmes
// informations et types de billets, stock remis à zéro. Idéal pour un événement récurrent.
const duplicatingId = ref<string | null>(null)
function slugifyCopy(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}
async function duplicateEvent(event: EventRecord) {
  if (duplicatingId.value) return
  duplicatingId.value = event.id
  errorMessage.value = ''
  try {
    const slug = `${slugifyCopy(event.slug || event.title).slice(0, 60)}-copie-${Math.random().toString(36).slice(2, 6)}`
    const { data: copy, error: copyErr } = await supabase
      .from('events')
      .insert({
        organizer_id: event.organizer_id,
        title: `${event.title} (${t('organizerEvents.copySuffix')})`,
        slug,
        description: event.description,
        cover_image: event.cover_image,
        seating_plan_url: event.seating_plan_url,
        category_id: event.category_id,
        start_date: event.start_date,
        end_date: event.end_date,
        location_name: event.location_name,
        address: event.address,
        city: event.city,
        country: event.country,
        max_tickets_per_buyer: event.max_tickets_per_buyer,
        status: 'draft',
      })
      .select('id')
      .single()
    if (copyErr) throw copyErr

    const { data: types } = await supabase.from('ticket_types').select('name, description, price, quantity').eq('event_id', event.id)
    if (types?.length) {
      const { error: ttErr } = await supabase.from('ticket_types').insert(types.map((tt: any) => ({ ...tt, event_id: copy.id })))
      if (ttErr) throw ttErr
    }
    await router.push(`/organisateur/evenements/${copy.id}/modifier`)
  } catch (e: any) {
    errorMessage.value = e?.message || t('organizerEvents.duplicateError')
  } finally {
    duplicatingId.value = null
  }
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
    if (upcomingEvents.value.length === 0 && pastEvents.value.length > 0) tab.value = 'past'

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

// Suppression : réservée aux brouillons (c'est la règle côté base de données,
// « Organisateur supprime ses événements brouillons »). Les événements publiés
// ou déjà vendus se mettent en pause à la place.
const deleteTarget = ref<EventRecord | null>(null)
const deleting = ref(false)
const deleteError = ref('')
function askDelete(event: EventRecord) {
  deleteError.value = ''
  deleteTarget.value = event
}
async function confirmDelete() {
  const event = deleteTarget.value
  if (!event || deleting.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    const { error } = await supabase.from('events').delete().eq('id', event.id).eq('status', 'draft')
    if (error) throw error
    events.value = events.value.filter((e) => e.id !== event.id)
    deleteTarget.value = null
  } catch (e: any) {
    deleteError.value = e?.message || t('organizerEvents.deleteError')
  } finally {
    deleting.value = false
  }
}

async function toggleStatus(event: EventRecord) {
  if (isPast(event)) return
  const next = event.status === 'published' ? 'paused' : 'published'
  const { error } = await supabase.from('events').update({ status: next }).eq('id', event.id)
  if (!error) event.status = next
}

onMounted(() => {
  load()
  nowTimer = setInterval(() => {
    now.value = Date.now()
  }, 60_000)
})
onBeforeUnmount(() => {
  if (nowTimer) clearInterval(nowTimer)
})
</script>

<template>
  <div>
    <OrgPageHeader
      :eyebrow="t('organizerNav.fallbackTitle')"
      :title="t('organizerEvents.title')"
      icon="calendar"
    >
      <template #actions>
        <NuxtLink to="/organisateur/evenements/nouveau" class="btn-brand group max-sm:w-full">
          <AppIcon name="plus" class="h-[18px] w-[18px] transition-transform duration-300 group-hover:rotate-90" :stroke="2.4" />
          {{ t('organizerDashboard.quickCreate') }}
        </NuxtLink>
      </template>
    </OrgPageHeader>

    <div class="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
      <p v-if="errorMessage" class="acc-alert-error mb-5">{{ errorMessage }}</p>

      <div v-if="loading" class="space-y-3">
        <div class="org-skeleton h-11 max-w-md" />
        <div v-for="i in 4" :key="i" class="org-skeleton h-28" />
      </div>

      <template v-else-if="events.length > 0">
        <!-- Onglets + recherche -->
        <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="tablist" class="no-scrollbar flex gap-2 overflow-x-auto">
            <button
              v-for="item in tabs"
              :key="item.value"
              type="button"
              role="tab"
              :aria-selected="tab === item.value"
              class="flex h-11 shrink-0 items-center gap-2 border px-4 text-sm font-semibold transition-colors duration-200"
              :class="tab === item.value
                ? 'border-tikeo-ink bg-tikeo-ink text-white dark:border-[#FF7A00] dark:bg-[#FF7A00] dark:text-tikeo-ink'
                : 'border-tikeo-border bg-tikeo-surface text-tikeo-black hover:border-tikeo-ink dark:hover:border-[#FF7A00]'"
              @click="tab = item.value"
            >
              {{ item.label }}
              <span class="flex h-5 min-w-5 items-center justify-center px-1.5 text-[11px] font-bold" :class="tab === item.value ? 'bg-[#FF7A00] text-tikeo-ink' : 'bg-tikeo-surface-alt text-tikeo-gray-text'">{{ item.count }}</span>
            </button>
          </div>
          <div class="relative sm:w-72">
            <AppIcon name="search" class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-tikeo-gray-text" />
            <input
              v-model="search"
              type="search"
              maxlength="80"
              class="field-input !h-11 !pl-10 text-sm"
              :placeholder="t('organizerEvents.searchPlaceholder')"
              :aria-label="t('organizerEvents.searchPlaceholder')"
            />
          </div>
        </div>
        <Transition name="org-fade">
          <p v-if="tab === 'past'" class="acc-alert-info mb-4 flex items-start gap-2 !text-xs">
            <AppIcon name="info" class="mt-0.5 h-4 w-4 shrink-0" />{{ t('organizerEvents.pastNotice') }}
          </p>
        </Transition>
      </template>

      <div v-else class="acc-empty org-pop">
        <span class="flex h-16 w-16 items-center justify-center bg-tikeo-surface-alt text-tikeo-gray-text"><AppIcon name="calendar-plus" class="h-8 w-8" /></span>
        <p class="text-sm text-tikeo-gray-text">{{ t('organizerEvents.emptyState') }}</p>
        <NuxtLink to="/organisateur/evenements/nouveau" class="btn-ink">{{ t('organizerEvents.createFirst') }}</NuxtLink>
      </div>

      <div v-if="!loading && events.length > 0 && visibleEvents.length === 0" class="acc-empty org-pop">
        <span class="flex h-14 w-14 items-center justify-center bg-tikeo-surface-alt text-tikeo-gray-text"><AppIcon name="inbox" class="h-7 w-7" /></span>
        <p class="text-sm text-tikeo-gray-text">{{ emptyTabMessage }}</p>
      </div>

      <TransitionGroup v-else-if="!loading && events.length > 0" name="org-list" tag="ul" class="relative space-y-3">
        <li
          v-for="event in visibleEvents"
          :key="event.id"
          class="org-card-hover group flex flex-col border border-tikeo-border bg-tikeo-surface sm:flex-row"
          :class="isPast(event) ? 'bg-tikeo-surface-alt/60' : ''"
        >
          <!-- Affiche + talon de date -->
          <div class="relative flex shrink-0 sm:w-56">
            <div class="relative h-32 w-full overflow-hidden bg-tikeo-ink sm:h-auto sm:min-h-[8.5rem]">
              <img
                v-if="event.cover_image"
                :src="event.cover_image"
                :alt="event.title"
                loading="lazy"
                class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                :class="isPast(event) ? 'grayscale' : ''"
              />
              <div v-else class="flex h-full w-full items-center justify-center text-white/30"><AppIcon name="ticket" class="h-10 w-10" /></div>
              <div class="absolute inset-0 bg-gradient-to-t from-tikeo-ink/70 via-transparent to-transparent" aria-hidden="true" />
              <div class="absolute left-3 top-3 flex flex-col items-center bg-white px-2.5 py-1.5 text-tikeo-ink shadow-card">
                <span class="font-display text-xl font-extrabold leading-none">{{ dayOf(event.start_date) }}</span>
                <span class="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[#B05400]">{{ monthOf(event.start_date) }}</span>
              </div>
            </div>
          </div>

          <div class="flex min-w-0 flex-1 flex-col justify-between gap-4 p-4 md:p-5">
            <div class="min-w-0">
              <div class="mb-2 flex flex-wrap items-center gap-1.5">
                <span class="org-status" :class="statusColors[event.status]">{{ statusLabels[event.status] }}</span>
                <span v-if="isPast(event)" class="org-status bg-tikeo-surface-alt text-tikeo-gray-text" :title="t('organizerEvents.pastBadgeTitle')">{{ t('organizerEvents.pastBadge') }}</span>
                <span v-if="pendingRequestEventIds.has(event.id)" class="org-status bg-[#FF7A00]/10 text-tikeo-orange" :title="t('organizerEvents.pendingBadgeTitle')">{{ t('organizerEvents.pendingBadge') }}</span>
              </div>
              <h3 class="truncate font-display text-lg font-extrabold leading-tight text-tikeo-black md:text-xl">{{ event.title }}</h3>
              <p class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-tikeo-gray-text md:text-sm">
                <span class="inline-flex items-center gap-1.5"><AppIcon name="calendar" class="h-4 w-4" />{{ formatEventDate(event.start_date) }}</span>
                <span v-if="event.city" class="inline-flex items-center gap-1.5"><AppIcon name="pin" class="h-4 w-4" />{{ event.city }}</span>
              </p>
            </div>

            <!-- Actions : uniquement des icônes, avec infobulle -->
            <div class="flex flex-wrap items-center gap-2 border-t border-dashed border-tikeo-border pt-3.5">
              <OrgIconButton
                v-if="!isPast(event) && (event.status === 'published' || event.status === 'paused')"
                :icon="event.status === 'published' ? 'pause' : 'play'"
                :label="event.status === 'published' ? t('organizerEvents.pauseButton') : t('organizerEvents.republishButton')"
                @click="toggleStatus(event)"
              />
              <OrgIconButton icon="edit" :label="t('organizerEvents.editButton')" :to="`/organisateur/evenements/${event.id}/modifier`" />
              <OrgIconButton icon="duplicate" :label="t('organizerEvents.duplicateButton')" :loading="duplicatingId === event.id" @click="duplicateEvent(event)" />
              <OrgIconButton icon="chart" :label="t('ticketStats.button')" :to="`/organisateur/evenements/${event.id}/statistiques`" />
              <OrgIconButton v-if="!isPast(event) && event.status !== 'draft'" icon="scan" :label="t('organizerNav.scanner')" :to="`/organisateur/evenements/scanner?event=${event.id}`" />
              <OrgIconButton icon="eye" :label="t('organizerEvents.viewButton')" :to="`/e/${event.slug}`" />
              <OrgIconButton icon="link" :label="copiedEventId === event.id ? t('organizerEvents.linkCopied') : t('organizerEvents.copyLinkButton')" :success="copiedEventId === event.id" @click="copyEventLink(event)" />
              <span class="flex-1" />
              <OrgIconButton v-if="event.status === 'draft'" icon="trash" danger :label="t('organizerEvents.deleteButton')" @click="askDelete(event)" />
            </div>
          </div>
        </li>
      </TransitionGroup>
    </div>

    <ConfirmDeleteModal
      :open="!!deleteTarget"
      :title="t('organizerEvents.deleteTitle')"
      :message="deleteTarget ? t('organizerEvents.deleteMessage', { title: deleteTarget.title }) : ''"
      :loading="deleting"
      :error-message="deleteError"
      @confirm="confirmDelete"
      @cancel="deleteTarget = null"
    />
  </div>
</template>
