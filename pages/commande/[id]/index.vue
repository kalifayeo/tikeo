<script setup lang="ts">
import type { PaymentMethodId } from '~/composables/useOrderCheckout'

definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const orderId = route.params.id as string

const { order, loading, errorCode, refresh } = useOrderDetail(orderId)
const { submitting, errorCode: payErrorCode, payWith, claimFree } = useOrderPayment()
const { countries } = useCountry()
const { profile } = useAuth()

// Commande à 0 F CFA (événement/billet gratuit, §"un événement gratuit ne
// doit pas afficher la page de paiement") : pas de moyens de paiement, un
// simple bouton pour récupérer le billet et le recevoir par email.
const isFreeOrder = computed(() => !!order.value && Math.round(Number(order.value.total)) === 0)

// Commande déjà payée (retour en arrière du navigateur, par ex.) : direction l'écran de retour.
watch(
  order,
  (o) => {
    if (o && o.status !== 'pending') router.replace(`/commande/${orderId}/retour`)
  },
  { immediate: true }
)

// --- Moyens de paiement (§24-26 : Jèko Checkout couvre les 5 réseaux en une seule intégration) ---
// L'API Jèko demande l'opérateur précis avant de créer la demande de paiement :
// chaque réseau a donc son propre bouton.
const PAYMENT_METHODS: Array<{ id: PaymentMethodId; label: string; logos: Array<{ src: string; alt: string }> }> = [
  { id: 'wave', label: 'Wave', logos: [{ src: '/paiement/wave.png', alt: 'Wave' }] },
  { id: 'orange', label: 'Orange Money', logos: [{ src: '/paiement/orange-money.png', alt: 'Orange Money' }] },
  { id: 'mtn', label: 'MTN MoMo', logos: [{ src: '/paiement/mtn.png', alt: 'MTN MoMo' }] },
  { id: 'moov', label: 'Moov Money', logos: [{ src: '/paiement/moov.png', alt: 'Moov Money' }] },
  { id: 'djamo', label: 'Djamo', logos: [{ src: '/paiement/djamo.png', alt: 'Djamo' }] },
]
const selectedMethod = ref<PaymentMethodId>('wave')

// --- Aide par moyen de paiement ----------------------------------------------
// Ce que l'acheteur doit savoir AVANT de payer, selon le réseau choisi.
const METHOD_HELP: Record<PaymentMethodId, { title: string; steps: string[] }> = {
  wave: {
    title: 'Paiement avec Wave',
    steps: [
      'Vous êtes envoyé vers Wave pour confirmer le paiement.',
      'Sur téléphone : l’application Wave s’ouvre. Sur ordinateur : scannez le QR code avec Wave.',
      'Une fois validé, vous revenez automatiquement sur Tikeo.',
    ],
  },
  orange: {
    title: 'Paiement avec Orange Money',
    steps: [],
  },
  mtn: {
    title: 'Paiement avec MTN MoMo',
    steps: [
      'Une demande de paiement arrive sur votre téléphone MTN (menu USSD).',
      'Saisissez votre code secret MoMo pour valider.',
      'Rien reçu ? Composez *133# puis ouvrez le menu des approbations.',
    ],
  },
  moov: {
    title: 'Paiement avec Moov Money',
    steps: [
      'Une demande de paiement arrive sur votre téléphone Moov (menu USSD).',
      'Saisissez votre code secret Moov Money pour valider.',
      'Rien reçu ? Composez *155# pour ouvrir votre menu Moov Money.',
    ],
  },
  djamo: {
    title: 'Paiement avec Djamo',
    steps: [
      'Vous êtes envoyé vers Djamo pour confirmer le paiement.',
      'Ouvrez ou installez l’application Djamo si elle vous le demande, puis validez.',
      'Une fois validé, vous revenez automatiquement sur Tikeo.',
    ],
  },
}
const methodHelp = computed(() => METHOD_HELP[selectedMethod.value])

