<script setup lang="ts">
import type { PaymentMethodId } from '~/composables/useOrderCheckout'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const orderId = route.params.id as string

const { order, loading, errorCode, refresh } = useOrderDetail(orderId)
const { submitting, errorCode: payErrorCode, payWith, claimFree } = useOrderPayment()
const { countries } = useCountry()

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

// --- Moyens de paiement (§24-26 : CinetPay couvre les 4 en une seule intégration) ---
// `logos` : un seul visuel pour les moyens à marque unique, trois empilés pour
// « Mobile Money » qui regroupe Orange Money, MTN MoMo et Moov Money.
const PAYMENT_METHODS: Array<{ id: PaymentMethodId; label: string; logos: Array<{ src: string; alt: string }> }> = [
  { id: 'wave', label: 'Wave', logos: [{ src: '/paiement/wave.png', alt: 'Wave' }] },
  {
    id: 'mobile_money',
    label: 'Mobile Money',
    logos: [
      { src: '/paiement/orange-money.png', alt: 'Orange Money' },
      { src: '/paiement/mtn.png', alt: 'MTN MoMo' },
      { src: '/paiement/moov.png', alt: 'Moov Money' },
    ],
  },
  { id: 'djamo', label: 'Djamo', logos: [{ src: '/paiement/djamo.png', alt: 'Djamo' }] },
  { id: 'card', label: 'Carte bancaire', logos: [{ src: '/paiement/carte.png', alt: 'Carte bancaire' }] },
]
const selectedMethod = ref<PaymentMethodId>('wave')
const selectedCountryCode = ref('CI')
const acceptedTerms = ref(false)

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
  PAYMENT_PROVIDER_ERROR: "Notre prestataire de paiement est momentanément indisponible. Réessayez dans un instant.",
  ORDER_EXPIRED: 'Le délai de réservation est écoulé. Reprenez votre commande depuis la page de l’événement.',
  ORDER_NOT_PAYABLE: 'Cette commande a déjà été traitée.',
  ORDER_NOT_FOUND: 'Commande introuvable.',
  RATE_LIMITED: 'Trop de tentatives. Patientez quelques minutes avant de réessayer.',
  SESSION_EXPIRED: 'Votre session a expiré. Reconnectez-vous pour finaliser le paiement.',
  ORDER_NOT_FREE: 'Cette commande n’est pas gratuite. Rechargez la page pour choisir un moyen de paiement.',
  CONFIRM_FAILED: "Impossible de récupérer votre billet pour le moment. Réessayez dans un instant.",
}
const payErrorMessage = computed(() =>
  payErrorCode.value
    ? (PAY_ERROR_MESSAGES[payErrorCode.value] ?? `Le paiement n'a pas pu être initié (${payErrorCode.value}). Réessayez.`)
    : ''
)

async function handlePay() {
  if (!acceptedTerms.value || !paymentAvailable.value) return
  await payWith(orderId, selectedMethod.value)
}

async function handleClaimFree() {
  if (!acceptedTerms.value) return
  const ok = await claimFree(orderId)
  if (ok) router.replace(`/commande/${orderId}/retour`)
}
</script>

