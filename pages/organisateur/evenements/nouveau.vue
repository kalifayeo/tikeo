<script setup lang="ts">
definePageMeta({ layout: 'organisateur', middleware: 'organizer' })
import type { Category } from '~/types/database'

const { t } = useI18n()
const supabase = useSupabase()
const { isAuthenticated } = useAuth()
const { ensureOrganizer } = useOrganizer()
const router = useRouter()

const loading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const categories = ref<Category[]>([])

// Étape en cours (cahier des charges §13/§59 : informations -> billets -> publication -> lien)
const step = ref<1 | 2 | 3 | 4>(1)

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
  city: 'Abidjan',
  country: "Côte d'Ivoire",
  latitude: null as number | null,
  longitude: null as number | null,
  allowTicketTransfers: true,
  feesPayer: 'organizer' as 'organizer' | 'buyer',
})

// --- Lien personnalisé de l'événement (cahier des charges §14-16) ---
// L'organisateur peut personnaliser le "slug" (himra.tikeo.com) au lieu de
// se voir imposer un identifiant technique. On le pré-remplit à partir du
// titre, mais il reste éditable et sa disponibilité est vérifiée en direct.
const slug = ref('')
let slugTouchedByUser = false
const slugChecking = ref(false)
const slugAvailable = ref<boolean | null>(null)
let slugCheckToken = 0

function onSlugInput(value: string) {
  slugTouchedByUser = true
  slug.value = slugify(value)
}

watch(
  () => form.title,
  (title) => {
    if (slugTouchedByUser) return
    slug.value = slugify(title)
  }
)

watch(slug, (value) => {
  slugAvailable.value = null
  if (!value) return
  slugChecking.value = true
  const token = ++slugCheckToken
  const timer = setTimeout(async () => {
    const available = await isSlugAvailable(value)
    if (token === slugCheckToken) {
      slugAvailable.value = available
      slugChecking.value = false
    }
  }, 400)
  onScopeDispose(() => clearTimeout(timer))
})

async function isSlugAvailable(value: string) {
  if (!value) return false
  const { data } = await supabase.from('events').select('id').eq('slug', value).limit(1).maybeSingle()
  return !data
}

