<script setup lang="ts">
definePageMeta({ layout: 'organisateur', middleware: 'organizer' })
import type { Category, EditableTicketTypeFields, EventEditRequest, EventRecord, TicketType } from '~/types/database'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const supabase = useSupabase()
const { user } = useAuth()
const { ensureOrganizer } = useOrganizer()
const { requiresApproval, fetchPendingRequestForEvent, submitEditRequest, cancelRequest } = useEventEditRequests()

const eventId = route.params.id as string

const loading = ref(true)
const submitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const categories = ref<Category[]>([])
const event = ref<EventRecord | null>(null)
const ticketTypes = ref<TicketType[]>([])
const pendingRequest = ref<EventEditRequest | null>(null)

const form = reactive({
  title: '',
  description: '',
  coverImage: '',
  seatingPlanUrl: '',
  categoryId: '',
  startDate: '',
  startTime: '',
  endDate: '',
  locationName: '',
  address: '',
  city: '',
  country: '',
})

const ticketDrafts = ref<EditableTicketTypeFields[]>([])

const needsApproval = computed(() => (event.value ? requiresApproval(event.value) : false))

function toDateInput(value: string | null) {
  return value ? value.slice(0, 10) : ''
}
function toTimeInput(value: string | null) {
  return value ? value.slice(11, 16) : ''
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const organizer = await ensureOrganizer()
    if (!organizer) throw new Error(t('eventWizard.organizerFetchError'))

    const [{ data: eventData, error: eventError }, { data: categoriesData }, { data: ticketData, error: ticketError }] = await Promise.all([
      supabase.from('events').select('*').eq('id', eventId).eq('organizer_id', organizer.id).single(),
      supabase.from('categories').select('*').eq('status', 'active').order('name'),
      supabase.from('ticket_types').select('*').eq('event_id', eventId).order('created_at'),
    ])

    if (eventError) throw eventError
    if (ticketError) throw ticketError
    if (!eventData) throw new Error(t('eventEditRequest.notOwnedError'))

    event.value = eventData as unknown as EventRecord
    categories.value = (categoriesData as unknown as Category[]) ?? []
    ticketTypes.value = (ticketData as unknown as TicketType[]) ?? []

    ticketDrafts.value = ticketTypes.value.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      price: Number(t.price),
      quantity: Number(t.quantity),
      sale_start: t.sale_start,
      sale_end: t.sale_end,
    }))

    Object.assign(form, {
      title: event.value.title,
      description: event.value.description || '',
      coverImage: event.value.cover_image || '',
      seatingPlanUrl: event.value.seating_plan_url || '',
      categoryId: event.value.category_id || '',
      startDate: toDateInput(event.value.start_date),
      startTime: toTimeInput(event.value.start_date),
      endDate: toDateInput(event.value.end_date),
      locationName: event.value.location_name || '',
      address: event.value.address || '',
      city: event.value.city || '',
      country: event.value.country || '',
    })

    pendingRequest.value = await fetchPendingRequestForEvent(eventId)
  } catch (e: any) {
    errorMessage.value = e?.message || t('eventEditRequest.loadError')
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function handleCancelPendingRequest() {
  if (!pendingRequest.value) return
  submitting.value = true
  try {
    await cancelRequest(pendingRequest.value.id)
    pendingRequest.value = null
    successMessage.value = t('eventEditRequest.cancelledMessage')
  } catch (e: any) {
    errorMessage.value = e?.message || t('eventEditRequest.cancelError')
  } finally {
    submitting.value = false
  }
}

async function handleSubmit() {
  if (!event.value || !user.value) return
  submitting.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const startDateTime = form.startTime ? `${form.startDate}T${form.startTime}:00` : `${form.startDate}T00:00:00`
    const newEventFields = {
      title: form.title,
      description: form.description || null,
      cover_image: form.coverImage || null,
      seating_plan_url: form.seatingPlanUrl || null,
      category_id: form.categoryId || null,
      start_date: startDateTime,
      end_date: form.endDate ? `${form.endDate}T23:59:59` : null,
      location_name: form.locationName || null,
      address: form.address || null,
      city: form.city || null,
      country: form.country || null,
    }

    if (!needsApproval.value) {
      // Brouillon : mise à jour directe, comme avant.
      const { error: eventUpdateError } = await supabase.from('events').update(newEventFields).eq('id', event.value.id)
      if (eventUpdateError) throw eventUpdateError

      for (const t of ticketDrafts.value) {
        const original = ticketTypes.value.find((o) => o.id === t.id)
        if (!original) continue
        const changed =
          original.name !== t.name ||
          original.description !== t.description ||
          Number(original.price) !== Number(t.price) ||
          Number(original.quantity) !== Number(t.quantity) ||
          original.sale_start !== t.sale_start ||
          original.sale_end !== t.sale_end
        if (!changed) continue
        const { id, ...fields } = t
        const { error: ticketUpdateError } = await supabase.from('ticket_types').update(fields).eq('id', id)
        if (ticketUpdateError) throw ticketUpdateError
      }

      successMessage.value = t('eventEditRequest.eventUpdated')
      await load()
      return
    }

    // Événement déjà publié : on passe par une demande de modification.
    const organizer = await ensureOrganizer()
    if (!organizer) throw new Error(t('eventWizard.organizerFetchError'))

    const request = await submitEditRequest({
      event: event.value,
      organizerId: organizer.id,
      userId: user.value.id,
      newEventFields,
      ticketTypes: ticketTypes.value,
      newTicketTypes: ticketDrafts.value,
    })

    if (!request) {
      successMessage.value = t('eventEditRequest.noChangesDetected')
    } else {
      successMessage.value = t('eventEditRequest.requestSentMessage')
      pendingRequest.value = request
    }
  } catch (e: any) {
    if (e?.message?.includes('MODIFICATION_REQUIRES_ADMIN_APPROVAL')) {
      errorMessage.value = t('eventEditRequest.directEditBlockedError')
    } else {
      errorMessage.value = e?.message || t('eventEditRequest.genericSaveError')
    }
  } finally {
    submitting.value = false
  }
}