// --- Orange Money : application Maxit ou code temporaire (#144*82#) ---------
// Avec Maxit : l'acheteur est envoyé chez Orange, qui ouvre l'application.
// Sans Maxit : il génère un code à 4 chiffres avec le code USSD, le colle ici,
// puis le code est copié dans son presse-papiers pour être collé sur la page Orange.
const ORANGE_USSD = '#144*82#'
const ORANGE_USSD_LINK = 'tel:%23144*82%23'
const orangeHasMaxit = ref(true)
const orangeCode = ref('')
const orangeCodeValid = computed(() => /^\d{4}$/.test(orangeCode.value))
const orangeCodeCopied = ref(false)
const orangeNeedsCode = computed(() => selectedMethod.value === 'orange' && !orangeHasMaxit.value)

function onOrangeCodeInput(e: Event) {
  const el = e.target as HTMLInputElement
  // Accepte un collage « 1234 », « 12 34 » ou « Code : 1234 » : on ne garde que les chiffres.
  orangeCode.value = el.value.replace(/\D/g, '').slice(0, 4)
  el.value = orangeCode.value
}
function onOrangeCodePaste(e: ClipboardEvent) {
  orangeCode.value = (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '').slice(0, 4)
}
async function pasteOrangeCode() {
  try {
    const text = await navigator.clipboard.readText()
    orangeCode.value = text.replace(/\D/g, '').slice(0, 4)
  } catch {
    // Collage direct bloqué par le navigateur : l'acheteur colle dans le champ à la main.
  }
}
async function copyOrangeCode() {
  try {
    await navigator.clipboard.writeText(orangeCode.value)
    orangeCodeCopied.value = true
  } catch {
    orangeCodeCopied.value = false
  }
}
const selectedCountryCode = ref('CI')

// --- Affichage ---------------------------------------------------------------
const selectedMethodLabel = computed(() => PAYMENT_METHODS.find((m) => m.id === selectedMethod.value)?.label ?? '')
const ticketTotalCount = computed(() => (order.value?.order_items ?? []).reduce((n, l) => n + Number(l.quantity || 0), 0))
// Dernières 2 minutes : le compte à rebours passe au rouge.
const urgent = computed(() => remainingSeconds.value > 0 && remainingSeconds.value <= 120)
const checkoutSteps: Array<{ label: string; state: 'done' | 'current' | 'todo' }> = [
  { label: 'Billets', state: 'done' },
  { label: 'Paiement', state: 'current' },
  { label: 'Confirmation', state: 'todo' },
]
// Étapes Orange Money avec Maxit (une seule source : le gabarit les numérote).
const orangeMaxitSteps = [
  'Vous êtes envoyé chez Orange Money : l’application <span class="font-bold text-tikeo-black">Maxit</span> s’ouvre.',
  'Confirmez le paiement avec votre code secret.',
  'Vous revenez ensuite automatiquement sur Tikeo.',
]
const acceptedTerms = ref(false)

// --- Numéro du payeur -------------------------------------------------------
// Le numéro du profil (saisi à l'inscription) est utilisé automatiquement : l'acheteur n'a rien à
// taper, et la page de saisie de Jèko n'est plus affichée. Un champ n'apparaît que si le profil n'a
// pas de numéro valide (une seule fois : il est ensuite mémorisé), ou si l'acheteur veut payer
// avec un autre numéro MTN / Moov.
const savedPhone = computed(() => normalizeIvorianPhone(profile.value?.phone))
const savedPhoneMasked = computed(() => (savedPhone.value ? maskIvorianPhone(savedPhone.value) : ''))
const changingPhone = ref(false)
const phoneInput = ref('')
const needsPhoneField = computed(() => !savedPhone.value || changingPhone.value)
const usesUssd = computed(() => selectedMethod.value === 'mtn' || selectedMethod.value === 'moov')
// Wave / Orange / Djamo n'utilisent pas le numéro : on ne le demande que s'il manque au profil.
const showPhoneBlock = computed(() => !savedPhone.value || usesUssd.value)
const phoneTyped = computed(() => normalizeIvorianPhone(phoneInput.value))
const phoneFieldInvalid = computed(() => needsPhoneField.value && phoneInput.value.trim().length > 0 && !phoneTyped.value)
const phoneMissing = computed(() => needsPhoneField.value && !phoneTyped.value)

// Seule la Côte d'Ivoire est branchée pour l'instant côté paiement réel.
const paymentAvailable = computed(() => selectedCountryCode.value === 'CI')

function formatPrice(n: number, currency = 'XOF') {
  return `${n.toLocaleString('fr-FR')} ${currency === 'XOF' ? 'F CFA' : currency}`
}