// Lien final (utilisé sur l'étape 4 de succès)
const { buildEventUrl } = useEventPublicUrl()
const publishedEventUrl = ref('')
const publishedEventTitle = ref('')
const linkCopied = ref(false)
async function copyPublishedLink() {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return
  await navigator.clipboard.writeText(publishedEventUrl.value)
  linkCopied.value = true
  setTimeout(() => (linkCopied.value = false), 2000)
}
const whatsappShareUrl = computed(
  () => `https://wa.me/?text=${encodeURIComponent(`${publishedEventTitle.value} — ${publishedEventUrl.value}`)}`
)
const facebookShareUrl = computed(
  () => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publishedEventUrl.value)}`
)

interface TicketDraft {
  name: string
  price: number
  quantity: number
}
const ticketTypes = ref<TicketDraft[]>([{ name: 'Standard', price: 0, quantity: 100 }])

// Limite de billets par acheteur (§ demande organisateur) : illimité par
// défaut, ou une valeur fixe parmi les propositions ci-dessous. Revalidée
// en base par create_order() (supabase/migrations/0026), le frontend ne
// fait qu'informer/désactiver les boutons.
const PURCHASE_LIMIT_OPTIONS = [1, 2, 3, 5] as const
const purchaseLimit = ref<number | null>(null)

function addTicketType() {
  ticketTypes.value.push({ name: '', price: 0, quantity: 0 })
}
function removeTicketType(i: number) {
  ticketTypes.value.splice(i, 1)
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

onMounted(async () => {
  loading.value = true
  try {
    const { data } = await supabase.from('categories').select('*').eq('status', 'active').order('name')
    categories.value = (data as unknown as Category[]) ?? []
  } finally {
    loading.value = false
  }
})

async function submitStep1() {
  if (!form.title || !form.startDate) {
    errorMessage.value = t('eventWizard.requiredError')
    return
  }
  if (!slug.value) {
    errorMessage.value = t('eventWizard.slugRequiredError')
    return
  }
  // Vérification finale de disponibilité (au cas où le débounce n'aurait
  // pas eu le temps de se terminer avant que l'utilisateur clique).
  slugChecking.value = true
  const available = await isSlugAvailable(slug.value)
  slugChecking.value = false
  slugAvailable.value = available
  if (!available) {
    errorMessage.value = t('eventWizard.slugTakenError')
    return
  }
  errorMessage.value = ''
  step.value = 2
}

function submitStep2() {
  if (ticketTypes.value.length === 0 || ticketTypes.value.some((t) => !t.name)) {
    errorMessage.value = t('eventWizard.atLeastOneTicketError')
    return
  }
  errorMessage.value = ''
  step.value = 3
}

async function publishEvent(publish: boolean) {
  submitting.value = true
  errorMessage.value = ''
  try {
    if (!isAuthenticated.value) throw new Error(t('eventWizard.loginRequiredError'))

    const organizer = await ensureOrganizer()
    if (!organizer) throw new Error(t('eventWizard.organizerFetchError'))

    if (publish && organizer.status !== 'approved') {
      throw new Error(t('eventWizard.notApprovedError'))
    }

    const startDateTime = form.startTime ? `${form.startDate}T${form.startTime}:00` : `${form.startDate}T00:00:00`

    // Sécurité : re-vérifier la disponibilité du slug juste avant l'écriture
    // (fenêtre de course possible entre la vérification de l'étape 1 et la
    // publication). En cas de conflit malgré tout, la contrainte `unique`
    // en base (supabase/migrations/0001_init.sql) empêchera le doublon et
    // on retente avec un court suffixe plutôt que d'échouer silencieusement.
    let finalSlug = slug.value || slugify(form.title)
    if (!(await isSlugAvailable(finalSlug))) {
      finalSlug = `${finalSlug}-${Math.random().toString(36).slice(2, 6)}`
    }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        organizer_id: organizer.id,
        title: form.title,
        slug: finalSlug,
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
        latitude: form.latitude,
        longitude: form.longitude,
        allow_ticket_transfers: form.allowTicketTransfers,
        fees_payer: form.feesPayer,
        status: publish ? 'published' : 'draft',
        max_tickets_per_buyer: purchaseLimit.value,
      })
      .select('id')
      .single()

    if (eventError) throw eventError

    const rows = ticketTypes.value.map((t) => ({
      event_id: event.id,
      name: t.name,
      price: t.price,
      quantity: t.quantity,
    }))
    const { error: ticketsError } = await supabase.from('ticket_types').insert(rows)
    if (ticketsError) throw ticketsError

    if (publish) {
      // §59 : l'organisateur doit obtenir son lien immédiatement après publication.
      publishedEventTitle.value = form.title
      publishedEventUrl.value = buildEventUrl({ slug: finalSlug }).url
      step.value = 4
    } else {
      router.push('/organisateur/evenements')
    }
  } catch (e: any) {
    errorMessage.value = e?.message || e?.data?.statusMessage || t('eventWizard.createError')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div>
    <OrgPageHeader :eyebrow="t('organizerNav.fallbackTitle')" :title="t('eventWizard.title')" :subtitle="t('eventWizard.subtitle')" icon="calendar-plus" :back="{ to: '/organisateur/evenements', label: t('ticketStats.backToEvents') }" />
    <div class="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-10">

    <!-- Étapes -->
    <ol class="mb-8 grid grid-cols-4 gap-2" :aria-label="t('eventWizard.title')">
      <li v-for="(label, i) in [t('eventWizard.stepInfo'), t('eventWizard.stepTickets'), t('eventWizard.stepPublish'), t('eventWizard.stepLink')]" :key="i" class="min-w-0">
        <div class="h-1.5 w-full bg-tikeo-border">
          <div class="h-full bg-[#FF7A00] transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]" :style="`width: ${step > i ? 100 : 0}%`" />
        </div>
        <p class="mt-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors duration-300" :class="step >= i + 1 ? 'text-tikeo-black' : 'text-tikeo-gray-text'">
          <span class="flex h-5 w-5 shrink-0 items-center justify-center text-[11px]" :class="step > i + 1 ? 'bg-tikeo-success text-white' : step === i + 1 ? 'bg-tikeo-ink text-white dark:bg-[#FF7A00] dark:text-tikeo-ink' : 'bg-tikeo-surface-alt'">
            <AppIcon v-if="step > i + 1" name="check" class="h-3 w-3" :stroke="3" />
            <template v-else>{{ i + 1 }}</template>
          </span>
          <span class="truncate max-sm:hidden">{{ label }}</span>
        </p>
      </li>
    </ol>

    <p v-if="errorMessage" class="mb-4 border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{{ errorMessage }}</p>

    <!-- En-tête de l'étape en cours -->
    <div v-if="step < 4" class="mb-6">
      <p class="text-[11px] font-bold uppercase tracking-wider text-tikeo-orange">{{ t('eventForm.stepOf', { n: step }) }}</p>
      <p class="mt-1 text-sm text-tikeo-gray-text">{{ t(`eventForm.desc${step}`) }}</p>
      <p v-if="step < 3" class="mt-1 text-xs text-tikeo-gray-text"><span class="text-tikeo-error">*</span> {{ t('eventForm.requiredLegend') }}</p>
    </div>

    <!-- Étape 1 : informations générales -->
    <form v-if="step === 1" class="flex flex-col gap-8" @submit.prevent="submitStep1">
      <WizardSection :title="t('eventForm.sectionGeneral')" icon="info">
        <WizardField v-slot="{ id }" :label="t('eventForm.labelTitle')" required>
          <input :id="id" v-model="form.title" type="text" required :placeholder="t('eventForm.exTitle')" class="input-field" />
        </WizardField>
        <WizardField v-slot="{ id }" :label="t('eventForm.labelDescription')" optional>
          <textarea :id="id" v-model="form.description" rows="4" :placeholder="t('eventForm.exDescription')" class="input-field" />
        </WizardField>
        <WizardField v-slot="{ id }" :label="t('eventForm.labelCategory')" optional>
          <select :id="id" v-model="form.categoryId" class="input-field">
            <option value="">{{ t('eventForm.categoryChoose') }}</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </WizardField>

        <!-- Lien personnalisé (cahier des charges §14-16 : himra.tikeo.com) -->
        <WizardField v-slot="{ id }" :label="t('eventForm.slugLabel')" required>
          <div class="flex items-center border border-tikeo-border focus-within:border-tikeo-orange">
            <span class="shrink-0 truncate pl-3 text-sm text-tikeo-gray-text">tikeo.com/e/</span>
            <input
              :id="id"
              :value="slug"
              type="text"
              :placeholder="t('eventForm.slugPlaceholder')"
              class="w-full border-0 bg-transparent px-1 py-2.5 text-sm text-tikeo-black outline-none"
              @input="onSlugInput(($event.target as HTMLInputElement).value)"
            />
          </div>
          <p v-if="slugChecking" class="mt-1 text-xs text-tikeo-gray-text">{{ t('eventForm.slugChecking') }}</p>
          <p v-else-if="slugAvailable === true" class="mt-1 text-xs text-tikeo-success">{{ t('eventForm.slugAvailable') }}</p>
          <p v-else-if="slugAvailable === false" class="mt-1 text-xs text-tikeo-error">{{ t('eventForm.slugTaken') }}</p>
          <p v-else class="mt-1 text-xs text-tikeo-gray-text">{{ t('eventForm.slugHelp') }}</p>
        </WizardField>
      </WizardSection>

      <WizardSection :title="t('eventForm.sectionVisuals')" icon="image">
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
          :placeholder="t('eventForm.seatingPlanPlaceholder')"
          :help="t('eventForm.seatingPlanHelp')"
        />
      </WizardSection>

      <WizardSection :title="t('eventForm.sectionDateTime')" icon="calendar">
        <div class="grid gap-4 sm:grid-cols-2">
          <WizardField v-slot="{ id }" :label="t('eventForm.labelStartDate')" required>
            <input :id="id" v-model="form.startDate" type="date" required class="input-field" />
          </WizardField>
          <WizardField v-slot="{ id }" :label="t('eventForm.labelStartTime')" optional>
            <input :id="id" v-model="form.startTime" type="time" class="input-field" />
          </WizardField>
        </div>
        <WizardField v-slot="{ id }" :label="t('eventForm.labelEndDate')" optional>
          <input :id="id" v-model="form.endDate" type="date" class="input-field sm:max-w-[calc(50%-0.5rem)]" />
        </WizardField>
      </WizardSection>

      <WizardSection :title="t('eventForm.sectionLocation')" icon="pin">
        <WizardField v-slot="{ id }" :label="t('eventForm.labelLocationName')" optional>
          <input :id="id" v-model="form.locationName" type="text" :placeholder="t('eventForm.exLocationName')" class="input-field" />
        </WizardField>
        <WizardField v-slot="{ id }" :label="t('eventForm.labelAddress')" optional>
          <input :id="id" v-model="form.address" type="text" :placeholder="t('eventForm.exAddress')" class="input-field" />
        </WizardField>
        <div class="grid gap-4 sm:grid-cols-2">
          <WizardField v-slot="{ id }" :label="t('eventForm.labelCity')" optional>
            <input :id="id" v-model="form.city" type="text" :placeholder="t('eventForm.exCity')" class="input-field" />
          </WizardField>
          <WizardField v-slot="{ id }" :label="t('eventForm.labelCountry')" optional>
            <input :id="id" v-model="form.country" type="text" :placeholder="t('eventForm.exCountry')" class="input-field" />
          </WizardField>
        </div>
        <div>
          <p class="mb-2 text-[13px] font-bold text-tikeo-black">{{ t('eventForm.venueMapLabel') }}</p>
          <VenueMapPicker v-model:latitude="form.latitude" v-model:longitude="form.longitude" />
        </div>
      </WizardSection>

      <WizardSection :title="t('eventForm.sectionOptions')" icon="settings">
        <label class="flex items-start gap-3 border border-tikeo-border p-3 text-sm text-tikeo-black">
          <input v-model="form.allowTicketTransfers" type="checkbox" class="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span class="block font-bold">{{ t('eventForm.allowTransfersLabel') }}</span>
            <span class="mt-0.5 block text-xs text-tikeo-gray-text">{{ t('eventForm.allowTransfersHelp') }}</span>
          </span>
        </label>
        <fieldset class="mt-3 border border-tikeo-border p-3 text-sm text-tikeo-black">
          <legend class="px-1 text-[13px] font-bold">{{ t('eventForm.feesPayerLabel') }}</legend>
          <p class="mb-2 text-xs text-tikeo-gray-text">{{ t('eventForm.feesPayerHelp') }}</p>
          <label class="flex items-start gap-2 py-1"><input v-model="form.feesPayer" type="radio" value="organizer" class="mt-0.5 h-4 w-4 shrink-0" /><span>{{ t('eventForm.feesPayerOrganizer') }}</span></label>
          <label class="flex items-start gap-2 py-1"><input v-model="form.feesPayer" type="radio" value="buyer" class="mt-0.5 h-4 w-4 shrink-0" /><span>{{ t('eventForm.feesPayerBuyer') }}</span></label>
        </fieldset>
      </WizardSection>

      <button type="submit" class="btn-primary w-full">{{ t('eventForm.continueButton') }}</button>
    </form>

    <!-- Étape 2 : billetterie -->
    <form v-else-if="step === 2" class="flex flex-col gap-8" @submit.prevent="submitStep2">
      <WizardSection :title="t('eventForm.sectionTickets')" icon="ticket">
        <div v-for="(t2, i) in ticketTypes" :key="i" class="border border-tikeo-border p-4">
          <div class="mb-3 flex items-center justify-between gap-3">
            <p class="text-sm font-extrabold text-tikeo-black">{{ t('eventForm.ticketN', { n: i + 1 }) }}</p>
            <button type="button" class="flex items-center gap-1.5 text-xs font-semibold text-tikeo-error" :aria-label="t('eventForm.removeAria')" @click="removeTicketType(i)">
              <AppIcon name="trash" class="h-4 w-4" />{{ t('eventForm.removeTicket') }}
            </button>
          </div>
          <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_150px]">
            <WizardField v-slot="{ id }" :label="t('eventForm.labelTicketName')" required>
              <input :id="id" v-model="t2.name" type="text" :placeholder="t('eventForm.exTicketName')" class="input-field" />
            </WizardField>
            <WizardField v-slot="{ id }" :label="t('eventForm.labelTicketPrice')" required>
              <input :id="id" v-model.number="t2.price" type="number" min="0" :placeholder="t('eventForm.exTicketPrice')" class="input-field" />
            </WizardField>
            <WizardField v-slot="{ id }" :label="t('eventForm.labelTicketQty')" required>
              <input :id="id" v-model.number="t2.quantity" type="number" min="0" :placeholder="t('eventForm.exTicketQty')" class="input-field" />
            </WizardField>
          </div>
        </div>
        <button type="button" class="btn-secondary self-start" @click="addTicketType">{{ t('eventForm.addTicketType') }}</button>
      </WizardSection>

      <!-- Limite de billets par acheteur : aucune case cochée = illimité -->
      <WizardSection :title="t('eventForm.sectionOptions')" icon="settings">
        <div class="border border-tikeo-border p-4" role="radiogroup" aria-labelledby="purchase-limit-label">
          <p id="purchase-limit-label" class="mb-2 text-[13px] font-bold text-tikeo-black">{{ t('eventForm.purchaseLimitLabel') }}</p>
          <div class="flex flex-wrap gap-2">
            <label
              class="cursor-pointer border px-3 py-1.5 text-xs font-semibold"
              :class="purchaseLimit === null ? 'border-tikeo-orange bg-tikeo-orange/10 text-tikeo-orange' : 'border-tikeo-border text-tikeo-gray-text'"
            >
              <input type="radio" class="sr-only" :checked="purchaseLimit === null" @change="purchaseLimit = null" />
              {{ t('eventForm.purchaseLimitUnlimited') }}
            </label>
            <label
              v-for="n in PURCHASE_LIMIT_OPTIONS"
              :key="n"
              class="cursor-pointer border px-3 py-1.5 text-xs font-semibold"
              :class="purchaseLimit === n ? 'border-tikeo-orange bg-tikeo-orange/10 text-tikeo-orange' : 'border-tikeo-border text-tikeo-gray-text'"
            >
              <input type="radio" class="sr-only" :checked="purchaseLimit === n" @change="purchaseLimit = n" />
              {{ t('eventForm.purchaseLimitOption', { n }) }}
            </label>
          </div>
          <p class="mt-2 text-xs text-tikeo-gray-text">{{ t('eventForm.purchaseLimitHelp') }}</p>
        </div>
      </WizardSection>

      <div class="flex gap-3">
        <button type="button" class="btn-secondary flex-1" @click="step = 1">{{ t('eventForm.backButton') }}</button>
        <button type="submit" class="btn-primary flex-1">{{ t('eventForm.continueButton') }}</button>
      </div>
    </form>

    <!-- Étape 3 : récapitulatif + publication -->
    <div v-else-if="step === 3" class="flex flex-col gap-8">
      <WizardSection :title="t('eventForm.sectionRecap')" icon="clipboard">
        <dl class="divide-y divide-tikeo-border border border-tikeo-border text-sm">
          <div class="grid gap-1 p-3.5 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
            <dt class="text-xs font-bold uppercase tracking-wide text-tikeo-gray-text">{{ t('eventForm.recapName') }}</dt>
            <dd class="font-bold text-tikeo-black">{{ form.title }}</dd>
          </div>
          <div class="grid gap-1 p-3.5 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
            <dt class="text-xs font-bold uppercase tracking-wide text-tikeo-gray-text">{{ t('eventForm.recapDate') }}</dt>
            <dd class="text-tikeo-black">
              {{ form.startDate }}<template v-if="form.startTime"> · {{ form.startTime }}</template>
              <template v-if="form.endDate"> ({{ t('eventForm.recapEndDate', { date: form.endDate }) }})</template>
            </dd>
          </div>
          <div class="grid gap-1 p-3.5 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
            <dt class="text-xs font-bold uppercase tracking-wide text-tikeo-gray-text">{{ t('eventForm.recapPlace') }}</dt>
            <dd class="text-tikeo-black">{{ [form.locationName, form.address, form.city, form.country].filter(Boolean).join(', ') || '—' }}</dd>
          </div>
          <div class="grid gap-1 p-3.5 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
            <dt class="text-xs font-bold uppercase tracking-wide text-tikeo-gray-text">{{ t('eventForm.recapLink') }}</dt>
            <dd class="break-all text-tikeo-black">tikeo.com/e/<span class="font-bold">{{ slug }}</span></dd>
          </div>
          <div class="grid gap-1 p-3.5 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
            <dt class="text-xs font-bold uppercase tracking-wide text-tikeo-gray-text">{{ t('eventForm.recapTickets') }}</dt>
            <dd>
              <ul class="space-y-1 text-tikeo-black">
                <li v-for="(t2, i) in ticketTypes" :key="i"><span class="font-bold">{{ t2.name }}</span> — {{ t2.price.toLocaleString('fr-FR') }} FCFA × {{ t2.quantity }}</li>
              </ul>
            </dd>
          </div>
          <div class="grid gap-1 p-3.5 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
            <dt class="text-xs font-bold uppercase tracking-wide text-tikeo-gray-text">{{ t('eventForm.recapLimit') }}</dt>
            <dd class="font-bold text-tikeo-black">{{ purchaseLimit === null ? t('eventForm.purchaseLimitUnlimited') : t('eventForm.purchaseLimitOption', { n: purchaseLimit }) }}</dd>
          </div>
        </dl>
      </WizardSection>

      <div class="flex flex-col gap-3">
        <div class="flex gap-3">
          <button type="button" class="btn-secondary flex-1" :disabled="submitting" @click="publishEvent(false)">{{ t('eventForm.saveDraftButton') }}</button>
          <button type="button" class="btn-primary flex-1" :disabled="submitting" @click="publishEvent(true)">
            {{ submitting ? t('eventForm.publishing') : t('eventForm.publishButton') }}
          </button>
        </div>
        <p class="text-xs text-tikeo-gray-text">{{ t('eventForm.draftHint') }}</p>
        <p class="text-xs text-tikeo-gray-text">{{ t('eventForm.publishHint') }}</p>
      </div>
    </div>

    <!-- Étape 4 : lien personnalisé de l'événement (cahier des charges §59) -->
    <div v-else class="flex flex-col items-center gap-4 py-4 text-center">
      <p class="text-[11px] font-bold uppercase tracking-wider text-tikeo-orange">{{ t('eventForm.stepOf', { n: 4 }) }}</p>
      <div class="flex h-14 w-14 items-center justify-center rounded-full bg-tikeo-success/10 text-tikeo-success">
        <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
      </div>
      <h2 class="text-lg font-bold text-tikeo-black">{{ t('eventForm.publishedTitle') }}</h2>
      <p class="text-sm text-tikeo-gray-text">{{ t('eventForm.publishedDesc') }}</p>

      <div class="w-full text-left">
        <p class="mb-1.5 text-[13px] font-bold text-tikeo-black">{{ t('eventForm.labelEventLink') }}</p>
        <div class="flex w-full items-center gap-2 border border-tikeo-border bg-tikeo-surface-alt px-3 py-2.5">
          <span class="flex-1 truncate text-sm font-medium text-tikeo-black">{{ publishedEventUrl }}</span>
          <button type="button" class="btn-secondary shrink-0 px-3 py-1.5 text-xs" @click="copyPublishedLink">
            {{ linkCopied ? t('eventForm.linkCopied') : t('eventForm.copyLink') }}
          </button>
        </div>
      </div>

      <div class="w-full text-left">
        <p class="mb-1.5 text-[13px] font-bold text-tikeo-black">{{ t('eventForm.shareOn') }}</p>
        <div class="flex w-full gap-3">
          <a :href="whatsappShareUrl" target="_blank" rel="noopener" class="btn-secondary flex-1">WhatsApp</a>
          <a :href="facebookShareUrl" target="_blank" rel="noopener" class="btn-secondary flex-1">Facebook</a>
        </div>
      </div>

      <NuxtLink to="/organisateur/evenements" class="btn-primary mt-2 w-full">{{ t('eventForm.backToMyEvents') }}</NuxtLink>
    </div>
    </div>
  </div>
</template>