function addTicketDraft() {
  ticketDrafts.value.push({ id: `new-${Date.now()}`, name: '', description: null, price: 0, quantity: 0, sale_start: null, sale_end: null })
}

async function createNewTicketType(draft: EditableTicketTypeFields) {
  if (!event.value) return
  submitting.value = true
  errorMessage.value = ''
  try {
    const { error } = await supabase.from('ticket_types').insert({
      event_id: event.value.id,
      name: draft.name,
      description: draft.description,
      price: draft.price,
      quantity: draft.quantity,
      sale_start: draft.sale_start,
      sale_end: draft.sale_end,
    })
    if (error) throw error
    successMessage.value = t('eventEditRequest.ticketAdded')
    await load()
  } catch (e: any) {
    errorMessage.value = e?.message || t('eventEditRequest.createTicketError')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-8 md:px-6">
    <h1 class="mb-1 text-xl font-bold text-tikeo-black">{{ t('eventEditRequest.title') }}</h1>
    <p class="mb-6 text-sm text-tikeo-gray-text">
      <span v-if="needsApproval">{{ t('eventEditRequest.publishedNotice') }}</span>
      <span v-else>{{ t('eventEditRequest.draftNotice') }}</span>
    </p>

    <p v-if="errorMessage" class="mb-4 border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{{ errorMessage }}</p>
    <p v-if="successMessage" class="mb-4 border border-green-200 bg-green-50 px-4 py-2 text-sm text-tikeo-success dark:bg-green-500/10">{{ successMessage }}</p>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 4" :key="i" class="h-12 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>

    <template v-else-if="event">
      <!-- Demande en attente -->
      <div v-if="pendingRequest" class="mb-6 border border-tikeo-orange/40 bg-tikeo-orange/5 p-4">
        <p class="text-sm font-semibold text-tikeo-orange">{{ t('eventEditRequest.pendingTitle') }}</p>
        <p class="mt-1 text-xs text-tikeo-gray-text">{{ t('eventEditRequest.pendingSentOn', { date: new Date(pendingRequest.created_at).toLocaleString(locale) }) }}</p>
        <button type="button" class="btn-secondary mt-3 text-xs" :disabled="submitting" @click="handleCancelPendingRequest">{{ t('eventEditRequest.cancelRequestButton') }}</button>
      </div>
      <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
        <input v-model="form.title" type="text" required :placeholder="t('eventForm.titlePlaceholder')" class="input-field" />
        <textarea v-model="form.description" rows="4" :placeholder="t('eventForm.descriptionPlaceholder')" class="input-field" />
        <MediaInput
          v-model="form.coverImage"
          folder="event-covers"
          :label="t('eventForm.coverImageLabel')"
          :placeholder="t('eventForm.coverImagePlaceholder')"
        />
        <MediaInput
          v-model="form.seatingPlanUrl"
          folder="seating-plans"
          allow-pdf
          :label="t('eventForm.seatingPlanLabel')"
          :placeholder="t('eventForm.seatingPlanPlaceholderShort')"
        />
        <select v-model="form.categoryId" class="input-field">
          <option value="">{{ t('eventForm.categoryPlaceholder') }}</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <div class="grid grid-cols-2 gap-4">
          <input v-model="form.startDate" type="date" required class="input-field" />
          <input v-model="form.startTime" type="time" class="input-field" />
        </div>
        <input v-model="form.endDate" type="date" :placeholder="t('eventForm.endDatePlaceholder')" class="input-field" />
        <input v-model="form.locationName" type="text" :placeholder="t('eventForm.locationNamePlaceholder')" class="input-field" />
        <input v-model="form.address" type="text" :placeholder="t('eventForm.addressPlaceholder')" class="input-field" />
        <div class="grid grid-cols-2 gap-4">
          <input v-model="form.city" type="text" :placeholder="t('eventForm.cityPlaceholder')" class="input-field" />
          <input v-model="form.country" type="text" :placeholder="t('eventForm.countryPlaceholder')" class="input-field" />
        </div>

        <h2 class="mt-2 text-sm font-bold text-tikeo-black">{{ t('eventEditRequest.existingTicketsTitle') }}</h2>
        <p class="text-xs text-tikeo-gray-text" v-if="needsApproval">{{ t('eventEditRequest.existingTicketsApprovalNote') }}</p>
        <div v-for="t2 in ticketDrafts" :key="t2.id" class="grid grid-cols-[1fr_120px_100px] items-center gap-2 border border-tikeo-border p-3">
          <input v-model="t2.name" type="text" :placeholder="t('eventForm.ticketNameShortPlaceholder')" class="input-field" />
          <input v-model.number="t2.price" type="number" min="0" :placeholder="t('eventForm.ticketPricePlaceholder')" class="input-field" />
          <input v-model.number="t2.quantity" type="number" min="0" :placeholder="t('eventForm.ticketQuantityPlaceholder')" class="input-field" />
        </div>

        <div class="flex gap-3">
          <button type="button" class="btn-secondary flex-1" @click="router.push('/organisateur/evenements')">{{ t('common.cancel') }}</button>
          <button type="submit" class="btn-primary flex-1" :disabled="submitting || !!pendingRequest">
            {{ submitting ? t('eventEditRequest.sendingButton') : needsApproval ? t('eventEditRequest.sendRequestButton') : t('eventEditRequest.saveButton') }}
          </button>
        </div>
      </form>

      <div class="mt-8 border-t border-tikeo-border pt-6">
        <h2 class="mb-2 text-sm font-bold text-tikeo-black">{{ t('eventEditRequest.addNewTicketTitle') }}</h2>
        <p class="mb-3 text-xs text-tikeo-gray-text">{{ t('eventEditRequest.addNewTicketNote') }}</p>
        <button type="button" class="btn-secondary text-xs" @click="addTicketDraft">{{ t('eventEditRequest.addButton') }}</button>
        <div
          v-for="t2 in ticketDrafts.filter((d) => d.id.startsWith('new-'))"
          :key="t2.id"
          class="mt-3 grid grid-cols-[1fr_120px_100px_auto] items-center gap-2 border border-tikeo-border p-3"
        >
          <input v-model="t2.name" type="text" :placeholder="t('eventForm.ticketNamePlaceholder')" class="input-field" />
          <input v-model.number="t2.price" type="number" min="0" :placeholder="t('eventForm.ticketPricePlaceholder')" class="input-field" />
          <input v-model.number="t2.quantity" type="number" min="0" :placeholder="t('eventForm.ticketQuantityPlaceholder')" class="input-field" />
          <button type="button" class="btn-primary text-xs" :disabled="submitting || !t2.name" @click="createNewTicketType(t2)">{{ t('eventEditRequest.createButton') }}</button>
        </div>
      </div>
    </template>
  </div>
</template>
