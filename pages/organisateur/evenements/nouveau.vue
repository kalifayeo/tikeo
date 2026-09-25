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
        status: publish ? 'published' : 'draft',
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
  <div class="mx-auto max-w-3xl px-4 py-8 md:px-6">
    <h1 class="mb-1 text-xl font-bold text-tikeo-black">{{ t('eventWizard.title') }}</h1>
    <p class="mb-6 text-sm text-tikeo-gray-text">{{ t('eventWizard.subtitle') }}</p>

    <!-- Étapes -->
    <div class="mb-6 flex items-center gap-2 text-xs font-semibold">
      <span class="flex items-center gap-1.5" :class="step >= 1 ? 'text-tikeo-orange' : 'text-tikeo-gray-text'">
        <span class="flex h-6 w-6 items-center justify-center border" :class="step >= 1 ? 'border-tikeo-orange bg-tikeo-orange text-white' : 'border-tikeo-border'">1</span>
        {{ t('eventWizard.stepInfo') }}
      </span>
      <span class="h-px w-8 bg-tikeo-border" />
      <span class="flex items-center gap-1.5" :class="step >= 2 ? 'text-tikeo-orange' : 'text-tikeo-gray-text'">
        <span class="flex h-6 w-6 items-center justify-center border" :class="step >= 2 ? 'border-tikeo-orange bg-tikeo-orange text-white' : 'border-tikeo-border'">2</span>
        {{ t('eventWizard.stepTickets') }}
      </span>
      <span class="h-px w-8 bg-tikeo-border" />
      <span class="flex items-center gap-1.5" :class="step >= 3 ? 'text-tikeo-orange' : 'text-tikeo-gray-text'">
        <span class="flex h-6 w-6 items-center justify-center border" :class="step >= 3 ? 'border-tikeo-orange bg-tikeo-orange text-white' : 'border-tikeo-border'">3</span>
        {{ t('eventWizard.stepPublish') }}
      </span>
      <span class="h-px w-8 bg-tikeo-border" />
      <span class="flex items-center gap-1.5" :class="step >= 4 ? 'text-tikeo-orange' : 'text-tikeo-gray-text'">
        <span class="flex h-6 w-6 items-center justify-center border" :class="step >= 4 ? 'border-tikeo-orange bg-tikeo-orange text-white' : 'border-tikeo-border'">4</span>
        {{ t('eventWizard.stepLink') }}
      </span>
    </div>

    <p v-if="errorMessage" class="mb-4 border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{{ errorMessage }}</p>

    <!-- Étape 1 : informations générales -->
    <form v-if="step === 1" class="flex flex-col gap-4" @submit.prevent="submitStep1">
      <input v-model="form.title" type="text" required :placeholder="t('eventForm.titlePlaceholder')" class="input-field" />
      <textarea v-model="form.description" rows="4" :placeholder="t('eventForm.descriptionPlaceholder')" class="input-field" />

      <!-- Lien personnalisé (cahier des charges §14-16 : himra.tikeo.com) -->
      <div>
        <label class="mb-1 block text-xs font-semibold text-tikeo-gray-text">{{ t('eventForm.slugLabel') }}</label>
        <div class="flex items-center border border-tikeo-border focus-within:border-tikeo-orange">
          <span class="shrink-0 truncate pl-3 text-sm text-tikeo-gray-text">tikeo.com/e/</span>
          <input
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
      </div>
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
      <button type="submit" class="btn-primary w-full">{{ t('eventForm.continueButton') }}</button>
    </form>

    <!-- Étape 2 : billetterie -->
    <form v-else-if="step === 2" class="flex flex-col gap-4" @submit.prevent="submitStep2">
      <div v-for="(t2, i) in ticketTypes" :key="i" class="grid grid-cols-[1fr_120px_100px_auto] items-center gap-2 border border-tikeo-border p-3">
        <input v-model="t2.name" type="text" :placeholder="t('eventForm.ticketNamePlaceholder')" class="input-field" />
        <input v-model.number="t2.price" type="number" min="0" :placeholder="t('eventForm.ticketPricePlaceholder')" class="input-field" />
        <input v-model.number="t2.quantity" type="number" min="0" :placeholder="t('eventForm.ticketQuantityPlaceholder')" class="input-field" />
        <button type="button" class="p-2 text-tikeo-error" :aria-label="t('eventForm.removeAria')" @click="removeTicketType(i)">✕</button>
      </div>
      <button type="button" class="btn-secondary self-start" @click="addTicketType">{{ t('eventForm.addTicketType') }}</button>
      <div class="flex gap-3">
        <button type="button" class="btn-secondary flex-1" @click="step = 1">{{ t('eventForm.backButton') }}</button>
        <button type="submit" class="btn-primary flex-1">{{ t('eventForm.continueButton') }}</button>
      </div>
    </form>

    <!-- Étape 3 : récapitulatif + publication -->
    <div v-else-if="step === 3" class="flex flex-col gap-4">
      <div class="border border-tikeo-border p-4">
        <p class="font-bold text-tikeo-black">{{ form.title }}</p>
        <p class="text-sm text-tikeo-gray-text">{{ form.startDate }} {{ form.startTime }} — {{ form.city }}, {{ form.country }}</p>
        <p class="mt-1 text-sm text-tikeo-gray-text">tikeo.com/e/<span class="font-semibold text-tikeo-black">{{ slug }}</span></p>
        <ul class="mt-2 space-y-1 text-sm text-tikeo-gray-text">
          <li v-for="(t2, i) in ticketTypes" :key="i">{{ t2.name }} — {{ t2.price.toLocaleString('fr-FR') }} FCFA × {{ t2.quantity }}</li>
        </ul>
      </div>
      <div class="flex gap-3">
        <button type="button" class="btn-secondary flex-1" :disabled="submitting" @click="publishEvent(false)">{{ t('eventForm.saveDraftButton') }}</button>
        <button type="button" class="btn-primary flex-1" :disabled="submitting" @click="publishEvent(true)">
          {{ submitting ? t('eventForm.publishing') : t('eventForm.publishButton') }}
        </button>
      </div>
    </div>

    <!-- Étape 4 : lien personnalisé de l'événement (cahier des charges §59) -->
    <div v-else class="flex flex-col items-center gap-4 py-4 text-center">
      <div class="flex h-14 w-14 items-center justify-center rounded-full bg-tikeo-success/10 text-tikeo-success">
        <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
      </div>
      <h2 class="text-lg font-bold text-tikeo-black">{{ t('eventForm.publishedTitle') }}</h2>
      <p class="text-sm text-tikeo-gray-text">{{ t('eventForm.publishedDesc') }}</p>

      <div class="flex w-full items-center gap-2 border border-tikeo-border bg-tikeo-surface-alt px-3 py-2.5">
        <span class="flex-1 truncate text-left text-sm font-medium text-tikeo-black">{{ publishedEventUrl }}</span>
        <button type="button" class="btn-secondary shrink-0 px-3 py-1.5 text-xs" @click="copyPublishedLink">
          {{ linkCopied ? t('eventForm.linkCopied') : t('eventForm.copyLink') }}
        </button>
      </div>

      <div class="flex w-full gap-3">
        <a :href="whatsappShareUrl" target="_blank" rel="noopener" class="btn-secondary flex-1">WhatsApp</a>
        <a :href="facebookShareUrl" target="_blank" rel="noopener" class="btn-secondary flex-1">Facebook</a>
      </div>

      <NuxtLink to="/organisateur/evenements" class="btn-primary mt-2 w-full">{{ t('eventForm.backToMyEvents') }}</NuxtLink>
    </div>
  </div>
</template>
