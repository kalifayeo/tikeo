<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const orderId = route.params.id as string
// Jèko renvoie ici avec ?status=error (errorUrl) si l'acheteur a annulé ou si le paiement a échoué.
const returnedWithError = route.query.status === 'error'
// MTN / Moov : pas de page opérateur, la confirmation se fait sur le téléphone (USSD) et peut
// prendre plus longtemps — on attend donc plus patiemment et on l'explique à l'acheteur.
const isUssd = route.query.ussd === '1'
const ussdLabel = route.query.m === 'moov' ? 'Moov Money' : 'MTN MoMo'
const ussdMenuCode = route.query.m === 'moov' ? '*155#' : '*133#'
const { order, loading, errorCode, refresh } = useOrderDetail(orderId)

/**
 * L'acheteur revient de Jèko (successUrl / errorUrl) potentiellement AVANT que le
 * webhook serveur n'ait fini de confirmer le paiement. On
 * relit donc la commande à intervalles courts pendant une minute — jamais
 * on ne fait confiance à l'URL de retour elle-même pour dire si c'est payé
 * (cahier des charges §64 : c'est confirm_order_payment(), côté serveur,
 * qui décide, jamais le navigateur).
 */
const POLL_MS = isUssd ? 3000 : 2500
const MAX_ATTEMPTS = isUssd ? 200 : 24 // ~10 minutes en USSD (la demande reste valable 30 min), ~1 minute sinon
// `attempts` est réactif : l'écran d'attente se met à jour tout seul.
const attempts = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

function formatPrice(n: number, currency = 'XOF') {
  return `${n.toLocaleString('fr-FR')} ${currency === 'XOF' ? 'F CFA' : currency}`
}

const isFreeOrder = computed(() => !!order.value && Math.round(Number(order.value.total)) === 0)
const ticketCount = computed(() => (order.value?.order_items ?? []).reduce((n, l) => n + Number(l.quantity || 0), 0))
const eventDateLabel = computed(() => {
  const d = order.value?.event?.start_date
  if (!d) return ''
  const dt = new Date(d)
  return dt.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) + ' à ' + dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
})

onMounted(() => {
  timer = setInterval(async () => {
    attempts.value += 1
    if (order.value?.status !== 'pending' || attempts.value >= MAX_ATTEMPTS || returnedWithError) {
      clearInterval(timer)
      return
    }
    await refresh()
  }, POLL_MS)
})
onUnmounted(() => timer && clearInterval(timer))

const failed = computed(() => returnedWithError && order.value?.status === 'pending')
const stillWaiting = computed(() => !loading.value && order.value?.status === 'pending' && !returnedWithError && attempts.value < MAX_ATTEMPTS)
const timedOut = computed(() => order.value?.status === 'pending' && !returnedWithError && attempts.value >= MAX_ATTEMPTS)

// Titre de l'en-tête selon l'état de la commande.
const heroTitle = computed(() => {
  if (loading.value) return 'Vérification du paiement…'
  const o = order.value
  if (!o || errorCode.value) return 'Commande introuvable'
  if (o.status === 'paid') return isFreeOrder.value ? 'Billet confirmé !' : 'Paiement réussi !'
  if (o.status === 'cancelled' || failed.value) return 'Le paiement n’a pas abouti'
  if (timedOut.value) return 'Paiement en cours de traitement'
  if (isUssd) return 'Confirmez sur votre téléphone'
  return 'Confirmation en cours…'
})

// Barre d'étapes : la confirmation est « faite » une fois la commande payée.
const returnSteps = computed<Array<{ label: string; state: 'done' | 'current' | 'todo' }>>(() => {
  const paid = order.value?.status === 'paid'
  return [
    { label: 'Billets', state: 'done' },
    { label: 'Paiement', state: paid ? 'done' : 'current' },
    { label: 'Confirmation', state: paid ? 'done' : 'todo' },
  ]
})
</script>

