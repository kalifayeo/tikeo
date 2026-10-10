<script setup lang="ts">
import type { CartLine } from '~/composables/useEventDetail'

const { t, te, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const slug = route.params.slug as string

const { event, loading, notFound, error, refresh } = useEventDetail(slug)
const { isAuthenticated, user } = useAuth()
const { isFavorite, toggleFavorite } = useFavorites()
const { submitting, errorCode, errorLimit, createOrder } = useEventOrder()
const { filters: homeFilters } = useHomeFilters()

// --- Code promo (facultatif, appliqué à la création de la commande) ---------
const promoCodeInput = ref('')
const { checking: promoChecking, preview: promoPreview, check: checkPromo, clear: clearPromo } = usePromoPreview()
let promoCheckTimer: ReturnType<typeof setTimeout> | null = null
watch(promoCodeInput, (val) => {
  if (promoCheckTimer) clearTimeout(promoCheckTimer)
  if (!val.trim() || !event.value) {
    clearPromo()
    return
  }
  promoCheckTimer = setTimeout(() => checkPromo(event.value!.id, val), 500)
})
const promoDiscountPreviewLabel = computed(() => {
  if (!promoPreview.value?.valid) return null
  return promoPreview.value.discount_type === 'percent'
    ? `-${promoPreview.value.discount_value}%`
    : `-${promoPreview.value.discount_value} FCFA`
})

// --- Liste d'attente (types de billets épuisés) -----------------------------
const { submitting: joiningWaitlist, errorCode: waitlistErrorCode, join: joinWaitlist } = useWaitlistJoin()
const waitlistCounts = ref<Record<string, number>>({})
const waitlistJoinedIds = ref<Set<string>>(new Set())

watch(
  event,
  async (e) => {
    if (!e) return
    for (const tt of e.ticketTypes.filter((t) => t.soldOut)) {
      waitlistCounts.value[tt.id] = await fetchWaitlistCount(tt.id)
    }
  },
  { immediate: true }
)

async function handleJoinWaitlist(ticketTypeId: string) {
  if (!isAuthenticated.value) {
    router.push(`/connexion?redirect=${encodeURIComponent(route.fullPath)}`)
    return
  }
  const entry = await joinWaitlist(ticketTypeId, 1)
  if (entry) {
    waitlistJoinedIds.value.add(ticketTypeId)
    waitlistCounts.value[ticketTypeId] = (waitlistCounts.value[ticketTypeId] ?? 0) + 1
  }
}

// --- Avis --------------------------------------------------------------------
const eventIdRef = computed(() => event.value?.id ?? null)
const { reviews, stats: reviewStats } = useEventReviews(eventIdRef)
const { myReview, canReview, submitting: reviewSubmitting, errorMessage: reviewError, submit: submitReview } = useMyEventReview(eventIdRef)
const reviewDraftRating = ref(5)
const reviewDraftComment = ref('')
watch(myReview, (r) => {
  if (r) {
    reviewDraftRating.value = r.rating
    reviewDraftComment.value = r.comment || ''
  }
})
async function handleSubmitReview() {
  const ok = await submitReview(reviewDraftRating.value, reviewDraftComment.value)
  if (ok) reviewDraftComment.value = reviewDraftComment.value.trim()
}
const hasReviews = computed(() => !!reviewStats.value && reviewStats.value.review_count > 0)

// --- Plan de salle (optionnel, renseigné par l'organisateur) ---
const seatingPlanOpen = ref(false)
const seatingPlanIsImage = computed(() => /\.(png|jpe?g|webp|gif|avif)$/i.test(event.value?.seatingPlanUrl ?? ''))

// --- Description repliée au-delà d'une certaine longueur ---
const descriptionExpanded = ref(false)
const descriptionIsLong = computed(() => (event.value?.description?.length ?? 0) > 520)
const descriptionPreview = computed(() => {
  const d = event.value?.description ?? ''
  if (!descriptionIsLong.value || descriptionExpanded.value) return d
  return d.slice(0, 520).trimEnd() + '…'
})

// --- Détails de chaque type de billet, repliés par défaut ---
const expandedTicketDetails = ref<Record<string, boolean>>({})
function toggleTicketDetails(ticketTypeId: string) {
  expandedTicketDetails.value[ticketTypeId] = !expandedTicketDetails.value[ticketTypeId]
}

// --- Sélection de billets ---
const quantities = ref<Record<string, number>>({})
// Champ « code promo » de la barre mobile (replié tant qu'on n'en a pas besoin)
const showMobilePromo = ref(false)

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
  let cap = tt.remaining === null ? current + 1 : Math.min(tt.remaining, 10)
  // Limite globale de billets par acheteur pour cet événement (tous types
  // confondus), fixée par l'organisateur à la publication — voir
  // event.maxTicketsPerBuyer. Revalidée de toute façon en base (create_order).
  const maxPerBuyer = event.value?.maxTicketsPerBuyer
  if (maxPerBuyer != null) {
    const remainingAllowance = maxPerBuyer - totalQuantity.value
    cap = Math.min(cap, current + Math.max(remainingAllowance, 0))
  }
  if (current < cap) quantities.value[ticketTypeId] = current + 1
}

function decrement(ticketTypeId: string) {
  const current = quantities.value[ticketTypeId] ?? 0
  if (current > 0) quantities.value[ticketTypeId] = current - 1
}

// Un type de billet est signalé « Forte demande » quand son stock restant
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

// Stock restant, tous types confondus (null si un type est illimité) — alimente le badge d'urgence.
const totalRemaining = computed<number | null>(() => {
  const types = event.value?.ticketTypes ?? []
  if (!types.length || types.some((tt) => tt.remaining === null)) return null
  return types.reduce((sum, tt) => sum + (tt.remaining ?? 0), 0)
})
const allSoldOut = computed(() => {
  const types = event.value?.ticketTypes ?? []
  return types.length > 0 && types.every((tt) => tt.soldOut)
})
const calendarLocation = computed(() =>
  [event.value?.locationName, event.value?.address, event.value?.city, event.value?.country].filter(Boolean).join(', ')
)

// Prix « à partir de » : le moins cher parmi les billets encore disponibles.
const minPrice = computed<number | null>(() => {
  const types = event.value?.ticketTypes ?? []
  if (!types.length) return null
  const pool = types.filter((tt) => !tt.soldOut)
  return Math.min(...(pool.length ? pool : types).map((tt) => tt.price))
})

function formatPrice(n: number) {
  return n === 0 ? t('event.free') : `${n.toLocaleString('fr-FR')} FCFA`
}