const formattedEventDate = computed(() => {
  if (!order.value?.event?.start_date) return ''
  const d = new Date(order.value.event.start_date)
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
})

// --- Compte à rebours de la réservation de stock (15 minutes, migration 0017) ---
const remainingSeconds = ref(0)
let timer: ReturnType<typeof setInterval> | undefined
function tick() {
  if (!order.value?.expires_at) return
  const diff = Math.floor((new Date(order.value.expires_at).getTime() - Date.now()) / 1000)
  remainingSeconds.value = Math.max(0, diff)
  if (remainingSeconds.value === 0) refresh() // relit le statut : la commande a dû être annulée côté serveur
}
onMounted(() => {
  tick()
  timer = setInterval(tick, 1000)
})
onUnmounted(() => timer && clearInterval(timer))

const remainingLabel = computed(() => {
  const m = Math.floor(remainingSeconds.value / 60)
  const s = remainingSeconds.value % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

// Traduction des codes renvoyés par /api/orders/:id/pay en message lisible.
const PAY_ERROR_MESSAGES: Record<string, string> = {
  PAYMENT_NOT_CONFIGURED: "Le paiement en ligne n'est pas encore activé sur ce site. Contactez le support.",
  INVALID_PAYMENT_METHOD: 'Moyen de paiement non pris en charge. Choisissez-en un autre.',
  PAYMENT_PROVIDER_ERROR: "Notre prestataire de paiement est momentanément indisponible. Réessayez dans un instant.",
  ORDER_EXPIRED: 'Le délai de réservation est écoulé. Reprenez votre commande depuis la page de l’événement.',
  ORDER_NOT_PAYABLE: 'Cette commande a déjà été traitée.',
  ORDER_NOT_FOUND: 'Commande introuvable.',
  RATE_LIMITED: 'Trop de tentatives. Patientez quelques minutes avant de réessayer.',
  SESSION_EXPIRED: 'Votre session a expiré. Reconnectez-vous pour finaliser le paiement.',
  PHONE_REQUIRED: 'Renseignez votre numéro de téléphone pour lancer le paiement.',
  PAYMENT_PHONE_INVALID: 'Numéro invalide. Format attendu : 07 XX XX XX XX (Côte d’Ivoire).',
  PAYMENT_PHONE_REFUSED: 'L’opérateur a refusé ce numéro pour le moyen de paiement choisi. Vérifiez que le numéro correspond bien à ce réseau, ou choisissez un autre moyen de paiement.',
  ORDER_NOT_FREE: 'Cette commande n’est pas gratuite. Rechargez la page pour choisir un moyen de paiement.',
  CONFIRM_FAILED: "Impossible de récupérer votre billet pour le moment. Réessayez dans un instant.",
}
const payErrorMessage = computed(() =>
  payErrorCode.value
    ? (PAY_ERROR_MESSAGES[payErrorCode.value] ?? `Le paiement n'a pas pu être initié (${payErrorCode.value}). Réessayez.`)
    : ''
)

async function handlePay() {
  if (!acceptedTerms.value || !paymentAvailable.value || phoneMissing.value) return
  if (orangeNeedsCode.value) {
    if (!orangeCodeValid.value) return
    await copyOrangeCode() // geste utilisateur en cours : le presse-papiers est autorisé
  }
  const res = await payWith(orderId, selectedMethod.value, needsPhoneField.value ? phoneTyped.value ?? undefined : undefined)
  // MTN / Moov : pas de page à ouvrir, la confirmation se fait sur le téléphone (USSD).
  // Wave / Orange / Djamo : payWith a déjà envoyé l'acheteur chez son opérateur.
  if (res?.mode === 'ussd') {
    await router.push({ path: `/commande/${orderId}/retour`, query: { ussd: '1', m: selectedMethod.value } })
  }
}

async function handleClaimFree() {
  if (!acceptedTerms.value) return
  const ok = await claimFree(orderId)
  if (ok) router.replace(`/commande/${orderId}/retour`)
}
</script>

<template>
  <div class="pb-12 md:pb-16">
    <!-- ============ En-tête : titre, compte à rebours, étapes ============ -->
    <PageHero eyebrow="Paiement sécurisé" title="Récapitulatif de commande" back :steps="checkoutSteps">
      <template v-if="order && remainingSeconds > 0" #aside>
        <div
          class="flex items-center gap-2.5 border px-3 py-2 transition-colors"
          :class="urgent ? 'border-tikeo-error bg-tikeo-error text-white' : 'border-white/25 bg-white/[0.06] text-white'"
          role="timer"
          aria-label="Temps restant pour finaliser le paiement"
        >
          <AppIcon name="clock" class="h-5 w-5 shrink-0" :class="urgent ? '' : 'text-[#FF7A00]'" />
          <div class="leading-none">
            <p class="font-display text-xl font-extrabold tabular-nums md:text-2xl">{{ remainingLabel }}</p>
            <p class="mt-1 hidden text-[10px] font-bold uppercase tracking-wider opacity-70 sm:block">Billets réservés</p>
          </div>
        </div>
      </template>

    </PageHero>

    <div class="mx-auto max-w-tikeo-container px-4 pt-8 md:px-6 md:pt-12">
      <!-- ============ États : chargement, introuvable, expiré ============ -->
      <div v-if="loading" class="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <div class="space-y-4"><div class="h-72 animate-pulse bg-tikeo-border" /><div class="h-32 animate-pulse bg-tikeo-border" /></div>
        <div class="h-[28rem] animate-pulse bg-tikeo-border" />
      </div>

      <div v-else-if="!order || errorCode" class="acc-empty mx-auto max-w-lg">
        <span class="flex h-14 w-14 items-center justify-center bg-tikeo-error text-white"><AppIcon name="info" class="h-7 w-7" /></span>
        <p class="font-display text-lg font-bold text-tikeo-black">Cette commande n'est plus disponible ou a expiré.</p>
        <NuxtLink to="/" class="btn-ink mt-1">Retour à l'accueil</NuxtLink>
      </div>

      <div v-else-if="remainingSeconds === 0 && order.status === 'pending'" class="acc-empty mx-auto max-w-lg">
        <span class="flex h-14 w-14 items-center justify-center bg-tikeo-ink text-white dark:bg-[#FF7A00] dark:text-tikeo-ink"><AppIcon name="clock" class="h-7 w-7" /></span>
        <p class="font-display text-lg font-bold text-tikeo-black">Le délai de réservation de vos billets est écoulé.</p>
        <p class="max-w-sm text-sm text-tikeo-gray-text">Rassurez-vous, rien n'a été débité. Vous pouvez choisir à nouveau vos billets.</p>
        <NuxtLink v-if="order.event" :to="`/e/${order.event.slug}`" class="btn-ink mt-1">Choisir à nouveau mes billets</NuxtLink>
      </div>

      <div v-else class="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:items-start lg:gap-10">
        <!-- ============ Colonne gauche : événement + commande ============ -->
        <div class="min-w-0 space-y-5">
          <!-- Carte événement façon billet -->
          <article class="relative bg-tikeo-surface shadow-card">
            <div class="relative h-44 overflow-hidden bg-tikeo-ink md:h-52">
              <img v-if="order.event?.cover_image" :src="order.event.cover_image" :alt="order.event?.title" class="h-full w-full object-cover" />
              <div v-else class="flex h-full items-center justify-center"><img src="/logo-tikeo.png" alt="Tikeo" class="h-12 w-auto opacity-90" /></div>
              <div class="absolute inset-0 bg-gradient-to-t from-tikeo-ink/70 via-transparent to-transparent" aria-hidden="true" />
              <span class="absolute inset-x-0 top-0 h-1 bg-tikeo-brand" aria-hidden="true" />
            </div>

            <!-- Perforation -->
            <div class="relative" aria-hidden="true">
              <span class="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-tikeo-gray-light" />
              <span class="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-tikeo-gray-light" />
              <span class="block border-t-2 border-dashed border-tikeo-gray-text/35" />
            </div>

            <div class="p-5">
              <h2 class="font-display text-xl font-extrabold leading-tight tracking-tight text-tikeo-black">{{ order.event?.title }}</h2>
              <ul class="mt-3 space-y-2 text-sm text-tikeo-gray-text">
                <li class="flex items-center gap-2.5">
                  <span class="flex h-7 w-7 shrink-0 items-center justify-center bg-[#FF7A00] text-tikeo-ink"><AppIcon name="calendar" class="h-4 w-4" /></span>
                  <span class="capitalize">{{ formattedEventDate }}</span>
                </li>
                <li v-if="order.event?.city" class="flex items-center gap-2.5">
                  <span class="flex h-7 w-7 shrink-0 items-center justify-center bg-[#FF7A00] text-tikeo-ink"><AppIcon name="pin" class="h-4 w-4" /></span>
                  <span>{{ order.event.city }}</span>
                </li>
              </ul>
            </div>
          </article>

          <!-- Votre commande -->
          <section class="acc-panel">
            <header class="flex items-center justify-between gap-3 border-b border-tikeo-border px-5 py-4">
              <h2 class="flex items-center gap-3 font-display text-lg font-extrabold tracking-tight text-tikeo-black">
                <span class="flex h-9 w-9 items-center justify-center bg-tikeo-ink text-white dark:bg-[#FF7A00] dark:text-tikeo-ink"><AppIcon name="ticket" class="h-[18px] w-[18px]" /></span>
                Votre commande
              </h2>
              <span class="acc-tag bg-tikeo-surface-alt text-tikeo-gray-text">{{ ticketTotalCount }} billet{{ ticketTotalCount > 1 ? 's' : '' }}</span>
            </header>
            <ul class="divide-y divide-tikeo-border">
              <li v-for="line in order.order_items" :key="line.id" class="flex items-center justify-between gap-3 px-5 py-4">
                <div class="min-w-0">
                  <p class="truncate text-sm font-bold text-tikeo-black">{{ line.ticket_type?.name }}</p>
                  <p class="mt-0.5 text-xs text-tikeo-gray-text">{{ line.quantity }} × {{ formatPrice(line.unit_price, order.currency) }}</p>
                </div>
                <p class="shrink-0 font-display text-base font-extrabold text-tikeo-black">{{ formatPrice(line.total, order.currency) }}</p>
              </li>
            </ul>
            <div class="flex items-center justify-between gap-3 bg-tikeo-ink px-5 py-4 text-white">
              <span class="text-[11px] font-bold uppercase tracking-wider text-white/65">Total à payer</span>
              <span class="font-display text-2xl font-extrabold text-[#FF7A00]">{{ isFreeOrder ? 'Gratuit' : formatPrice(order.total, order.currency) }}</span>
            </div>
          </section>
        </div>

        <!-- ============ Colonne droite : commande gratuite ============ -->
        <section v-if="isFreeOrder" class="acc-panel lg:sticky lg:top-24">
          <header class="flex items-center gap-3 border-b border-tikeo-border px-5 py-4">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center bg-tikeo-success text-white"><AppIcon name="check" class="h-5 w-5" :stroke="2.6" /></span>
            <div>
              <h2 class="font-display text-lg font-extrabold tracking-tight text-tikeo-black">Événement gratuit</h2>
              <p class="text-xs text-tikeo-gray-text">Aucun paiement n'est nécessaire.</p>
            </div>
          </header>
          <div class="space-y-5 p-5">
            <p class="text-sm leading-relaxed text-tikeo-gray-text">Votre billet vous sera envoyé immédiatement par email, et restera disponible dans votre espace.</p>

            <div class="flex items-center justify-between border-t-2 border-dashed border-tikeo-gray-text/25 pt-4">
              <span class="text-sm font-bold text-tikeo-black">Total</span>
              <span class="font-display text-xl font-extrabold text-tikeo-success">Gratuit</span>
            </div>

            <label class="flex items-start gap-3 border border-tikeo-border bg-tikeo-surface-alt/60 p-3.5 text-xs leading-relaxed text-tikeo-gray-text">
              <input v-model="acceptedTerms" type="checkbox" class="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--tikeo-orange-strong))]" />
              <span>
                J'accepte les
                <NuxtLink to="/conditions" class="font-bold text-tikeo-black underline decoration-[#FF7A00] decoration-2 underline-offset-[3px]">conditions générales de vente</NuxtLink>
                et la
                <NuxtLink to="/confidentialite" class="font-bold text-tikeo-black underline decoration-[#FF7A00] decoration-2 underline-offset-[3px]">politique de confidentialité</NuxtLink>.
              </span>
            </label>

            <p v-if="payErrorCode" class="acc-alert-error">{{ payErrorMessage }}</p>

            <button type="button" class="btn-brand !h-14 w-full text-base" :disabled="!acceptedTerms || submitting" @click="handleClaimFree">
              <span v-if="submitting">Envoi de votre billet…</span>
              <template v-else><AppIcon name="mail" class="h-5 w-5" />Recevoir mon billet par email</template>
            </button>
          </div>
        </section>

        <!-- ============ Colonne droite : méthode de paiement ============ -->
        <section v-else class="acc-panel lg:sticky lg:top-24">
          <header class="flex items-center gap-3 border-b border-tikeo-border px-5 py-4">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center bg-[#FF7A00] text-tikeo-ink"><AppIcon name="lock" class="h-5 w-5" /></span>
            <div>
              <h2 class="font-display text-lg font-extrabold tracking-tight text-tikeo-black">Méthode de paiement</h2>
              <p class="text-xs text-tikeo-gray-text">Choisissez comment vous souhaitez payer.</p>
            </div>
          </header>

          <div class="space-y-6 p-5">
            <!-- Pays -->
            <label class="block">
              <span class="acc-label mb-1.5 block">Pays *</span>
              <select v-model="selectedCountryCode" class="field-input">
                <option v-for="c in countries" :key="c.code" :value="c.code">{{ c.flag }} {{ c.name }}</option>
              </select>
            </label>

            <!-- Moyens de paiement -->
            <div>
              <p class="acc-label mb-2">Moyen de paiement</p>
              <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label="Moyen de paiement">
                <button
                  v-for="m in PAYMENT_METHODS"
                  :key="m.id"
                  type="button"
                  role="radio"
                  :aria-checked="selectedMethod === m.id"
                  class="relative flex flex-col items-center gap-2 border-2 px-2 py-3.5 text-xs font-bold transition-colors duration-200"
                  :class="
                    selectedMethod === m.id
                      ? 'border-tikeo-ink bg-tikeo-surface-alt text-tikeo-black dark:border-[#FF7A00]'
                      : 'border-tikeo-border bg-tikeo-surface text-tikeo-gray-text hover:border-tikeo-ink/40 dark:hover:border-[#FF7A00]/50'
                  "
                  @click="selectedMethod = m.id"
                >
                  <span
                    v-if="selectedMethod === m.id"
                    class="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center bg-[#FF7A00] text-tikeo-ink"
                  >
                    <AppIcon name="check" class="h-3 w-3" :stroke="3.2" />
                  </span>
                  <span class="flex h-9 items-center justify-center">
                    <img
                      v-for="logo in m.logos"
                      :key="logo.src"
                      :src="logo.src"
                      :alt="logo.alt"
                      loading="lazy"
                      class="h-9 w-9 rounded-full bg-white object-cover ring-1 ring-black/5"
                    />
                  </span>
                  <span class="leading-tight">{{ m.label }}</span>
                </button>
              </div>
            </div>

            <p v-if="!paymentAvailable" class="acc-alert-info">
              Le paiement en ligne n'est pour l'instant disponible qu'en Côte d'Ivoire. Sélectionnez « Côte d'Ivoire » pour continuer.
            </p>

            <!-- Récapitulatif -->
            <dl class="space-y-2 border-t-2 border-dashed border-tikeo-gray-text/25 pt-5 text-sm">
              <div class="flex items-center justify-between text-tikeo-gray-text"><dt>Sous-total</dt><dd>{{ formatPrice(order.subtotal, order.currency) }}</dd></div>
              <div v-if="order.discount > 0" class="flex items-center justify-between text-tikeo-success">
                <dt>{{ t('event.promoCodeAppliedLabel', { code: order.promo_code }) }}</dt>
                <dd>-{{ formatPrice(order.discount, order.currency) }}</dd>
              </div>
              <div v-if="order.fees > 0" class="flex items-center justify-between text-tikeo-gray-text"><dt>Frais de service</dt><dd>{{ formatPrice(order.fees, order.currency) }}</dd></div>
              <div class="flex items-baseline justify-between pt-2">
                <dt class="font-bold text-tikeo-black">Total</dt>
                <dd class="font-display text-2xl font-extrabold text-tikeo-black">{{ formatPrice(order.total, order.currency) }}</dd>
              </div>
            </dl>

            <!-- Aide selon le moyen de paiement choisi -->
            <div v-if="paymentAvailable" class="border-l-4 border-[#FF7A00] bg-tikeo-surface-alt p-4 text-xs">
              <p class="mb-3 flex items-center gap-2 text-sm font-bold text-tikeo-black">
                <AppIcon name="info" class="h-4 w-4 text-tikeo-orange" />
                {{ methodHelp.title }}
              </p>

              <template v-if="selectedMethod === 'orange'">
                <div class="mb-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    class="border px-2 py-2.5 font-bold transition-colors"
                    :class="orangeHasMaxit ? 'border-tikeo-ink bg-tikeo-ink text-white dark:border-[#FF7A00] dark:bg-[#FF7A00] dark:text-tikeo-ink' : 'border-tikeo-border bg-tikeo-surface text-tikeo-gray-text hover:border-tikeo-ink'"
                    @click="orangeHasMaxit = true"
                  >J’ai l’application Maxit</button>
                  <button
                    type="button"
                    class="border px-2 py-2.5 font-bold transition-colors"
                    :class="!orangeHasMaxit ? 'border-tikeo-ink bg-tikeo-ink text-white dark:border-[#FF7A00] dark:bg-[#FF7A00] dark:text-tikeo-ink' : 'border-tikeo-border bg-tikeo-surface text-tikeo-gray-text hover:border-tikeo-ink'"
                    @click="orangeHasMaxit = false"
                  >Je n’ai pas Maxit</button>
                </div>

                <ol v-if="orangeHasMaxit" class="space-y-2.5 text-tikeo-gray-text">
                  <li v-for="(step, i) in orangeMaxitSteps" :key="i" class="flex items-start gap-2.5">
                    <span class="flex h-5 w-5 shrink-0 items-center justify-center bg-tikeo-ink text-[11px] font-bold text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">{{ i + 1 }}</span>
                    <span class="leading-relaxed" v-html="step" />
                  </li>
                </ol>

                <div v-else class="space-y-3 text-tikeo-gray-text">
                  <p class="leading-relaxed">
                    <span class="mr-1.5 inline-flex h-5 w-5 items-center justify-center bg-tikeo-ink text-[11px] font-bold text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">1</span>
                    Depuis votre téléphone Orange, composez
                    <a :href="ORANGE_USSD_LINK" class="font-mono font-bold text-tikeo-black underline decoration-[#FF7A00] decoration-2 underline-offset-[3px]">{{ ORANGE_USSD }}</a>
                    pour générer un <span class="font-bold text-tikeo-black">code temporaire à 4 chiffres</span>.
                  </p>
                  <p class="leading-relaxed">
                    <span class="mr-1.5 inline-flex h-5 w-5 items-center justify-center bg-tikeo-ink text-[11px] font-bold text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">2</span>
                    Collez ce code ici (il expire vite : faites-le juste avant de payer) :
                  </p>
                  <div class="flex items-stretch gap-2">
                    <input
                      :value="orangeCode"
                      type="text"
                      inputmode="numeric"
                      autocomplete="one-time-code"
                      maxlength="12"
                      placeholder="_ _ _ _"
                      aria-label="Code temporaire Orange Money à 4 chiffres"
                      class="field-input text-center font-mono text-lg tracking-[0.5em]"
                      @input="onOrangeCodeInput"
                      @paste.prevent="onOrangeCodePaste"
                    />
                    <button type="button" class="acc-btn-ghost !h-12 shrink-0" @click="pasteOrangeCode">Coller</button>
                  </div>
                  <p v-if="orangeCode && !orangeCodeValid" class="font-semibold text-tikeo-error">Le code contient 4 chiffres.</p>
                  <p class="leading-relaxed">
                    <span class="mr-1.5 inline-flex h-5 w-5 items-center justify-center bg-tikeo-ink text-[11px] font-bold text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">3</span>
                    Appuyez sur « Payer » : le code est copié, vous n’avez plus qu’à le coller sur la page Orange Money qui s’ouvre.
                  </p>
                </div>
              </template>

              <ol v-else class="space-y-2.5 text-tikeo-gray-text">
                <li v-for="(step, i) in methodHelp.steps" :key="i" class="flex items-start gap-2.5">
                  <span class="flex h-5 w-5 shrink-0 items-center justify-center bg-tikeo-ink text-[11px] font-bold text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">{{ i + 1 }}</span>
                  <span class="leading-relaxed">{{ step }}</span>
                </li>
              </ol>
            </div>

            <!-- Numéro du payeur : automatique (profil) — jamais la page de saisie Jèko -->
            <div v-if="showPhoneBlock" class="border border-tikeo-border p-4 text-xs">
              <template v-if="!needsPhoneField">
                <div class="flex flex-wrap items-center justify-between gap-3 text-tikeo-gray-text">
                  <span class="flex items-center gap-2.5">
                    <span class="flex h-8 w-8 shrink-0 items-center justify-center bg-tikeo-surface-alt text-tikeo-black"><AppIcon name="phone" class="h-4 w-4" /></span>
                    <span>Demande de paiement envoyée au <span class="font-bold text-tikeo-black">{{ savedPhoneMasked }}</span></span>
                  </span>
                  <button type="button" class="font-bold text-tikeo-black underline decoration-[#FF7A00] decoration-2 underline-offset-[4px] hover:text-tikeo-orange" @click="changingPhone = true">Modifier</button>
                </div>
              </template>
              <template v-else>
                <label class="block" for="pay-phone">
                  <span class="acc-label mb-1.5 block">{{ savedPhone ? 'Autre numéro pour ce paiement' : 'Votre numéro de téléphone' }}</span>
                </label>
                <input
                  id="pay-phone"
                  v-model="phoneInput"
                  type="tel"
                  inputmode="tel"
                  autocomplete="tel"
                  maxlength="20"
                  placeholder="07 XX XX XX XX"
                  class="field-input"
                />
                <p v-if="phoneFieldInvalid" class="mt-1.5 font-semibold text-tikeo-error">Format attendu : 07 XX XX XX XX (Côte d’Ivoire).</p>
                <p v-else-if="!savedPhone" class="mt-1.5 text-tikeo-gray-text">Enregistré une seule fois : vous n’aurez plus à le saisir.</p>
                <button v-if="savedPhone" type="button" class="mt-2 font-bold text-tikeo-black underline decoration-[#FF7A00] decoration-2 underline-offset-[4px] hover:text-tikeo-orange" @click="changingPhone = false; phoneInput = ''">
                  Utiliser {{ savedPhoneMasked }}
                </button>
              </template>
            </div>

            <!-- Conditions + paiement -->
            <div class="space-y-4">
              <label class="flex items-start gap-3 border border-tikeo-border bg-tikeo-surface-alt/60 p-3.5 text-xs leading-relaxed text-tikeo-gray-text">
                <input v-model="acceptedTerms" type="checkbox" class="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--tikeo-orange-strong))]" />
                <span>
                  J'accepte les
                  <NuxtLink to="/conditions" class="font-bold text-tikeo-black underline decoration-[#FF7A00] decoration-2 underline-offset-[3px]">conditions générales de vente</NuxtLink>
                  et la
                  <NuxtLink to="/confidentialite" class="font-bold text-tikeo-black underline decoration-[#FF7A00] decoration-2 underline-offset-[3px]">politique de confidentialité</NuxtLink>.
                </span>
              </label>

              <p v-if="payErrorCode" class="acc-alert-error">{{ payErrorMessage }}</p>

              <button
                type="button"
                class="btn-brand !h-14 w-full text-base"
                :disabled="!acceptedTerms || !paymentAvailable || submitting || phoneMissing || (orangeNeedsCode && !orangeCodeValid)"
                @click="handlePay"
              >
                <span v-if="submitting">{{ usesUssd ? 'Envoi de la demande…' : orangeNeedsCode ? 'Ouverture d’Orange Money…' : 'Ouverture de votre application…' }}</span>
                <template v-else>
                  <AppIcon name="lock" class="h-5 w-5" />
                  Payer avec {{ selectedMethodLabel }}
                </template>
              </button>

              <ul class="grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-tikeo-gray-text">
                <li class="flex flex-col items-center gap-1.5"><AppIcon name="shield-check" class="h-5 w-5 text-tikeo-orange" />Paiement sécurisé</li>
                <li class="flex flex-col items-center gap-1.5"><AppIcon name="mail" class="h-5 w-5 text-tikeo-orange" />Billets par email</li>
                <li class="flex flex-col items-center gap-1.5"><AppIcon name="qr" class="h-5 w-5 text-tikeo-orange" />QR code instantané</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