<template>
  <div class="pb-12 md:pb-16">
    <PageHero eyebrow="Confirmation de paiement" :title="heroTitle" :steps="returnSteps" />

    <div class="mx-auto max-w-tikeo-container px-4 pt-8 md:px-6 md:pt-12">
      <div class="mx-auto w-full max-w-xl">
        <!-- Chargement -->
        <div v-if="loading" class="acc-empty">
          <svg class="h-8 w-8 animate-spin text-tikeo-orange" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
          <p class="text-sm text-tikeo-gray-text">Vérification du paiement…</p>
        </div>

        <!-- Commande introuvable -->
        <div v-else-if="!order || errorCode" class="acc-empty">
          <span class="flex h-14 w-14 items-center justify-center bg-tikeo-error text-white"><AppIcon name="info" class="h-7 w-7" /></span>
          <p class="font-display text-lg font-bold text-tikeo-black">Impossible de retrouver cette commande.</p>
          <NuxtLink to="/" class="btn-ink mt-1">Retour à l'accueil</NuxtLink>
        </div>

        <!-- Succès : paiement confirmé -->
        <article v-else-if="order.status === 'paid'" class="relative bg-tikeo-surface shadow-card">
          <span class="absolute inset-x-0 top-0 h-1 bg-tikeo-brand" aria-hidden="true" />
          <div class="px-6 pb-6 pt-9 text-center md:px-8">
            <span class="mx-auto flex h-16 w-16 items-center justify-center bg-[#FF7A00] text-tikeo-ink"><AppIcon name="check" class="h-8 w-8" :stroke="3" /></span>
            <h2 class="mt-5 font-display text-2xl font-extrabold tracking-tight text-tikeo-black">{{ isFreeOrder ? 'Billet confirmé !' : 'Paiement réussi !' }}</h2>
            <p class="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-tikeo-gray-text">
              {{ ticketCount > 1 ? `Vos ${ticketCount} billets sont prêts.` : 'Votre billet est prêt.' }}
              Ils ont aussi été envoyés par email.
            </p>
          </div>

          <!-- Perforation -->
          <div class="relative" aria-hidden="true">
            <span class="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-tikeo-gray-light" />
            <span class="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-tikeo-gray-light" />
            <span class="mx-6 block border-t-2 border-dashed border-tikeo-gray-text/35" />
          </div>

          <div class="p-6 md:px-8">
            <p v-if="order.event" class="font-display text-lg font-extrabold leading-tight tracking-tight text-tikeo-black">{{ order.event.title }}</p>
            <ul class="mt-3 space-y-2 text-sm text-tikeo-gray-text">
              <li v-if="eventDateLabel" class="flex items-center gap-2.5">
                <span class="flex h-7 w-7 shrink-0 items-center justify-center bg-[#FF7A00] text-tikeo-ink"><AppIcon name="calendar" class="h-4 w-4" /></span>
                <span class="capitalize">{{ eventDateLabel }}</span>
              </li>
              <li v-if="order.event?.location_name || order.event?.city" class="flex items-center gap-2.5">
                <span class="flex h-7 w-7 shrink-0 items-center justify-center bg-[#FF7A00] text-tikeo-ink"><AppIcon name="pin" class="h-4 w-4" /></span>
                <span>{{ [order.event?.location_name, order.event?.city].filter(Boolean).join(' · ') }}</span>
              </li>
            </ul>

            <div class="mt-5 flex items-end justify-between gap-3 bg-tikeo-ink px-4 py-3.5 text-white">
              <div class="min-w-0">
                <p class="text-[10px] font-bold uppercase tracking-wider text-white/60">Commande</p>
                <p class="mt-0.5 truncate font-mono text-xs font-semibold">{{ order.order_number }}</p>
              </div>
              <p class="font-display text-xl font-extrabold text-[#FF7A00]">{{ isFreeOrder ? 'Gratuit' : formatPrice(order.total, order.currency) }}</p>
            </div>

            <NuxtLink to="/mon-espace/mes-billets" class="btn-brand !h-14 mt-6 w-full text-base">
              <AppIcon name="ticket" class="h-5 w-5" />
              Voir mes billets
            </NuxtLink>
            <div class="mt-4 text-center">
              <NuxtLink to="/" class="text-sm font-bold text-tikeo-black underline decoration-[#FF7A00] decoration-2 underline-offset-[5px] hover:text-tikeo-orange">Retour à l'accueil</NuxtLink>
            </div>
          </div>
        </article>

        <!-- Paiement annulé -->
        <div v-else-if="order.status === 'cancelled'" class="acc-empty">
          <span class="flex h-14 w-14 items-center justify-center bg-tikeo-error text-white"><AppIcon name="close" class="h-7 w-7" :stroke="2.6" /></span>
          <p class="font-display text-lg font-bold text-tikeo-black">Le paiement n'a pas abouti.</p>
          <p class="max-w-sm text-sm text-tikeo-gray-text">Aucun montant n'a été débité pour cette tentative.</p>
          <NuxtLink v-if="order.event" :to="`/e/${order.event.slug}`" class="btn-ink mt-1">Réessayer</NuxtLink>
        </div>

        <!-- Paiement refusé / retour en erreur -->
        <div v-else-if="failed" class="acc-empty">
          <span class="flex h-14 w-14 items-center justify-center bg-tikeo-error text-white"><AppIcon name="close" class="h-7 w-7" :stroke="2.6" /></span>
          <p class="font-display text-lg font-bold text-tikeo-black">Le paiement n'a pas abouti.</p>
          <p class="max-w-sm text-sm leading-relaxed text-tikeo-gray-text">Aucun montant n'a été débité. Vos billets restent réservés quelques minutes : vous pouvez réessayer avec un autre moyen de paiement.</p>
          <NuxtLink :to="`/commande/${orderId}`" class="btn-brand mt-1">Réessayer le paiement</NuxtLink>
        </div>

        <!-- Délai dépassé : traitement long côté opérateur -->
        <div v-else-if="timedOut" class="acc-empty">
          <span class="flex h-14 w-14 items-center justify-center bg-tikeo-ink text-white dark:bg-[#FF7A00] dark:text-tikeo-ink"><AppIcon name="clock" class="h-7 w-7" /></span>
          <p class="font-display text-lg font-bold text-tikeo-black">Votre paiement est en cours de traitement.</p>
          <p class="max-w-sm text-sm leading-relaxed text-tikeo-gray-text">
            Cela peut prendre quelques minutes selon l'opérateur. Vous recevrez vos billets par email dès la confirmation — vous pouvez aussi suivre le statut depuis votre espace.
          </p>
          <NuxtLink to="/mon-espace/mes-commandes" class="btn-ink mt-1">Suivre ma commande</NuxtLink>
        </div>

        <!-- Attente de validation sur téléphone (MTN / Moov) -->
        <div v-else-if="stillWaiting && isUssd" class="bg-tikeo-surface shadow-card">
          <div class="flex items-start gap-4 p-6 md:p-8">
            <span class="flex h-12 w-12 shrink-0 items-center justify-center bg-[#FF7A00] text-tikeo-ink"><AppIcon name="phone" class="h-6 w-6" /></span>
            <div class="min-w-0">
              <h2 class="font-display text-xl font-extrabold tracking-tight text-tikeo-black">Confirmez le paiement sur votre téléphone</h2>
              <p class="mt-2 text-sm leading-relaxed text-tikeo-gray-text">
                Une demande de paiement {{ ussdLabel }} de <span class="font-bold text-tikeo-black">{{ formatPrice(order.total, order.currency) }}</span>
                vient d’être envoyée. Saisissez votre code secret pour valider.
              </p>
              <p class="mt-3 flex items-center gap-2 text-xs text-tikeo-gray-text">
                <svg class="h-4 w-4 shrink-0 animate-spin text-tikeo-orange" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                Cette page se met à jour toute seule dès que le paiement est confirmé. Ne la fermez pas.
              </p>
            </div>
          </div>
          <div class="border-t-2 border-dashed border-tikeo-gray-text/25 bg-tikeo-surface-alt/60 p-5 md:px-8">
            <p class="text-xs leading-relaxed text-tikeo-gray-text">
              Vous n'avez rien reçu ? Composez <span class="font-mono font-bold text-tikeo-black">{{ ussdMenuCode }}</span>
              pour ouvrir votre menu {{ ussdLabel }} et valider la demande en attente. Vérifiez aussi que votre numéro est bien un numéro {{ ussdLabel }}.
            </p>
            <NuxtLink :to="`/commande/${orderId}`" class="mt-3 inline-block text-xs font-bold text-tikeo-black underline decoration-[#FF7A00] decoration-2 underline-offset-[4px] hover:text-tikeo-orange">Changer de moyen de paiement</NuxtLink>
          </div>
        </div>

        <!-- Attente de confirmation (Wave / Orange / Djamo) -->
        <div v-else-if="stillWaiting" class="acc-empty">
          <svg class="h-8 w-8 animate-spin text-tikeo-orange" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
          <p class="text-sm text-tikeo-gray-text">Confirmation du paiement en cours…</p>
        </div>
      </div>
    </div>
  </div>
</template>