<template>
  <div class="mx-auto min-h-screen max-w-tikeo-container bg-tikeo-gray-light px-4 py-6 md:px-8">
    <div class="mb-6 flex items-center justify-center gap-3">
      <button type="button" class="absolute left-4 text-tikeo-black md:left-8" aria-label="Retour" @click="router.back()">
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
      </button>
      <div class="text-center">
        <h1 class="text-base font-bold text-tikeo-black">Récapitulatif de commande</h1>
        <p v-if="order && remainingSeconds > 0" class="mt-0.5 flex items-center justify-center gap-1 text-xs text-tikeo-gray-text">
          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" /><path stroke-linecap="round" d="M12 7v5l3 3" /></svg>
          {{ remainingLabel }}
        </p>
      </div>
    </div>

    <div v-if="loading" class="py-24 text-center text-sm text-tikeo-gray-text">Chargement de votre commande…</div>

    <div v-else-if="!order || errorCode" class="mx-auto max-w-md py-24 text-center">
      <p class="text-sm font-medium text-tikeo-error">Cette commande n'est plus disponible ou a expiré.</p>
      <NuxtLink to="/" class="btn-primary mt-4 inline-flex">Retour à l'accueil</NuxtLink>
    </div>

    <div v-else-if="remainingSeconds === 0 && order.status === 'pending'" class="mx-auto max-w-md py-24 text-center">
      <p class="text-sm font-medium text-tikeo-error">Le délai de réservation de vos billets est écoulé.</p>
      <NuxtLink v-if="order.event" :to="`/e/${order.event.slug}`" class="btn-primary mt-4 inline-flex">Choisir à nouveau mes billets</NuxtLink>
    </div>

    <div v-else class="grid gap-6 md:grid-cols-[minmax(0,420px)_minmax(0,480px)] md:justify-center">
      <!-- Colonne gauche : événement + panier -->
      <div class="space-y-4">
        <div class="card overflow-hidden">
          <img v-if="order.event?.cover_image" :src="order.event.cover_image" :alt="order.event?.title" class="h-40 w-full object-cover" />
          <div class="p-4">
            <h2 class="text-sm font-bold text-tikeo-black">{{ order.event?.title }}</h2>
            <p class="mt-1.5 flex items-center gap-1.5 text-xs text-tikeo-gray-text">
              <svg class="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3M16 7V3M3.5 9h17M4 5h16a1 1 0 011 1v13a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z" /></svg>
              {{ formattedEventDate }}
            </p>
            <p class="text-xs text-tikeo-gray-text">{{ order.event?.city }}</p>
          </div>
        </div>

        <div class="card p-4">
          <h2 class="mb-3 flex items-center gap-2 text-sm font-semibold text-tikeo-black">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293A1 1 0 006 17h12" /></svg>
            Votre commande
          </h2>
          <div class="space-y-3">
            <div v-for="line in order.order_items" :key="line.id" class="flex items-center justify-between gap-3 text-sm">
              <div>
                <p class="font-medium text-tikeo-black">{{ line.ticket_type?.name }}</p>
                <p class="text-xs text-tikeo-gray-text">{{ line.quantity }} × {{ formatPrice(line.unit_price, order.currency) }}</p>
              </div>
              <p class="shrink-0 font-medium text-tikeo-black">{{ formatPrice(line.total, order.currency) }}</p>
            </div>
          </div>
        </div>

        <div class="card flex items-center justify-between p-4">
          <span class="text-sm text-tikeo-gray-text">Total</span>
          <span class="text-lg font-bold text-tikeo-orange">{{ formatPrice(order.total, order.currency) }}</span>
        </div>
      </div>

      <!-- Colonne droite : commande gratuite → pas de moyen de paiement, juste la récupération du billet -->
      <div v-if="isFreeOrder" class="card p-4 md:p-5">
        <div class="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-tikeo-success/10 text-tikeo-success">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <h2 class="mb-1.5 text-center text-sm font-bold text-tikeo-black">Événement gratuit</h2>
        <p class="mb-4 text-center text-xs text-tikeo-gray-text">
          Aucun paiement n'est nécessaire. Votre billet vous sera envoyé immédiatement par email.
        </p>

        <div class="space-y-1.5 border-t border-tikeo-border pt-3 text-sm">
          <div class="flex items-center justify-between pt-1 text-sm font-bold text-tikeo-black">
            <span>Total</span>
            <span class="text-tikeo-success">Gratuit</span>
          </div>
        </div>

        <label class="mt-4 flex items-start gap-2 text-xs text-tikeo-gray-text">
          <input v-model="acceptedTerms" type="checkbox" class="mt-0.5" />
          <span>
            J'accepte les
            <NuxtLink to="/conditions" class="underline">conditions générales de vente</NuxtLink>
            et la
            <NuxtLink to="/confidentialite" class="underline">politique de confidentialité</NuxtLink>.
          </span>
        </label>

        <p v-if="payErrorCode" class="mt-2 text-xs font-medium text-tikeo-error">
          {{ payErrorMessage }}
        </p>

        <button type="button" class="btn-primary mt-4 w-full" :disabled="!acceptedTerms || submitting" @click="handleClaimFree">
          <span v-if="submitting">Envoi de votre billet…</span>
          <span v-else>Recevoir mon billet par email</span>
        </button>
      </div>

      <!-- Colonne droite : méthode de paiement -->
      <div v-else class="card p-4 md:p-5">
        <h2 class="mb-4 text-center text-sm font-bold text-tikeo-black">Méthode de paiement</h2>

        <label class="mb-1.5 block text-xs font-medium text-tikeo-gray-text">Pays *</label>
        <select v-model="selectedCountryCode" class="input-field mb-4">
          <option v-for="c in countries" :key="c.code" :value="c.code">{{ c.flag }} {{ c.name }}</option>
        </select>

        <div class="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            v-for="m in PAYMENT_METHODS"
            :key="m.id"
            type="button"
            class="flex flex-col items-center gap-1.5 border p-3 text-xs font-medium transition"
            :class="selectedMethod === m.id ? 'border-tikeo-orange-strong bg-tikeo-orange/5 text-tikeo-orange-strong' : 'border-tikeo-border text-tikeo-gray-text hover:border-tikeo-black/30'"
            @click="selectedMethod = m.id"
          >
            <span class="flex h-8 items-center justify-center">
              <img
                v-for="(logo, i) in m.logos"
                :key="logo.src"
                :src="logo.src"
                :alt="logo.alt"
                loading="lazy"
                class="rounded-full bg-white object-cover ring-1 ring-black/5"
                :class="m.logos.length > 1 ? ['h-6 w-6', i > 0 ? '-ml-2' : ''] : 'h-8 w-8'"
                :style="m.logos.length > 1 ? { zIndex: m.logos.length - i } : undefined"
              />
            </span>
            <span class="leading-tight">{{ m.label }}</span>
          </button>
        </div>

        <p v-if="!paymentAvailable" class="mb-4 border border-dashed border-tikeo-border p-3 text-xs text-tikeo-gray-text">
          Le paiement en ligne n'est pour l'instant disponible qu'en Côte d'Ivoire. Sélectionnez « Côte d'Ivoire » pour continuer.
        </p>

        <div class="space-y-1.5 border-t border-tikeo-border pt-3 text-sm">
          <div class="flex items-center justify-between text-tikeo-gray-text"><span>Sous-total</span><span>{{ formatPrice(order.subtotal, order.currency) }}</span></div>
          <div v-if="order.fees > 0" class="flex items-center justify-between text-tikeo-gray-text"><span>Frais</span><span>{{ formatPrice(order.fees, order.currency) }}</span></div>
          <div v-if="order.discount" class="flex items-center justify-between text-green-700">
            <span>Réduction<span v-if="order.promo_code" class="ml-1 text-xs">({{ order.promo_code }})</span></span>
            <span>-{{ formatPrice(order.discount, order.currency) }}</span>
          </div>
          <div class="flex items-center justify-between pt-1 text-sm font-bold text-tikeo-black"><span>Total</span><span>{{ formatPrice(order.total, order.currency) }}</span></div>
        </div>

        <label class="mt-4 flex items-start gap-2 text-xs text-tikeo-gray-text">
          <input v-model="acceptedTerms" type="checkbox" class="mt-0.5" />
          <span>
            J'accepte les
            <NuxtLink to="/conditions" class="underline">conditions générales de vente</NuxtLink>
            et la
            <NuxtLink to="/confidentialite" class="underline">politique de confidentialité</NuxtLink>.
          </span>
        </label>

        <p v-if="payErrorCode" class="mt-2 text-xs font-medium text-tikeo-error">
          {{ payErrorMessage }}
        </p>

        <button
          type="button"
          class="btn-primary mt-4 w-full"
          :disabled="!acceptedTerms || !paymentAvailable || submitting"
          @click="handlePay"
        >
          <span v-if="submitting">Redirection en cours…</span>
          <span v-else>Payer avec {{ PAYMENT_METHODS.find((m) => m.id === selectedMethod)?.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
