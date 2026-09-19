<script setup lang="ts">
import type { CartLine } from '~/composables/useEventDetail'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const slug = route.params.slug as string

const { event, loading, notFound, error, refresh } = useEventDetail(slug)
const { isAuthenticated, user } = useAuth()
const { isFavorite, toggleFavorite } = useFavorites()
const { submitting, createOrder } = useEventOrder()

// --- Onglets "Tickets" / "Détails" (façon Tikerama) ---
const activeTab = ref<'tickets' | 'details'>('tickets')

// --- Plan de salle (optionnel, renseigné par l'organisateur) ---
const seatingPlanOpen = ref(false)
const seatingPlanIsImage = computed(() => /\.(png|jpe?g|webp|gif|avif)$/i.test(event.value?.seatingPlanUrl ?? ''))

// --- Description repliée au-delà d'une certaine longueur (onglet Détails) ---
const descriptionExpanded = ref(false)
const descriptionIsLong = computed(() => (event.value?.description?.length ?? 0) > 420)
const descriptionPreview = computed(() => {
  const d = event.value?.description ?? ''
  if (!descriptionIsLong.value || descriptionExpanded.value) return d
  return d.slice(0, 420).trimEnd() + '…'
})

// --- Détails de chaque type de billet, repliés par défaut ---
const expandedTicketDetails = ref<Record<string, boolean>>({})
function toggleTicketDetails(ticketTypeId: string) {
  expandedTicketDetails.value[ticketTypeId] = !expandedTicketDetails.value[ticketTypeId]
}

// --- Sélection de billets ---
const quantities = ref<Record<string, number>>({})

watch(
  event,
  (e) => {
    if (!e) return
    const initial: Record<string, number> = {}
    for (const tt of e.ticketTypes) initial[tt.id] = 0
    quantities.value = initial
  },
  { immediate: true }
)

function increment(ticketTypeId: string) {
  const tt = event.value?.ticketTypes.find((t) => t.id === ticketTypeId)
  if (!tt) return
  const current = quantities.value[ticketTypeId] ?? 0
  const cap = tt.remaining === null ? current + 1 : Math.min(tt.remaining, 10)
  if (current < cap) quantities.value[ticketTypeId] = current + 1
}

function decrement(ticketTypeId: string) {
  const current = quantities.value[ticketTypeId] ?? 0
  if (current > 0) quantities.value[ticketTypeId] = current - 1
}

// Un type de billet est signalé "Forte demande" quand son stock restant
// (donnée réelle : quantity - sold_quantity) passe sous la barre des 10 —
// pas un badge décoratif, il reflète l'inventaire réel du type de billet.
function isHighDemand(tt: { remaining: number | null; soldOut: boolean }) {
  return !tt.soldOut && tt.remaining !== null && tt.remaining <= 10
}

const cartLines = computed<CartLine[]>(() => {
  if (!event.value) return []
  return event.value.ticketTypes
    .map((tt) => ({ ticketTypeId: tt.id, name: tt.name, unitPrice: tt.price, quantity: quantities.value[tt.id] ?? 0 }))
    .filter((l) => l.quantity > 0)
})

const totalQuantity = computed(() => cartLines.value.reduce((sum, l) => sum + l.quantity, 0))
const totalPrice = computed(() => cartLines.value.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0))
const hasAvailableTickets = computed(() => (event.value?.ticketTypes.length ?? 0) > 0)

function formatPrice(n: number) {
  return n === 0 ? t('event.free') : `${n.toLocaleString('fr-FR')} FCFA`
}

// --- Dates ---
const formattedDate = computed(() => {
  if (!event.value) return ''
  const d = new Date(event.value.startDate)
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
})
const formattedTime = computed(() => {
  if (!event.value) return ''
  const d = new Date(event.value.startDate)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
})

// --- Favoris ---
async function handleFavoriteClick() {
  if (!event.value) return
  const ok = await toggleFavorite(event.value.id)
  if (!ok) router.push({ path: '/connexion', query: { redirect: route.fullPath } })
}

// --- Partage (cahier des charges §35 : le partage doit utiliser le lien
// personnalisé de l'événement — himra.tikeo.com, ou l'URL de secours
// tikeo.com/e/himra tant qu'aucun domaine perso n'est branché, §16). ---
const { buildEventUrl } = useEventPublicUrl()
const canonicalEventUrl = computed(() => (event.value ? buildEventUrl({ slug: event.value.slug }).url : ''))