// --- Dates (dans la langue de l'interface) ---
const startDateObj = computed(() => (event.value ? new Date(event.value.startDate) : null))
const formattedDate = computed(() =>
  startDateObj.value ? startDateObj.value.toLocaleDateString(locale.value, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : ''
)
const formattedTime = computed(() =>
  startDateObj.value ? startDateObj.value.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' }) : ''
)
const dateParts = computed(() => {
  const d = startDateObj.value
  if (!d) return { weekday: '', day: '', month: '' }
  return {
    weekday: d.toLocaleDateString(locale.value, { weekday: 'short' }).replace('.', ''),
    day: String(d.getDate()).padStart(2, '0'),
    month: d.toLocaleDateString(locale.value, { month: 'short' }).replace('.', ''),
  }
})

// --- Lieu ---
const placeLine = computed(() =>
  [event.value?.address, event.value?.city, event.value?.country].filter(Boolean).join(', ')
)
const directionsUrl = computed(() => {
  const e = event.value
  if (!e) return ''
  const query = e.latitude != null && e.longitude != null ? `${e.latitude},${e.longitude}` : calendarLocation.value
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
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
// Lien partagé : le raccourci himra.tikeo.com (ou /e/himra en secours, cf. §16).
const canonicalEventUrl = computed(() => (event.value ? buildEventUrl({ slug: event.value.slug }).url : ''))
// Lien indexé par Google : UNE seule URL par événement (évite le contenu
// dupliqué entre himra.tikeo.com et tikeo.com/e/himra).
const siteOrigin = useSiteOrigin()
const indexedEventUrl = computed(() => (event.value ? `${siteOrigin}/e/${encodeURIComponent(event.value.slug)}` : ''))

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

// --- Navigation dans la page ---
const sections = computed(() => {
  const list: { id: string; label: string; icon: string }[] = [{ id: 'billets', label: t('event.ticketsLabel'), icon: 'ticket' }]
  if (event.value?.description || event.value?.organizerName) list.push({ id: 'apropos', label: t('event.navAbout'), icon: 'info' })
  list.push({ id: 'lieu', label: t('event.navVenue'), icon: 'pin' })
  list.push({ id: 'avis', label: t('event.navReviews'), icon: 'heart' })
  return list
})

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function goBack() {
  if (typeof window !== 'undefined' && window.history.length > 1) router.back()
  else router.push('/')
}

function goCategory(name: string) {
  homeFilters.value = { ...homeFilters.value, category: name }
  router.push('/evenements')
}

// --- Barre de réservation mobile : se retire quand on arrive au pied de page ---
const endSentinel = ref<HTMLElement | null>(null)
const nearEnd = ref(false)
let endObserver: IntersectionObserver | null = null
watch(
  endSentinel,
  (el) => {
    endObserver?.disconnect()
    endObserver = null
    if (!el || typeof IntersectionObserver === 'undefined') return
    endObserver = new IntersectionObserver(([entry]) => (nearEnd.value = entry.isIntersecting))
    endObserver.observe(el)
  },
  { flush: 'post' }
)
onBeforeUnmount(() => {
  endObserver?.disconnect()
  if (promoCheckTimer) clearTimeout(promoCheckTimer)
})
const showMobileBar = computed(() => hasAvailableTickets.value && !allSoldOut.value && !nearEnd.value)

// --- Réservation ---
// Le paiement réel (§24-26) se passe désormais sur /commande/[id] : cette
// page ne fait plus que réserver le stock puis y rediriger l'acheteur.
const orderError = ref<string | null>(null)

async function handleReserve() {
  orderError.value = null
  if (!isAuthenticated.value || !user.value) {
    router.push({ path: '/connexion', query: { redirect: route.fullPath } })
    return
  }
  if (!event.value || cartLines.value.length === 0) return

  // Seuls l'événement et les quantités partent au serveur : les prix, le stock
  // et le statut sont revalidés en base (voir server/api/orders.post.ts).
  const order = await createOrder(event.value.id, cartLines.value, promoPreview.value?.valid ? promoCodeInput.value : null)
  if (order) {
    router.push(`/commande/${order.id}`)
    return
  }

  const code = errorCode.value ?? 'ORDER_FAILED'
  orderError.value = te(`event.orderErrors.${code}`) ? t(`event.orderErrors.${code}`, { n: errorLimit.value ?? '' }) : t('event.orderError')
  // Stock, fenêtre de vente ou statut changés depuis l'ouverture de la page : on rafraîchit.
  if (['SOLD_OUT', 'TICKET_NOT_AVAILABLE', 'SALE_NOT_OPEN', 'SALE_CLOSED', 'EVENT_NOT_AVAILABLE'].includes(code)) {
    refresh()
  }
}

// --- SEO & aperçus de partage (cahier des charges §36) ---------------------
// Ces balises sont présentes dans le HTML servi (rendu serveur) : c'est ce que
// lisent WhatsApp, Facebook, X et Google quand himra.tikeo.com est partagé.
const seoDescription = computed(() => {
  const d = event.value?.description?.replace(/\s+/g, ' ').trim()
  return d ? d.slice(0, 160) : "Découvrez et achetez vos billets sur Tikeo."
})
const seoImage = computed(() => toAbsoluteUrl(event.value?.coverImage, siteOrigin))

useSeoMeta({
  title: () => (event.value ? `${event.value.title} — Tikeo` : 'Événement — Tikeo'),
  description: () => seoDescription.value,
  ogTitle: () => event.value?.title,
  ogDescription: () => seoDescription.value,
  ogImage: () => seoImage.value,
  ogImageAlt: () => event.value?.title,
  ogUrl: () => indexedEventUrl.value || undefined,
  ogType: 'website',
  twitterTitle: () => event.value?.title,
  twitterDescription: () => seoDescription.value,
  twitterImage: () => seoImage.value,
  robots: () => (notFound.value ? 'noindex, nofollow' : 'index, follow'),
})

// Données structurées schema.org/Event (résultats enrichis Google).
const structuredData = computed(() => {
  const e = event.value
  if (!e) return null
  const prices = e.ticketTypes.map((tt) => tt.price)
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.title,
    description: seoDescription.value,
    startDate: e.startDate,
    ...(e.endDate ? { endDate: e.endDate } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: seoImage.value ? [seoImage.value] : undefined,
    url: indexedEventUrl.value,
    location: {
      '@type': 'Place',
      name: e.locationName || e.city,
      address: {
        '@type': 'PostalAddress',
        streetAddress: e.address || undefined,
        addressLocality: e.city || undefined,
        addressCountry: e.country || undefined,
      },
    },
    ...(e.organizerName ? { organizer: { '@type': 'Organization', name: e.organizerName } } : {}),
    ...(prices.length
      ? {
          offers: e.ticketTypes.map((tt) => ({
            '@type': 'Offer',
            name: tt.name,
            price: tt.price,
            priceCurrency: 'XOF',
            availability: tt.soldOut ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
            url: indexedEventUrl.value,
          })),
        }
      : {}),
  }
})

useHead({
  link: [{ rel: 'canonical', href: () => indexedEventUrl.value || undefined }],
  script: [
    {
      type: 'application/ld+json',
      // Le caractère « < » est échappé : une description ne peut pas refermer la balise script.
      innerHTML: () => (structuredData.value ? JSON.stringify(structuredData.value).replace(/</g, '\\u003c') : undefined),
    },
  ],
})

// Styles partagés
const h2Class = 'font-display text-2xl font-extrabold tracking-tight text-tikeo-black md:text-3xl'
const pill =
  'flex h-11 shrink-0 items-center gap-2 border border-tikeo-border bg-tikeo-surface px-4 text-sm font-semibold text-tikeo-black transition-colors duration-200 hover:border-tikeo-ink active:scale-[0.97] dark:hover:border-tikeo-orange'
const stepBtn =
  'flex h-10 w-10 items-center justify-center border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-30'
</script>

<template>
  <div>
    <!-- ============================ Chargement ============================ -->
    <div v-if="loading">
      <div class="bg-tikeo-ink">
        <div class="mx-auto grid max-w-tikeo-container gap-6 px-4 py-8 md:px-6 md:py-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14">
          <div class="aspect-[16/10] animate-pulse bg-tikeo-ink-soft lg:aspect-auto lg:min-h-[26rem]" />
          <div class="space-y-4">
            <div class="h-6 w-24 animate-pulse bg-tikeo-ink-soft" />
            <div class="h-12 w-4/5 animate-pulse bg-tikeo-ink-soft" />
            <div class="h-16 w-full animate-pulse bg-tikeo-ink-soft" />
            <div class="h-16 w-full animate-pulse bg-tikeo-ink-soft" />
          </div>
        </div>
      </div>
      <div class="mx-auto grid max-w-tikeo-container gap-8 px-4 py-8 md:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div class="space-y-4">
          <div class="h-8 w-56 animate-pulse bg-tikeo-border" />
          <div class="h-28 w-full animate-pulse bg-tikeo-border" />
          <div class="h-28 w-full animate-pulse bg-tikeo-border" />
        </div>
        <div class="hidden h-64 animate-pulse bg-tikeo-border lg:block" />
      </div>
    </div>

    <!-- ============================ Introuvable ============================ -->
    <div v-else-if="notFound || error" class="mx-auto flex max-w-2xl flex-col items-center gap-3 px-6 py-24 text-center">
      <img src="/logo-tikeo.png" alt="Tikeo" class="h-10 w-auto" />
      <h1 class="mt-3 font-display text-2xl font-extrabold text-tikeo-black md:text-3xl">{{ t('event.notFoundTitle') }}</h1>
      <p class="text-sm text-tikeo-gray-text">{{ t('event.notFoundDesc') }}</p>
      <NuxtLink to="/" class="btn-ink mt-3 !h-12 !px-7">{{ t('event.backHome') }}</NuxtLink>
    </div>

    <!-- ============================ Contenu ============================ -->
    <template v-else-if="event">
      <!-- ============ HERO : même univers que l'accueil (fond encre, affiche, infos) ============ -->
      <section class="relative isolate overflow-hidden bg-tikeo-ink text-white">
        <!-- Affiche floutée en toile de fond -->
        <img :src="event.coverImage" alt="" aria-hidden="true" class="absolute inset-0 -z-10 h-full w-full scale-125 object-cover opacity-25 blur-2xl" />
        <div class="absolute inset-0 -z-10 bg-gradient-to-b from-tikeo-ink/70 via-tikeo-ink/85 to-tikeo-ink" aria-hidden="true" />

        <!-- Trame de points : rappelle la perforation d'un billet -->
        <div
          class="pointer-events-none absolute inset-y-0 left-0 hidden w-3 lg:block"
          style="background-image: radial-gradient(circle, rgb(243 245 249) 3px, transparent 3.5px); background-size: 12px 18px; background-position: -6px 0"
          aria-hidden="true"
        />

        <div class="mx-auto max-w-tikeo-container px-4 pb-8 pt-4 md:px-6 md:pb-12 md:pt-6 lg:pb-14">
          <!-- Retour (mobile) / fil d'Ariane (desktop) -->
          <div class="mb-4 md:mb-6">
            <button type="button" class="flex h-10 items-center gap-1.5 bg-white/10 pl-2.5 pr-4 text-sm font-semibold text-white backdrop-blur-sm transition-colors active:bg-white active:text-tikeo-ink md:hidden" @click="goBack">
              <AppIcon name="chevron-left" class="h-4 w-4" :stroke="2.4" />
              {{ t('common.back') }}
            </button>
            <nav class="hidden items-center gap-2 text-sm text-white/65 md:flex" aria-label="Fil d'Ariane">
              <NuxtLink to="/" class="transition-colors hover:text-white">{{ t('nav.home') }}</NuxtLink>
              <AppIcon name="chevron-right" class="h-3.5 w-3.5 shrink-0" :stroke="2.4" />
              <template v-if="event.category">
                <button type="button" class="transition-colors hover:text-white" @click="goCategory(event.category!)">{{ event.category }}</button>
                <AppIcon name="chevron-right" class="h-3.5 w-3.5 shrink-0" :stroke="2.4" />
              </template>
              <span class="max-w-md truncate font-semibold text-white">{{ event.title }}</span>
            </nav>
          </div>

          <div class="grid gap-6 md:gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-stretch lg:gap-14">
            <!-- Affiche -->
            <div class="relative aspect-[16/10] overflow-hidden bg-tikeo-ink-soft shadow-card-hover sm:aspect-[16/9] lg:aspect-auto lg:min-h-[28rem]">
              <img :src="event.coverImage" :alt="event.title" fetchpriority="high" decoding="async" class="absolute inset-0 h-full w-full object-cover" />
              <div class="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" aria-hidden="true" />

              <!-- Talon de date -->
              <div class="absolute left-4 top-4 flex min-w-[3.4rem] flex-col items-center bg-white px-3 py-2 leading-none text-tikeo-ink shadow-sm">
                <span class="text-[11px] font-semibold capitalize text-tikeo-ink/70">{{ dateParts.weekday }}</span>
                <span class="mt-1 font-display text-3xl font-extrabold">{{ dateParts.day }}</span>
                <span class="mt-0.5 text-xs font-semibold capitalize text-tikeo-ink/70">{{ dateParts.month }}</span>
              </div>

              <!-- Favori -->
              <button
                type="button"
                class="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-tikeo-ink shadow-sm transition-transform active:scale-90"
                :aria-pressed="isFavorite(event.id)"
                :aria-label="isFavorite(event.id) ? t('home.removeFavorite') : t('event.favorite')"
                @click="handleFavoriteClick"
              >
                <svg class="h-5 w-5" :class="isFavorite(event.id) ? 'fill-[#FF7A00] text-[#FF7A00]' : 'fill-none'" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 21s-7.5-4.6-10-9.1C.5 8.6 2.3 5 6 5c2 0 3.4 1.1 4 2.2C10.6 6.1 12 5 14 5c3.7 0 5.5 3.6 4 6.9-2.5 4.5-10 9.1-10 9.1z" />
                </svg>
              </button>
            </div>

            <!-- Informations -->
            <div class="flex min-w-0 flex-col justify-center gap-5">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <span v-if="event.category" class="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">{{ event.category }}</span>
                  <span v-if="event.verified" class="inline-flex items-center gap-1 rounded-full bg-[#FF7A00] px-3 py-1 text-xs font-bold text-tikeo-ink">
                    <AppIcon name="check" class="h-3.5 w-3.5" :stroke="3" />{{ t('home.verified') }}
                  </span>
                </div>
                <h1 class="mt-3 font-display text-[2rem] font-extrabold leading-[1.05] tracking-tight sm:text-4xl lg:text-[3.25rem]">{{ event.title }}</h1>
                <button v-if="hasReviews" type="button" class="mt-3 inline-flex items-center gap-2 text-sm text-white/85 hover:text-white" @click="scrollToSection('avis')">
                  <AppIcon name="star" class="h-4 w-4 fill-current text-[#FF9A3D]" />
                  <span class="font-bold">{{ reviewStats!.average_rating }}</span>
                  <span class="text-white/65 underline decoration-white/30 underline-offset-4">{{ t('event.reviewsCount', { n: reviewStats!.review_count }) }}</span>
                </button>
              </div>

              <!-- Date + lieu -->
              <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <li class="flex items-start gap-3 border border-white/15 bg-white/[0.06] p-3.5">
                  <span class="flex h-11 w-11 shrink-0 items-center justify-center bg-[#FF7A00] text-tikeo-ink"><AppIcon name="calendar" class="h-5 w-5" /></span>
                  <div class="min-w-0">
                    <p class="text-[11px] font-bold uppercase tracking-wider text-white/55">{{ t('event.dateLabel') }}</p>
                    <p class="font-semibold capitalize leading-snug">{{ formattedDate }}</p>
                    <p class="flex items-center gap-1.5 text-sm text-white/75"><AppIcon name="clock" class="h-3.5 w-3.5" />{{ formattedTime }}</p>
                  </div>
                </li>
                <li class="flex items-start gap-3 border border-white/15 bg-white/[0.06] p-3.5">
                  <span class="flex h-11 w-11 shrink-0 items-center justify-center bg-[#FF7A00] text-tikeo-ink"><AppIcon name="pin" class="h-5 w-5" /></span>
                  <div class="min-w-0">
                    <p class="text-[11px] font-bold uppercase tracking-wider text-white/55">{{ t('event.locationLabel') }}</p>
                    <p class="font-semibold leading-snug">{{ event.locationName || event.city }}</p>
                    <p class="break-words text-sm text-white/75">{{ placeLine }}</p>
                  </div>
                </li>
              </ul>

              <!-- Organisateur -->
              <div v-if="event.organizerName" class="flex items-center gap-3">
                <span v-if="!event.organizerLogo" class="flex h-10 w-10 shrink-0 items-center justify-center bg-white text-xs font-bold text-tikeo-ink">
                  {{ event.organizerName.slice(0, 2).toUpperCase() }}
                </span>
                <img v-else :src="event.organizerLogo" :alt="event.organizerName" loading="lazy" decoding="async" class="h-10 w-10 shrink-0 bg-white object-cover" />
                <p class="min-w-0 text-sm leading-tight text-white/65">
                  {{ t('home.publishedBy') }}
                  <span class="block truncate text-base font-bold text-white">{{ event.organizerName }}</span>
                </p>
              </div>

              <EventCountdown :start-date="event.startDate" :remaining="totalRemaining" :sold-out="allSoldOut" />

              <!-- Prix + actions -->
              <div class="flex flex-wrap items-center gap-3 border-t border-white/15 pt-5">
                <div v-if="minPrice !== null && !allSoldOut" class="mr-auto leading-tight">
                  <span class="block text-xs text-white/65">{{ t('home.from') }}</span>
                  <span class="font-display text-2xl font-extrabold md:text-3xl">
                    <template v-if="minPrice === 0">{{ t('home.free') }}</template>
                    <template v-else>{{ minPrice.toLocaleString('fr-FR') }} <span class="text-sm font-semibold">FCFA</span></template>
                  </span>
                </div>
                <button v-if="hasAvailableTickets" type="button" class="btn-brand !h-11 hover:!bg-white max-sm:flex-1" @click="scrollToSection('billets')">
                  {{ allSoldOut ? t('event.joinWaitlist') : t('event.selectTickets') }}
                  <AppIcon name="arrow-right" class="h-4 w-4" :stroke="2.4" />
                </button>
                <AddToCalendar
                  dark
                  :title="event.title"
                  :start-date="event.startDate"
                  :end-date="event.endDate"
                  :location="calendarLocation"
                  :description="event.description"
                  :url="canonicalEventUrl"
                />
              </div>

              <!-- Partage explicite (cahier des charges §35 : WhatsApp | Facebook | Copier le lien) -->
              <div class="flex flex-wrap items-center gap-2 text-sm">
                <span class="mr-1 text-xs font-bold uppercase tracking-wider text-white/55">{{ t('event.share') }}</span>
                <a :href="whatsappShareUrl" target="_blank" rel="noopener" class="flex h-10 items-center border border-white/25 px-3.5 font-semibold text-white transition-colors hover:bg-white hover:text-tikeo-ink">WhatsApp</a>
                <a :href="facebookShareUrl" target="_blank" rel="noopener" class="flex h-10 items-center border border-white/25 px-3.5 font-semibold text-white transition-colors hover:bg-white hover:text-tikeo-ink">Facebook</a>
                <button type="button" class="relative flex h-10 items-center gap-2 border border-white/25 px-3.5 font-semibold text-white transition-colors hover:bg-white hover:text-tikeo-ink" @click="handleShare">
                  <AppIcon :name="shareCopied ? 'check' : 'link'" class="h-4 w-4" :stroke="2" />
                  {{ shareCopied ? t('event.shareCopied') : t('event.shareCopy') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ============ Barre de sections (même gabarit que les catégories de l'accueil) ============ -->
      <nav class="border-b border-tikeo-border bg-tikeo-surface" :aria-label="t('event.navLabel')">
        <div class="mx-auto max-w-tikeo-container px-4 py-3.5 md:px-6">
          <div class="no-scrollbar flex gap-2 overflow-x-auto">
            <button v-for="s in sections" :key="s.id" type="button" :class="pill" @click="scrollToSection(s.id)">
              <AppIcon :name="s.icon" class="h-[18px] w-[18px]" />
              {{ s.label }}
            </button>
          </div>
        </div>
      </nav>

      <!-- ============ Corps ============ -->
      <div class="mx-auto max-w-tikeo-container px-4 pt-8 md:px-6 md:pt-12">
        <div class="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-10">
          <div class="min-w-0 space-y-12 md:space-y-16">
            <!-- ---------- Billets ---------- -->
            <section id="billets" class="scroll-mt-28">
              <div class="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div class="max-w-xl">
                  <h2 :class="h2Class">{{ t('event.chooseTickets') }}</h2>
                  <p class="mt-1.5 text-sm text-tikeo-gray-text md:text-base">{{ t('event.chooseTicketsSub') }}</p>
                </div>
                <button
                  v-if="event.seatingPlanUrl"
                  type="button"
                  class="inline-flex h-11 items-center gap-2 border border-tikeo-ink px-4 text-sm font-bold text-tikeo-black transition-colors hover:bg-tikeo-ink hover:text-white dark:border-[#FF7A00] dark:hover:bg-[#FF7A00] dark:hover:text-tikeo-ink"
                  @click="seatingPlanOpen = true"
                >
                  <AppIcon name="map" class="h-[18px] w-[18px]" />
                  {{ t('event.seatingPlan') }}
                </button>
              </div>

              <p v-if="event.maxTicketsPerBuyer" class="mb-4 flex items-center gap-2 border-l-4 border-[#FF7A00] bg-tikeo-surface px-4 py-2.5 text-sm text-tikeo-gray-text">
                <AppIcon name="info" class="h-4 w-4 shrink-0 text-tikeo-orange" />
                {{ t('event.maxTicketsPerBuyerNotice', { n: event.maxTicketsPerBuyer }) }}
              </p>

              <p v-if="!hasAvailableTickets" class="border border-dashed border-tikeo-border bg-tikeo-surface p-10 text-center text-sm text-tikeo-gray-text">{{ t('event.noTickets') }}</p>

              <div v-else class="space-y-4">
                <article
                  v-for="tt in event.ticketTypes"
                  :key="tt.id"
                  class="relative flex bg-tikeo-surface shadow-card transition-shadow duration-300 hover:shadow-card-hover"
                  :class="(quantities[tt.id] ?? 0) > 0 ? 'ring-2 ring-[#FF7A00]' : ''"
                >
                  <span class="w-1.5 shrink-0" :class="tt.soldOut ? 'bg-tikeo-border' : 'bg-[#FF7A00]'" aria-hidden="true" />

                  <!-- Corps du billet -->
                  <div class="min-w-0 flex-1 p-4 md:p-5">
                    <div class="flex flex-wrap items-center gap-2">
                      <span v-if="tt.soldOut" class="bg-tikeo-error/10 px-2 py-0.5 text-[11px] font-bold uppercase text-tikeo-error">{{ t('event.soldOut') }}</span>
                      <span v-else-if="isHighDemand(tt)" class="bg-[#FF7A00] px-2 py-0.5 text-[11px] font-bold uppercase text-tikeo-ink">{{ t('event.highDemand') }}</span>
                    </div>
                    <h3 class="mt-1 font-display text-lg font-bold leading-tight tracking-tight text-tikeo-black md:text-xl" :class="tt.soldOut ? 'opacity-60' : ''">{{ tt.name }}</h3>
                    <p class="mt-1.5 font-display text-2xl font-extrabold leading-none text-tikeo-black" :class="tt.soldOut ? 'opacity-60' : ''">
                      <template v-if="tt.price === 0">{{ t('event.free') }}</template>
                      <template v-else>{{ tt.price.toLocaleString('fr-FR') }} <span class="text-sm font-semibold text-tikeo-gray-text">FCFA</span></template>
                    </p>

                    <p v-if="!tt.soldOut && tt.remaining !== null && tt.remaining <= 10" class="mt-2 text-xs font-semibold text-tikeo-orange">{{ t('event.remaining', { n: tt.remaining }) }}</p>

                    <button
                      v-if="tt.description"
                      type="button"
                      class="mt-2 inline-flex items-center gap-1 text-xs font-bold text-tikeo-orange"
                      :aria-expanded="!!expandedTicketDetails[tt.id]"
                      @click="toggleTicketDetails(tt.id)"
                    >
                      {{ expandedTicketDetails[tt.id] ? t('event.hideTicketDetails') : t('event.ticketDetails') }}
                      <AppIcon name="chevron-down" class="h-3.5 w-3.5 transition-transform" :class="expandedTicketDetails[tt.id] ? 'rotate-180' : ''" :stroke="2.4" />
                    </button>
                    <p v-if="expandedTicketDetails[tt.id] && tt.description" class="mt-2 whitespace-pre-line text-sm leading-relaxed text-tikeo-gray-text">{{ tt.description }}</p>

                    <!-- Liste d'attente (billet épuisé) -->
                    <div v-if="tt.soldOut" class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <button
                        v-if="!waitlistJoinedIds.has(tt.id)"
                        type="button"
                        class="btn-secondary !h-10 !py-0 text-sm"
                        :disabled="joiningWaitlist"
                        @click="handleJoinWaitlist(tt.id)"
                      >
                        {{ t('event.joinWaitlist') }}
                      </button>
                      <span v-else class="inline-flex items-center gap-1.5 text-sm font-bold text-tikeo-success"><AppIcon name="check" class="h-4 w-4" :stroke="2.6" />{{ t('event.waitlistJoined') }}</span>
                      <span v-if="waitlistCounts[tt.id]" class="text-xs text-tikeo-gray-text">{{ t('event.waitlistCount', { n: waitlistCounts[tt.id] }) }}</span>
                      <span v-if="waitlistErrorCode" class="text-xs text-tikeo-error">{{ te(`event.waitlistErrors.${waitlistErrorCode}`) ? t(`event.waitlistErrors.${waitlistErrorCode}`) : '' }}</span>
                    </div>
                  </div>

                  <!-- Perforation + souche (sélecteur de quantité) -->
                  <template v-if="!tt.soldOut">
                    <div class="relative w-0 shrink-0" aria-hidden="true">
                      <span class="absolute -left-[11px] -top-[11px] h-[22px] w-[22px] rounded-full bg-tikeo-surface-alt" />
                      <span class="absolute -bottom-[11px] -left-[11px] h-[22px] w-[22px] rounded-full bg-tikeo-surface-alt" />
                      <span class="absolute inset-y-4 left-0 border-l-2 border-dashed border-tikeo-gray-text/35" />
                    </div>
                    <div class="flex w-[4.75rem] shrink-0 flex-col-reverse items-center justify-center gap-1 px-2 md:w-40 md:flex-row md:gap-1.5 md:px-4">
                      <button
                        type="button"
                        :class="[stepBtn, 'border-tikeo-border text-tikeo-black enabled:hover:border-tikeo-ink']"
                        :disabled="(quantities[tt.id] ?? 0) === 0"
                        :aria-label="'− ' + tt.name"
                        @click="decrement(tt.id)"
                      >
                        <AppIcon name="minus" class="h-4 w-4" :stroke="2.6" />
                      </button>
                      <span class="w-8 text-center font-display text-xl font-extrabold tabular-nums text-tikeo-black" aria-live="polite">{{ quantities[tt.id] ?? 0 }}</span>
                      <button
                        type="button"
                        :class="[stepBtn, 'border-tikeo-ink bg-tikeo-ink text-white enabled:hover:bg-[#FF7A00] enabled:hover:text-tikeo-ink enabled:hover:border-[#FF7A00] dark:border-[#FF7A00] dark:bg-[#FF7A00] dark:text-tikeo-ink']"
                        :aria-label="'+ ' + tt.name"
                        @click="increment(tt.id)"
                      >
                        <AppIcon name="plus" class="h-4 w-4" :stroke="2.6" />
                      </button>
                    </div>
                  </template>
                </article>
              </div>
            </section>

            <!-- ---------- À propos ---------- -->
            <section v-if="event.description || event.organizerName" id="apropos" class="scroll-mt-28">
              <h2 :class="h2Class">{{ t('event.descriptionLabel') }}</h2>

              <div v-if="event.description" class="mt-5 bg-tikeo-surface p-5 shadow-card md:p-7">
                <p class="whitespace-pre-line text-[15px] leading-[1.75] text-tikeo-gray-text md:text-base">{{ descriptionPreview }}</p>
                <button
                  v-if="descriptionIsLong"
                  type="button"
                  class="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-tikeo-black underline decoration-tikeo-orange decoration-2 underline-offset-[6px] hover:text-tikeo-orange"
                  @click="descriptionExpanded = !descriptionExpanded"
                >
                  {{ descriptionExpanded ? t('event.readLess') : t('event.readMore') }}
                </button>
              </div>

              <!-- Organisateur -->
              <div v-if="event.organizerName" class="mt-4 flex items-start gap-4 bg-tikeo-ink p-5 text-white md:items-center md:p-6">
                <span v-if="!event.organizerLogo" class="flex h-14 w-14 shrink-0 items-center justify-center bg-[#FF7A00] font-display text-lg font-extrabold text-tikeo-ink">
                  {{ event.organizerName.slice(0, 2).toUpperCase() }}
                </span>
                <img v-else :src="event.organizerLogo" :alt="event.organizerName" loading="lazy" decoding="async" class="h-14 w-14 shrink-0 bg-white object-cover" />
                <div class="min-w-0 flex-1">
                  <p class="text-[11px] font-bold uppercase tracking-wider text-white/55">{{ t('event.organizerLabel') }}</p>
                  <div class="flex items-center gap-2">
                    <p class="truncate font-display text-lg font-extrabold">{{ event.organizerName }}</p>
                    <AppIcon v-if="event.verified" name="shield-check" class="h-5 w-5 shrink-0 text-[#FF9A3D]" :aria-label="t('home.verified')" />
                  </div>
                  <p v-if="event.organizerDescription" class="mt-1 line-clamp-3 text-sm leading-relaxed text-white/70">{{ event.organizerDescription }}</p>
                </div>
              </div>
            </section>

            <!-- ---------- Lieu ---------- -->
            <section id="lieu" class="scroll-mt-28">
              <h2 :class="h2Class">{{ t('event.venueTitle') }}</h2>

              <div class="mt-5 overflow-hidden bg-tikeo-surface shadow-card">
                <div class="flex flex-wrap items-center gap-4 p-5 md:p-6">
                  <span class="flex h-12 w-12 shrink-0 items-center justify-center bg-tikeo-ink text-white dark:bg-[#FF7A00] dark:text-tikeo-ink"><AppIcon name="pin" class="h-6 w-6" /></span>
                  <div class="min-w-0 flex-1">
                    <p class="font-display text-lg font-bold leading-tight text-tikeo-black">{{ event.locationName || event.city }}</p>
                    <p class="mt-0.5 break-words text-sm text-tikeo-gray-text">{{ placeLine }}</p>
                  </div>
                  <a :href="directionsUrl" target="_blank" rel="noopener" class="btn-ink !h-11 max-sm:w-full">
                    {{ t('event.directions') }}
                    <AppIcon name="arrow-up-right" class="h-4 w-4" :stroke="2.4" />
                  </a>
                </div>
                <VenueMap
                  v-if="event.latitude != null && event.longitude != null"
                  class="!border-x-0 !border-b-0"
                  :latitude="event.latitude"
                  :longitude="event.longitude"
                  :label="event.locationName || event.title"
                />
              </div>
            </section>

            <!-- ---------- Avis ---------- -->
            <section id="avis" class="scroll-mt-28">
              <div class="flex flex-wrap items-end justify-between gap-3">
                <h2 :class="h2Class">{{ t('event.reviewsTitle') }}</h2>
                <p v-if="hasReviews" class="flex items-center gap-2">
                  <span class="font-display text-3xl font-extrabold text-tikeo-black">{{ reviewStats!.average_rating }}</span>
                  <AppIcon name="star" class="h-5 w-5 fill-current text-tikeo-orange" />
                  <span class="text-sm text-tikeo-gray-text">{{ t('event.reviewsCount', { n: reviewStats!.review_count }) }}</span>
                </p>
              </div>

              <div class="mt-5 space-y-4">
                <form v-if="isAuthenticated && canReview" class="bg-tikeo-surface p-5 shadow-card md:p-6" @submit.prevent="handleSubmitReview">
                  <p class="mb-2 font-display text-base font-bold text-tikeo-black">{{ myReview ? t('event.editYourReview') : t('event.leaveReview') }}</p>
                  <div class="mb-3 flex gap-1">
                    <button
                      v-for="n in 5"
                      :key="n"
                      type="button"
                      class="p-0.5 transition-transform active:scale-90"
                      :class="n <= reviewDraftRating ? 'text-tikeo-orange' : 'text-tikeo-border'"
                      :aria-label="`${n} / 5`"
                      @click="reviewDraftRating = n"
                    ><AppIcon name="star" class="h-8 w-8" :class="n <= reviewDraftRating ? 'fill-current' : ''" /></button>
                  </div>
                  <textarea v-model="reviewDraftComment" rows="3" maxlength="2000" :placeholder="t('event.reviewCommentPlaceholder')" class="input-field" />
                  <p v-if="reviewError" class="mt-1 text-xs text-tikeo-error">{{ reviewError }}</p>
                  <button type="submit" class="btn-ink mt-3" :disabled="reviewSubmitting">
                    {{ reviewSubmitting ? t('event.reviewSubmitting') : t('event.reviewSubmit') }}
                  </button>
                </form>

                <p v-if="!reviews.length" class="border border-dashed border-tikeo-border bg-tikeo-surface p-8 text-center text-sm text-tikeo-gray-text">{{ t('event.noReviews') }}</p>
                <article v-for="r in reviews" :key="r.id" class="bg-tikeo-surface p-5 shadow-card md:p-6">
                  <div class="flex items-center gap-3">
                    <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tikeo-ink text-sm font-bold text-white">
                      {{ (r.author?.full_name || t('event.anonymousReviewer')).slice(0, 1).toUpperCase() }}
                    </span>
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-bold text-tikeo-black">{{ r.author?.full_name || t('event.anonymousReviewer') }}</p>
                      <p class="flex gap-0.5 text-tikeo-orange" :aria-label="`${r.rating} / 5`"><AppIcon v-for="n in 5" :key="n" name="star" class="h-4 w-4" :class="n <= r.rating ? 'fill-current' : 'opacity-30'" /></p>
                    </div>
                  </div>
                  <p v-if="r.comment" class="mt-3 text-sm leading-relaxed text-tikeo-gray-text">{{ r.comment }}</p>
                  <div v-if="r.organizer_reply" class="mt-3 border-l-4 border-[#FF7A00] bg-tikeo-surface-alt p-3 text-sm">
                    <p class="font-bold text-tikeo-black">{{ t('event.organizerReplyLabel') }}</p>
                    <p class="mt-0.5 text-tikeo-gray-text">{{ r.organizer_reply }}</p>
                  </div>
                </article>
              </div>
            </section>
          </div>

          <!-- ---------- Récapitulatif (desktop, collant : panier persistant) ---------- -->
          <aside class="mt-10 hidden lg:sticky lg:top-24 lg:mt-0 lg:block">
            <div class="overflow-hidden bg-tikeo-surface shadow-card">
              <div class="flex items-center gap-3 bg-tikeo-ink px-5 py-4 text-white">
                <span class="flex h-10 w-10 items-center justify-center bg-[#FF7A00] text-tikeo-ink"><AppIcon name="ticket" class="h-5 w-5" /></span>
                <div class="min-w-0">
                  <h2 class="font-display text-lg font-extrabold leading-tight">{{ t('event.yourSelection') }}</h2>
                  <p class="truncate text-xs text-white/65">{{ event.title }}</p>
                </div>
              </div>

              <div class="p-5">
                <template v-if="totalQuantity === 0">
                  <div v-if="minPrice !== null" class="mb-3 leading-tight">
                    <span class="block text-xs text-tikeo-gray-text">{{ t('home.from') }}</span>
                    <span class="font-display text-2xl font-extrabold text-tikeo-black">{{ formatPrice(minPrice) }}</span>
                  </div>
                  <p class="text-sm text-tikeo-gray-text">{{ t('event.selectToSeeSummary') }}</p>
                </template>

                <template v-else>
                  <div class="space-y-3">
                    <div v-for="line in cartLines" :key="line.ticketTypeId" class="flex items-start justify-between gap-3 text-sm">
                      <span class="min-w-0 text-tikeo-black"><span class="font-bold">{{ line.quantity }} ×</span> {{ line.name }}</span>
                      <span class="shrink-0 font-semibold text-tikeo-black">{{ formatPrice(line.unitPrice * line.quantity) }}</span>
                    </div>
                  </div>

                  <div v-if="isAuthenticated" class="mt-4">
                    <input
                      v-model="promoCodeInput"
                      type="text"
                      maxlength="30"
                      :placeholder="t('event.promoCodePlaceholder')"
                      class="input-field text-sm uppercase"
                    />
                    <p v-if="promoChecking" class="mt-1 text-xs text-tikeo-gray-text">{{ t('event.promoChecking') }}</p>
                    <p v-else-if="promoPreview?.valid" class="mt-1 text-xs font-bold text-tikeo-success">
                      {{ t('event.promoApplied', { discount: promoDiscountPreviewLabel }) }}
                    </p>
                    <p v-else-if="promoPreview && !promoPreview.valid" class="mt-1 text-xs text-tikeo-error">
                      {{ te(`event.promoErrors.${promoPreview.error}`) ? t(`event.promoErrors.${promoPreview.error}`) : t('event.promoErrors.PROMO_INVALID') }}
                    </p>
                  </div>

                  <div class="mt-5 flex items-end justify-between border-t-2 border-dashed border-tikeo-border pt-4">
                    <span class="text-sm font-semibold text-tikeo-gray-text">{{ t('event.total') }}</span>
                    <span class="font-display text-2xl font-extrabold text-tikeo-black">{{ formatPrice(totalPrice) }}</span>
                  </div>

                  <p v-if="orderError" class="mt-3 border-l-4 border-tikeo-error bg-tikeo-error/10 px-3 py-2 text-xs font-medium text-tikeo-error">{{ orderError }}</p>

                  <button type="button" class="btn-brand mt-4 w-full" :disabled="totalQuantity === 0 || submitting" @click="handleReserve">
                    <span v-if="submitting">{{ t('event.reserving') }}</span>
                    <span v-else-if="!isAuthenticated">{{ t('event.loginToBook') }}</span>
                    <span v-else>{{ t('event.reserveButton') }}</span>
                  </button>
                </template>
              </div>

              <!-- Réassurance : mêmes arguments que sur l'accueil -->
              <ul class="space-y-3 border-t border-tikeo-border bg-tikeo-surface-alt/60 px-5 py-4 text-sm">
                <li class="flex items-center gap-3 text-tikeo-black"><AppIcon name="card" class="h-5 w-5 shrink-0 text-tikeo-orange" />{{ t('trustStats.badgePaymentTitle') }}</li>
                <li class="flex items-center gap-3 text-tikeo-black"><AppIcon name="qr" class="h-5 w-5 shrink-0 text-tikeo-orange" />{{ t('trustStats.badgeQrTitle') }}</li>
                <li class="flex items-center gap-3 text-tikeo-black"><AppIcon name="headset" class="h-5 w-5 shrink-0 text-tikeo-orange" />{{ t('trustStats.badgeSupportTitle') }}</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>

      <SimilarEvents :key="event.id" :event-id="event.id" :city="event.city" :category="event.category" />

      <!-- Repère de fin de contenu : la barre mobile se retire dès qu'il apparaît -->
      <div ref="endSentinel" class="h-px" aria-hidden="true" />

      <!-- Barre de réservation mobile : toujours là tant qu'il reste des billets. Posée AU-DESSUS de la barre de navigation du bas (MobileBottomNav, ~96 px) pour ne jamais être masquée. -->
      <Transition
        enter-active-class="transition duration-250 ease-out"
        leave-active-class="transition duration-200 ease-in"
        enter-from-class="translate-y-full opacity-0"
        leave-to-class="translate-y-full opacity-0"
      >
        <div
          v-if="showMobileBar"
          class="fixed inset-x-0 z-[45] border-t border-tikeo-border bg-tikeo-surface shadow-[0_-6px_20px_rgba(0,0,0,0.12)] md:hidden"
          style="bottom: calc(env(safe-area-inset-bottom, 0px) + 96px)"
          role="region"
          :aria-label="t('event.summaryTitle')"
        >
          <div v-if="totalQuantity > 0 && isAuthenticated" class="px-4 pt-2.5">
            <button
              v-if="!showMobilePromo && !promoCodeInput"
              type="button"
              class="text-xs font-bold text-tikeo-orange"
              @click="showMobilePromo = true"
            >
              + {{ t('event.promoCodePlaceholder') }}
            </button>
            <div v-else>
              <input
                v-model="promoCodeInput"
                type="text"
                maxlength="30"
                :placeholder="t('event.promoCodePlaceholder')"
                class="input-field !py-1.5 text-sm uppercase"
              />
              <p v-if="promoChecking" class="mt-1 text-xs text-tikeo-gray-text">{{ t('event.promoChecking') }}</p>
              <p v-else-if="promoPreview?.valid" class="mt-1 text-xs font-bold text-tikeo-success">
                {{ t('event.promoApplied', { discount: promoDiscountPreviewLabel }) }}
              </p>
              <p v-else-if="promoPreview && !promoPreview.valid" class="mt-1 text-xs text-tikeo-error">
                {{ te(`event.promoErrors.${promoPreview.error}`) ? t(`event.promoErrors.${promoPreview.error}`) : t('event.promoErrors.PROMO_INVALID') }}
              </p>
            </div>
          </div>

          <p v-if="orderError" class="px-4 pt-2 text-xs font-medium text-tikeo-error">{{ orderError }}</p>

          <div class="flex items-center justify-between gap-3 px-4 py-3">
            <div class="min-w-0 leading-tight">
              <template v-if="totalQuantity > 0">
                <p class="text-xs text-tikeo-gray-text">{{ t('event.selectedCount', { n: totalQuantity }) }} · {{ t('event.total') }}</p>
                <p class="truncate font-display text-xl font-extrabold text-tikeo-black">{{ formatPrice(totalPrice) }}</p>
              </template>
              <template v-else-if="minPrice !== null">
                <p class="text-xs text-tikeo-gray-text">{{ t('home.from') }}</p>
                <p class="truncate font-display text-xl font-extrabold text-tikeo-black">{{ formatPrice(minPrice) }}</p>
              </template>
            </div>
            <button v-if="totalQuantity > 0" type="button" class="btn-brand !h-11 shrink-0 !px-6" :disabled="submitting" @click="handleReserve">
              <span v-if="submitting">{{ t('event.reserving') }}</span>
              <span v-else-if="!isAuthenticated">{{ t('event.loginToBook') }}</span>
              <span v-else>{{ t('event.reserveButton') }}</span>
            </button>
            <button v-else type="button" class="btn-brand !h-11 shrink-0 !px-6" @click="scrollToSection('billets')">
              {{ t('event.selectTickets') }}
            </button>
          </div>
        </div>
      </Transition>

      <!-- Plan de salle -->
      <Transition
        enter-active-class="transition-opacity duration-150"
        leave-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div v-if="seatingPlanOpen" class="fixed inset-0 z-[70] flex items-center justify-center bg-tikeo-ink/80 p-4 backdrop-blur-sm" @click.self="seatingPlanOpen = false">
          <div class="max-h-[90vh] w-full max-w-2xl overflow-auto bg-tikeo-surface">
            <div class="flex items-center justify-between bg-tikeo-ink p-3 pl-5 text-white">
              <p class="font-display text-base font-bold">{{ t('event.seatingPlan') }}</p>
              <button type="button" class="flex h-9 w-9 items-center justify-center text-white/80 hover:bg-white/10 hover:text-white" :aria-label="t('event.close')" @click="seatingPlanOpen = false">
                <AppIcon name="close" class="h-5 w-5" :stroke="2" />
              </button>
            </div>
            <div class="p-4">
              <img v-if="seatingPlanIsImage" :src="event.seatingPlanUrl!" :alt="t('event.seatingPlan')" loading="lazy" decoding="async" class="w-full object-contain" />
              <div v-else class="flex flex-col items-center gap-3 py-8 text-center">
                <p class="text-sm text-tikeo-gray-text">{{ t('event.seatingPlanExternal') }}</p>
                <a :href="event.seatingPlanUrl!" target="_blank" rel="noopener" class="btn-ink">{{ t('event.seatingPlanOpen') }}</a>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </template>
  </div>
</template>
