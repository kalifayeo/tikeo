<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const orderId = route.params.id as string
const { order, loading, errorCode, refresh } = useOrderDetail(orderId)

/**
 * L'acheteur revient de CinetPay (return_url) potentiellement AVANT que le
 * webhook serveur (notify_url) n'ait fini de confirmer le paiement. On
 * relit donc la commande à intervalles courts pendant une minute — jamais
 * on ne fait confiance à l'URL de retour elle-même pour dire si c'est payé
 * (cahier des charges §64 : c'est confirm_order_payment(), côté serveur,
 * qui décide, jamais le navigateur).
 */
const POLL_MS = 2500
const MAX_ATTEMPTS = 24 // ~1 minute
let attempts = 0
let timer: ReturnType<typeof setInterval> | undefined

function formatPrice(n: number, currency = 'XOF') {
  return `${n.toLocaleString('fr-FR')} ${currency === 'XOF' ? 'F CFA' : currency}`
}

onMounted(() => {
  timer = setInterval(async () => {
    attempts += 1
    if (order.value?.status !== 'pending' || attempts >= MAX_ATTEMPTS) {
      clearInterval(timer)
      return
    }
    await refresh()
  }, POLL_MS)
})
onUnmounted(() => timer && clearInterval(timer))

const stillWaiting = computed(() => !loading.value && order.value?.status === 'pending' && attempts < MAX_ATTEMPTS)
const timedOut = computed(() => order.value?.status === 'pending' && attempts >= MAX_ATTEMPTS)
</script>

<template>
  <div class="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-10 text-center">
    <div v-if="loading" class="text-sm text-tikeo-gray-text">Vérification du paiement…</div>

    <div v-else-if="!order || errorCode">
      <p class="text-sm font-medium text-tikeo-error">Impossible de retrouver cette commande.</p>
      <NuxtLink to="/" class="btn-primary mt-4 inline-flex">Retour à l'accueil</NuxtLink>
    </div>

    <div v-else-if="order.status === 'paid'" class="w-full">
      <span class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-tikeo-success/10 text-tikeo-success">
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
      </span>
      <h1 class="text-base font-bold text-tikeo-black">Paiement confirmé</h1>
      <p class="mt-1 text-sm text-tikeo-gray-text">Vos billets ont été envoyés par email et sont disponibles dans votre espace.</p>
      <div class="mt-3 border border-dashed border-tikeo-border p-3 text-sm">
        <p class="text-tikeo-gray-text">Commande</p>
        <p class="font-mono font-semibold text-tikeo-black">{{ order.order_number }}</p>
        <p class="mt-1 font-semibold text-tikeo-black">{{ formatPrice(order.total, order.currency) }}</p>
      </div>
      <NuxtLink to="/mon-espace/tableau-de-bord" class="btn-primary mt-4 block w-full">Voir mes billets</NuxtLink>
    </div>

    <div v-else-if="order.status === 'cancelled'">
      <p class="text-sm font-medium text-tikeo-error">Le paiement n'a pas abouti.</p>
      <p class="mt-1 text-xs text-tikeo-gray-text">Aucun montant n'a été débité pour cette tentative.</p>
      <NuxtLink v-if="order.event" :to="`/e/${order.event.slug}`" class="btn-primary mt-4 inline-flex">Réessayer</NuxtLink>
    </div>

    <div v-else-if="timedOut">
      <p class="text-sm font-medium text-tikeo-black">Votre paiement est en cours de traitement.</p>
      <p class="mt-1 text-xs text-tikeo-gray-text">
        Cela peut prendre quelques minutes selon l'opérateur. Vous recevrez vos billets par email dès la confirmation — vous pouvez aussi suivre le statut depuis votre espace.
      </p>
      <NuxtLink to="/mon-espace/commandes" class="btn-primary mt-4 inline-flex">Suivre ma commande</NuxtLink>
    </div>

    <div v-else-if="stillWaiting" class="text-sm text-tikeo-gray-text">
      <svg class="mx-auto mb-3 h-6 w-6 animate-spin text-tikeo-orange" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
      Confirmation du paiement en cours…
    </div>
  </div>
</template>