const shareCopied = ref(false)
async function handleShare() {
  const url = canonicalEventUrl.value
  const shareData = { title: event.value?.title, text: event.value?.title, url }
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share(shareData)
      return
    } catch {
      // annulé par l'utilisateur : pas d'erreur à afficher
      return
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(url)
    shareCopied.value = true
    setTimeout(() => (shareCopied.value = false), 2000)
  }
}

const whatsappShareUrl = computed(
  () => `https://wa.me/?text=${encodeURIComponent(`${event.value?.title ?? ''} — ${canonicalEventUrl.value}`)}`
)
const facebookShareUrl = computed(
  () => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonicalEventUrl.value)}`
)

// --- Réservation ---
const orderResult = ref<{ orderNumber: string; total: number } | null>(null)
const orderError = ref<string | null>(null)

async function handleReserve() {
  orderError.value = null
  if (!isAuthenticated.value || !user.value) {
    router.push({ path: '/connexion', query: { redirect: route.fullPath } })
    return
  }
  if (!event.value || cartLines.value.length === 0) return

  const order = await createOrder(event.value.id, user.value.id, cartLines.value)
  if (order) {
    orderResult.value = { orderNumber: order.order_number, total: order.total }
    quantities.value = Object.fromEntries(event.value.ticketTypes.map((tt) => [tt.id, 0]))
  } else {
    orderError.value = t('event.orderError')
  }
}

useSeoMeta({
  title: () => (event.value ? `${event.value.title} — Tikeo` : 'Événement — Tikeo'),
  description: () => event.value?.description?.slice(0, 160) || "Découvrez et achetez vos billets sur Tikeo.",
  ogTitle: () => event.value?.title,
  ogImage: () => event.value?.coverImage,
  ogDescription: () => event.value?.description?.slice(0, 160),
  ogUrl: () => canonicalEventUrl.value || undefined,
})
useHead({
  link: [{ rel: 'canonical', href: () => canonicalEventUrl.value || undefined }],
})
</script>

<template>
  <div>
    <!-- Chargement -->
    <div v-if="loading" class="mx-auto max-w-tikeo-container px-4 py-6 md:px-6">
      <div class="h-64 w-full animate-pulse bg-tikeo-surface-alt md:h-96" />
      <div class="mt-6 grid gap-6 md:grid-cols-[1fr_360px]">
        <div class="space-y-3">
          <div class="h-6 w-2/3 animate-pulse bg-tikeo-surface-alt" />
          <div class="h-4 w-1/3 animate-pulse bg-tikeo-surface-alt" />
          <div class="h-32 w-full animate-pulse bg-tikeo-surface-alt" />
        </div>
        <div class="h-56 w-full animate-pulse bg-tikeo-surface-alt" />
      </div>
    </div>

    <!-- Introuvable -->
    <div v-else-if="notFound || error" class="mx-auto flex max-w-2xl flex-col items-center gap-3 px-6 py-20 text-center">
      <img src="/logo-tikeo.png" alt="Tikeo" class="h-10 w-auto" />
      <h1 class="text-xl font-bold text-tikeo-black">{{ t('event.notFoundTitle') }}</h1>
      <p class="text-sm text-tikeo-gray-text">{{ t('event.notFoundDesc') }}</p>
      <NuxtLink to="/" class="btn-primary mt-2">{{ t('event.backHome') }}</NuxtLink>
    </div>

    <!-- Contenu -->
    <template v-else-if="event">
      <!-- Hero : image réduite, positionnée à côté des informations (au lieu -->
      <!-- d'une bannière plein écran) -->
      <div class="mx-auto max-w-tikeo-container px-4 pt-4 md:px-6 md:pt-6">
        <div class="flex flex-col gap-5 md:flex-row md:items-stretch md:gap-8">
          <!-- Image -->
          <div class="relative shrink-0 overflow-hidden bg-tikeo-surface-alt md:w-[38%] lg:w-[34%]">
            <img :src="event.coverImage" :alt="event.title" class="aspect-[4/3] w-full object-cover md:aspect-auto md:h-full md:min-h-[260px]" />

            <NuxtLink to="/" class="absolute left-3 top-3 flex h-9 w-9 items-center justify-center bg-black/40 text-white backdrop-blur hover:bg-black/60" :aria-label="t('event.backHome')">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </NuxtLink>

            <div class="absolute right-3 top-3 flex items-center gap-2">
              <button type="button" class="relative flex h-9 w-9 items-center justify-center bg-black/40 text-white backdrop-blur hover:bg-black/60" :aria-label="t('event.share')" @click="handleShare">
                <svg class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8.7 10.7l6.6-3.4M8.7 13.3l6.6 3.4M18 5a2 2 0 11-4 0 2 2 0 014 0zM8 12a2 2 0 11-4 0 2 2 0 014 0zM18 19a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                <span v-if="shareCopied" class="absolute -bottom-8 right-0 whitespace-nowrap bg-tikeo-black px-2 py-1 text-[11px] font-medium text-tikeo-surface">{{ t('event.shareCopied') }}</span>
              </button>
              <button
                type="button"
                class="flex h-9 w-9 items-center justify-center bg-black/40 text-white backdrop-blur hover:bg-black/60"
                :aria-pressed="isFavorite(event.id)"
                :aria-label="t('event.favorite')"
                @click="handleFavoriteClick"
              >
                <svg class="h-4.5 w-4.5" :class="isFavorite(event.id) ? 'fill-tikeo-orange text-tikeo-orange' : 'fill-none'" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 21s-7.5-4.6-10-9.1C.5 8.6 2.3 5 6 5c2 0 3.4 1.1 4 2.2C10.6 6.1 12 5 14 5c3.7 0 5.5 3.6 4 6.9-2.5 4.5-10 9.1-10 9.1z" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Titre, date, lieu, organisateur -->
          <div class="flex min-w-0 flex-1 flex-col justify-center gap-3 border-b border-tikeo-border pb-5 md:border-b-0 md:pb-0">
            <div class="min-w-0">
              <span v-if="event.category" class="mb-2 inline-block bg-tikeo-orange px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">{{ event.category }}</span>
              <h1 class="text-xl font-extrabold uppercase leading-tight text-tikeo-black md:text-3xl">{{ event.title }}</h1>
              <div class="mt-2.5 flex items-center gap-1.5 text-sm text-tikeo-gray-text">
                <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3M16 7V3M3.5 9h17M4 5h16a1 1 0 011 1v13a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z" /></svg>
                <span class="capitalize">{{ formattedDate }}</span> | {{ formattedTime }}
              </div>
              <div class="mt-1 flex items-center gap-1.5 text-sm text-tikeo-gray-text">
                <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M17 9V7a5 5 0 00-10 0v2M5 9h14l-1 12H6L5 9z" /></svg>
                <span v-if="event.locationName">{{ event.locationName }}, </span>{{ event.address ? event.address + ', ' : '' }}{{ event.city }}<span v-if="event.country">, {{ event.country }}</span>
              </div>
            </div>

            <div v-if="event.organizerName" class="flex shrink-0 items-center gap-2.5">
              <span v-if="!event.organizerLogo" class="flex h-9 w-9 shrink-0 items-center justify-center bg-tikeo-brand text-xs font-bold text-white">
                {{ event.organizerName.slice(0, 2).toUpperCase() }}
              </span>
              <img v-else :src="event.organizerLogo" :alt="event.organizerName" class="h-9 w-9 shrink-0 object-cover" />
              <div class="flex items-center gap-1.5">
                <p class="text-sm font-semibold uppercase text-tikeo-orange">{{ event.organizerName }}</p>
                <svg v-if="event.verified" class="h-4 w-4 shrink-0 text-tikeo-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" :aria-label="t('home.verified')">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <button type="button" class="shrink-0 bg-tikeo-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-tikeo-black/80">{{ t('home.subscribe') }}</button>
            </div>

            <!-- Partage explicite (cahier des charges §35 : WhatsApp | Facebook | Copier le lien) -->
            <div class="flex items-center gap-3 text-xs font-semibold text-tikeo-gray-text">
              <span>{{ t('event.share') }} :</span>
              <a :href="whatsappShareUrl" target="_blank" rel="noopener" class="text-tikeo-black hover:text-tikeo-orange">WhatsApp</a>
              <span class="text-tikeo-border">|</span>
              <a :href="facebookShareUrl" target="_blank" rel="noopener" class="text-tikeo-black hover:text-tikeo-orange">Facebook</a>
              <span class="text-tikeo-border">|</span>
              <button type="button" class="relative text-tikeo-black hover:text-tikeo-orange" @click="handleShare">
                {{ t('event.shareCopy') }}
                <span v-if="shareCopied" class="absolute -bottom-6 left-0 whitespace-nowrap bg-tikeo-black px-2 py-1 text-[11px] font-medium normal-case text-tikeo-surface">{{ t('event.shareCopied') }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="mx-auto max-w-tikeo-container px-4 py-5 md:px-6 md:py-6">
        <!-- Onglets -->
        <div class="flex border-b border-tikeo-border">
          <button
            type="button"
            class="border-b-2 px-4 py-3 text-sm font-semibold transition"
            :class="activeTab === 'tickets' ? 'border-tikeo-orange text-tikeo-orange' : 'border-transparent text-tikeo-gray-text hover:text-tikeo-black'"
            @click="activeTab = 'tickets'"
          >
            {{ t('event.ticketsTab') }}
          </button>
          <button
            type="button"
            class="border-b-2 px-4 py-3 text-sm font-semibold transition"
            :class="activeTab === 'details' ? 'border-tikeo-orange text-tikeo-orange' : 'border-transparent text-tikeo-gray-text hover:text-tikeo-black'"
            @click="activeTab = 'details'"
          >
            {{ t('event.detailsTab') }}
          </button>
        </div>

        <div class="gap-8 pt-6 md:grid md:grid-cols-[1fr_360px]">
          <!-- Colonne principale : contenu de l'onglet actif -->
          <div class="space-y-4">
            <!-- Onglet Tickets -->
            <template v-if="activeTab === 'tickets'">
              <button
                v-if="event.seatingPlanUrl"
                type="button"
                class="mb-1 inline-flex items-center gap-1.5 border border-tikeo-orange px-3 py-1.5 text-xs font-semibold text-tikeo-orange hover:bg-tikeo-orange/10"
                @click="seatingPlanOpen = true"
              >
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.5-2.5v-13L9 7m0 13l6-2.5m-6 2.5V7m6 10.5l5.5 2.5v-13L15 4m0 13.5V4m0 0L9 7" /></svg>
                {{ t('event.seatingPlan') }}
              </button>

              <p v-if="!hasAvailableTickets" class="card p-6 text-center text-sm text-tikeo-gray-text">{{ t('event.noTickets') }}</p>

              <div v-else v-for="tt in event.ticketTypes" :key="tt.id" class="card flex items-center justify-between gap-4 p-4 md:p-5">
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <h3 class="text-sm font-bold uppercase tracking-tight text-tikeo-black md:text-base">{{ tt.name }}</h3>
                    <span v-if="tt.soldOut" class="bg-tikeo-error/10 px-2 py-0.5 text-[11px] font-semibold uppercase text-tikeo-error">{{ t('event.soldOut') }}</span>
                    <span v-else-if="isHighDemand(tt)" class="bg-tikeo-orange/10 px-2 py-0.5 text-[11px] font-semibold uppercase text-tikeo-orange">{{ t('event.highDemand') }}</span>
                  </div>
                  <p class="mt-1.5 text-sm font-semibold text-tikeo-black md:text-base">{{ formatPrice(tt.price) }}</p>
                  <button
                    v-if="tt.description"
                    type="button"
                    class="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-tikeo-orange"
                    @click="toggleTicketDetails(tt.id)"
                  >
                    {{ expandedTicketDetails[tt.id] ? t('event.hideTicketDetails') : t('event.ticketDetails') }}
                    <svg class="h-3.5 w-3.5 transition" :class="expandedTicketDetails[tt.id] ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6" /></svg>
                  </button>
                  <p v-if="expandedTicketDetails[tt.id] && tt.description" class="mt-2 whitespace-pre-line text-xs leading-relaxed text-tikeo-gray-text">{{ tt.description }}</p>
                  <p v-if="!tt.soldOut && tt.remaining !== null && tt.remaining <= 10" class="mt-1 text-xs text-tikeo-orange">{{ t('event.remaining', { n: tt.remaining }) }}</p>
                </div>

                <div class="flex shrink-0 items-center gap-2">
                  <button type="button" class="flex h-8 w-8 items-center justify-center border border-tikeo-border text-tikeo-black disabled:opacity-30" :disabled="(quantities[tt.id] ?? 0) === 0" @click="decrement(tt.id)">−</button>
                  <span class="w-5 text-center text-sm font-semibold text-tikeo-black">{{ quantities[tt.id] ?? 0 }}</span>
                  <button type="button" class="flex h-8 w-8 items-center justify-center border border-tikeo-border text-tikeo-black disabled:opacity-30" :disabled="tt.soldOut" @click="increment(tt.id)">+</button>
                </div>
              </div>
            </template>

            <!-- Onglet Détails -->
            <template v-else>
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="card flex items-start gap-3 p-4">
                  <span class="flex h-10 w-10 shrink-0 items-center justify-center bg-tikeo-orange/10 text-tikeo-orange">
                    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3M16 7V3M3.5 9h17M4 5h16a1 1 0 011 1v13a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z" /></svg>
                  </span>
                  <div class="min-w-0">
                    <p class="text-xs font-semibold uppercase tracking-wide text-tikeo-gray-text">{{ t('event.dateLabel') }}</p>
                    <p class="text-sm font-medium capitalize text-tikeo-black">{{ formattedDate }}</p>
                    <p class="text-sm text-tikeo-gray-text">{{ formattedTime }}</p>
                  </div>
                </div>

                <div class="card flex items-start gap-3 p-4">
                  <span class="flex h-10 w-10 shrink-0 items-center justify-center bg-tikeo-blue/10 text-tikeo-blue">
                    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M17 9V7a5 5 0 00-10 0v2M5 9h14l-1 12H6L5 9z" /></svg>
                  </span>
                  <div class="min-w-0">
                    <p class="text-xs font-semibold uppercase tracking-wide text-tikeo-gray-text">{{ t('event.locationLabel') }}</p>
                    <p v-if="event.locationName" class="truncate text-sm font-medium text-tikeo-black">{{ event.locationName }}</p>
                    <p class="truncate text-sm text-tikeo-gray-text">{{ event.address ? event.address + ', ' : '' }}{{ event.city }}<span v-if="event.country">, {{ event.country }}</span></p>
                  </div>
                </div>
              </div>

              <div v-if="event.organizerName" class="card flex items-center gap-3 p-4">
                <span v-if="!event.organizerLogo" class="flex h-11 w-11 shrink-0 items-center justify-center bg-tikeo-brand text-sm font-bold text-white">
                  {{ event.organizerName.slice(0, 2).toUpperCase() }}
                </span>
                <img v-else :src="event.organizerLogo" :alt="event.organizerName" class="h-11 w-11 shrink-0 object-cover" />
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <p class="truncate text-sm font-semibold text-tikeo-black">{{ event.organizerName }}</p>
                    <svg v-if="event.verified" class="h-4 w-4 shrink-0 text-tikeo-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" :aria-label="t('home.verified')">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p class="text-xs text-tikeo-gray-text">{{ t('event.organizerLabel') }}</p>
                </div>
              </div>

              <div v-if="event.description" class="card p-4 md:p-5">
                <h2 class="mb-2 text-sm font-semibold text-tikeo-black">{{ t('event.descriptionLabel') }}</h2>
                <p class="whitespace-pre-line text-sm leading-relaxed text-tikeo-gray-text">{{ descriptionPreview }}</p>
                <button
                  v-if="descriptionIsLong"
                  type="button"
                  class="mt-2 text-xs font-semibold text-tikeo-orange"
                  @click="descriptionExpanded = !descriptionExpanded"
                >
                  {{ descriptionExpanded ? t('event.readLess') : t('event.readMore') }}
                </button>
              </div>
            </template>
          </div>

          <!-- Récapitulatif (desktop, sticky, visible sur les 2 onglets comme un panier persistant) -->
          <aside class="mt-6 hidden md:mt-0 md:block">
            <div class="card sticky top-20 p-4 md:p-5">
              <h2 class="mb-3 text-sm font-semibold text-tikeo-black">{{ t('event.summaryTitle') }}</h2>

              <p v-if="totalQuantity === 0" class="text-sm text-tikeo-gray-text">{{ t('event.selectToSeeSummary') }}</p>
              <template v-else>
                <div class="space-y-2.5">
                  <div v-for="line in cartLines" :key="line.ticketTypeId" class="flex items-center justify-between gap-3 text-sm">
                    <span class="min-w-0 truncate text-tikeo-black">{{ line.quantity }} × {{ line.name }}</span>
                    <span class="shrink-0 font-medium text-tikeo-black">{{ formatPrice(line.unitPrice * line.quantity) }}</span>
                  </div>
                </div>

                <div class="mt-4 flex items-center justify-between border-t border-tikeo-border pt-3 text-sm">
                  <span class="font-medium text-tikeo-gray-text">{{ t('event.total') }}</span>
                  <span class="font-bold text-tikeo-black">{{ formatPrice(totalPrice) }}</span>
                </div>

                <p v-if="orderError" class="mt-2 text-xs font-medium text-tikeo-error">{{ orderError }}</p>

                <button
                  type="button"
                  class="btn-primary mt-3 w-full"
                  :disabled="totalQuantity === 0 || submitting"
                  @click="handleReserve"
                >
                  <span v-if="submitting">{{ t('event.reserving') }}</span>
                  <span v-else-if="!isAuthenticated">{{ t('event.loginToBook') }}</span>
                  <span v-else>{{ t('event.reserveButton') }}</span>
                </button>
              </template>
            </div>
          </aside>
        </div>
      </div>

      <!-- Barre sticky mobile -->
      <div v-if="hasAvailableTickets && !orderResult" class="sticky bottom-0 z-30 flex items-center justify-between gap-3 border-t border-tikeo-border bg-tikeo-surface px-4 py-3 md:hidden">
        <div>
          <p class="text-xs text-tikeo-gray-text">{{ t('event.total') }}</p>
          <p class="text-sm font-bold text-tikeo-black">{{ formatPrice(totalPrice) }}</p>
        </div>
        <button type="button" class="btn-primary !px-6" :disabled="totalQuantity === 0 || submitting" @click="handleReserve">
          <span v-if="submitting">{{ t('event.reserving') }}</span>
          <span v-else-if="!isAuthenticated">{{ t('event.loginToBook') }}</span>
          <span v-else>{{ t('event.reserveButton') }}</span>
        </button>
      </div>
      <p v-if="orderError" class="px-4 pb-3 text-xs font-medium text-tikeo-error md:hidden">{{ orderError }}</p>

      <!-- Plan de salle -->
      <Transition
        enter-active-class="transition-opacity duration-150"
        leave-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div v-if="seatingPlanOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" @click.self="seatingPlanOpen = false">
          <div class="max-h-[90vh] w-full max-w-2xl overflow-auto bg-tikeo-surface">
            <div class="flex items-center justify-between border-b border-tikeo-border p-3">
              <p class="text-sm font-semibold text-tikeo-black">{{ t('event.seatingPlan') }}</p>
              <button type="button" class="flex h-8 w-8 items-center justify-center text-tikeo-gray-text hover:text-tikeo-black" :aria-label="t('event.close')" @click="seatingPlanOpen = false">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div class="p-4">
              <img v-if="seatingPlanIsImage" :src="event.seatingPlanUrl!" :alt="t('event.seatingPlan')" class="w-full object-contain" />
              <div v-else class="flex flex-col items-center gap-3 py-8 text-center">
                <p class="text-sm text-tikeo-gray-text">{{ t('event.seatingPlanExternal') }}</p>
                <a :href="event.seatingPlanUrl!" target="_blank" rel="noopener" class="btn-primary">{{ t('event.seatingPlanOpen') }}</a>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Confirmation de commande -->
      <Transition
        enter-active-class="transition-opacity duration-150"
        leave-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div v-if="orderResult" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div class="w-full max-w-sm bg-tikeo-surface p-6 text-center">
            <span class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-tikeo-success/10 text-tikeo-success">
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
            </span>
            <h2 class="text-base font-bold text-tikeo-black">{{ t('event.orderSuccessTitle') }}</h2>
            <p class="mt-1 text-sm text-tikeo-gray-text">{{ t('event.orderSuccessDesc') }}</p>
            <div class="mt-3 border border-dashed border-tikeo-border p-3 text-sm">
              <p class="text-tikeo-gray-text">{{ t('event.orderNumber') }}</p>
              <p class="font-mono font-semibold text-tikeo-black">{{ orderResult.orderNumber }}</p>
              <p class="mt-1 font-semibold text-tikeo-black">{{ formatPrice(orderResult.total) }}</p>
            </div>
            <NuxtLink to="/" class="btn-primary mt-4 block w-full" @click="orderResult = null">{{ t('event.backHome') }}</NuxtLink>
          </div>
        </div>
      </Transition>
    </template>
  </div>
</template>
