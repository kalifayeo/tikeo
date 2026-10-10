/**
 * Intégration Jèko (https://developer.jeko.africa) — Jèko Checkout.
 *
 * Flux « API direct » (forceProviderDirect) : la page de paiement hébergée par
 * Jèko (saisie du numéro, etc.) n'est JAMAIS affichée. Notre serveur connaît déjà
 * le moyen de paiement et le numéro du payeur :
 *   - Wave / Orange Money / Djamo : Jèko renvoie directement l'URL de l'opérateur ;
 *     l'acheteur paie dans son application puis revient sur NOS pages
 *     (successUrl / errorUrl) ;
 *   - MTN MoMo / Moov Money : l'opérateur pousse une demande de code (USSD) sur le
 *     téléphone du payeur, il n'y a aucune page à ouvrir : Tikeo affiche son propre
 *     écran d'attente. Jèko travaille en arrière-plan et nous prévient par webhook.
 * Le résultat DÉFINITIF arrive par webhook signé
 * (voir server/api/payments/jeko/webhook.post.ts) — jamais par le retour du
 * navigateur, qui peut être fermé ou falsifié.
 *
 * Variables d'environnement (serveur uniquement, jamais exposées au client) :
 *   JEKO_API_KEY        clé API (X-API-KEY)            — Dashboard > Paramètres > API & Webhooks
 *   JEKO_API_KEY_ID     identifiant de la clé (X-API-KEY-ID) — même écran
 *   JEKO_STORE_ID       identifiant du magasin (optionnel : sinon GET /partner_api/stores)
 *   JEKO_WEBHOOK_SECRET secret de signature des webhooks (HMAC-SHA256)
 *
 * Ce fichier ne doit être importé que depuis server/.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

const JEKO_BASE_URL = 'https://api.jeko.africa/partner_api'

/** Moyens de paiement acceptés par l'API Jèko pour un encaissement redirect. */
export const JEKO_PAYMENT_METHODS = ['wave', 'orange', 'mtn', 'moov', 'djamo'] as const
export type JekoPaymentMethod = (typeof JEKO_PAYMENT_METHODS)[number]

export function isJekoPaymentMethod(value: unknown): value is JekoPaymentMethod {
  return typeof value === 'string' && (JEKO_PAYMENT_METHODS as readonly string[]).includes(value)
}

function notConfigured(): never {
  console.error('[jeko] JEKO_API_KEY / JEKO_API_KEY_ID absents des variables d\'environnement — paiement impossible.')
  throw createError({
    statusCode: 500,
    statusMessage: 'PAYMENT_NOT_CONFIGURED',
    data: { code: 'PAYMENT_NOT_CONFIGURED' },
  })
}

function credentials() {
  const config = useRuntimeConfig()
  if (!config.jekoApiKey || !config.jekoApiKeyId) notConfigured()
  return {
    headers: {
      'X-API-KEY': String(config.jekoApiKey).trim(),
      'X-API-KEY-ID': String(config.jekoApiKeyId).trim(),
      'Content-Type': 'application/json',
    },
  }
}

function providerError(label: string, e: any): never {
  // Détail complet dans les logs serveur (statut HTTP + corps renvoyé par Jèko).
  const status = e?.statusCode ?? e?.response?.status ?? 'réseau'
  const body = e?.data ?? e?.response?._data ?? e?.message ?? e
  console.error(`[jeko] ${label} — HTTP ${status} :`, typeof body === 'string' ? body : JSON.stringify(body))
  // En développement uniquement, le détail est aussi renvoyé au navigateur
  // (onglet Réseau > réponse de /api/orders/:id/pay) pour diagnostiquer vite.
  const detail = import.meta.dev ? { status, body } : undefined
  throw createError({
    statusCode: 502,
    statusMessage: 'PAYMENT_PROVIDER_ERROR',
    data: { code: 'PAYMENT_PROVIDER_ERROR', ...(detail ? { detail } : {}) },
  })
}

// Le magasin ne change pas pendant la vie d'une instance serveur : on le mémorise.
let cachedStoreId: string | null = null

async function resolveStoreId(): Promise<string> {
  const config = useRuntimeConfig()
  if (config.jekoStoreId) return String(config.jekoStoreId).trim()
  if (cachedStoreId) return cachedStoreId

  const { headers } = credentials()
  const res = await $fetch<any>(`${JEKO_BASE_URL}/stores`, { headers }).catch((e) => providerError('échec lecture des magasins', e))
  const stores: any[] = Array.isArray(res) ? res : (res?.data ?? res?.stores ?? res?.items ?? [])
  const id = stores?.[0]?.id ?? stores?.[0]?.storeId
  if (!id) {
    console.error('[jeko] aucun magasin trouvé — renseignez JEKO_STORE_ID. Réponse :', res)
    throw createError({ statusCode: 500, statusMessage: 'PAYMENT_NOT_CONFIGURED', data: { code: 'PAYMENT_NOT_CONFIGURED' } })
  }
  cachedStoreId = String(id)
  return cachedStoreId
}

interface InitPaymentParams {
  /** Référence unique de la tentative (5 à 100 caractères) — renvoyée telle quelle dans le webhook. */
  reference: string
  /** Montant en unités monétaires (F CFA) — converti en centimes ici. */
  amount: number
  currency: string
  paymentMethod: JekoPaymentMethod
  successUrl: string
  errorUrl: string
  /** Numéro du payeur au format +225XXXXXXXXXX. S'il est fourni, le mode « API direct » est activé. */
  payerPhone?: string
}

interface JekoPaymentRequest {
  id: string
  storeId: string
  reference: string
  type: string
  paymentMethod: string
  status: 'pending' | 'success' | 'error' | string
  redirectUrl?: string | null
  errorReason?: string | null
  transaction?: {
    id: string
    amount?: { amount: number; currency: string }
    fees?: { amount: number; currency: string }
    status?: string
  } | null
}

/** Réseaux qui confirment par USSD : aucune page à ouvrir côté acheteur. */
export const JEKO_USSD_METHODS: readonly JekoPaymentMethod[] = ['mtn', 'moov']

/**
 * Crée une demande de paiement chez Jèko.
 *  - `redirectUrl` : URL de l'opérateur (Wave / Orange / Djamo) vers laquelle envoyer l'acheteur ;
 *    `null` pour MTN / Moov (USSD) : il ne faut alors rien ouvrir, juste attendre la confirmation.
 */
export async function createJekoPaymentRequest(
  params: InitPaymentParams
): Promise<{ redirectUrl: string | null; paymentRequestId: string; mode: 'redirect' | 'ussd' }> {
  const { headers } = credentials()
  const storeId = await resolveStoreId()

  const res = await $fetch<JekoPaymentRequest>(`${JEKO_BASE_URL}/payment_requests`, {
    method: 'POST',
    headers,
    body: {
      storeId,
      // Jèko compte en centimes, par multiples de 100.
      amountCents: Math.round(params.amount) * 100,
      currency: params.currency === 'FCFA' || params.currency === 'CFA' ? 'XOF' : params.currency,
      reference: params.reference,
      paymentDetails: {
        type: 'redirect',
        data: {
          paymentMethod: params.paymentMethod,
          successUrl: params.successUrl,
          errorUrl: params.errorUrl,
          ...(params.payerPhone ? { forceProviderDirect: true, payerPhone: params.payerPhone } : {}),
        },
      },
    },
  }).catch((e) => directProviderError(e, !!params.payerPhone))

  const isUssd = !!params.payerPhone && (JEKO_USSD_METHODS as readonly string[]).includes(params.paymentMethod)
  if (isUssd) {
    // MTN / Moov : `redirectUrl` retombe sur la page hébergée Jèko — on ne la montre jamais.
    return { redirectUrl: null, paymentRequestId: res.id, mode: 'ussd' }
  }

  if (!res?.redirectUrl) {
    console.error('[jeko] réponse inattendue (pas de redirectUrl) :', res)
    throw createError({ statusCode: 502, statusMessage: 'PAYMENT_PROVIDER_ERROR', data: { code: 'PAYMENT_PROVIDER_ERROR' } })
  }

  return { redirectUrl: res.redirectUrl, paymentRequestId: res.id, mode: 'redirect' }
}

/**
 * Erreurs propres au mode direct : Jèko répond 400 `third_party_payment_provider_error`
 * quand l'OPÉRATEUR refuse l'appel (le plus souvent : numéro qui ne correspond pas au
 * moyen de paiement choisi). Ce cas est expliqué à l'acheteur au lieu d'un message générique.
 */
function directProviderError(e: any, direct: boolean): never {
  const status = e?.statusCode ?? e?.response?.status
  const body = e?.data ?? e?.response?._data
  const id = body?.id ?? body?.code ?? body?.error?.id
  if (direct && status === 400 && id === 'third_party_payment_provider_error') {
    console.warn('[jeko] appel opérateur refusé en mode direct :', JSON.stringify(body))
    throw createError({ statusCode: 422, statusMessage: 'PAYMENT_PHONE_REFUSED', data: { code: 'PAYMENT_PHONE_REFUSED' } })
  }
  if (direct && status === 422) {
    console.warn('[jeko] numéro refusé par la validation Jèko :', JSON.stringify(body))
    throw createError({ statusCode: 422, statusMessage: 'PAYMENT_PHONE_INVALID', data: { code: 'PAYMENT_PHONE_INVALID' } })
  }
  return providerError('échec création de la demande de paiement', e)
}

/**
 * Relit une demande de paiement DIRECTEMENT chez Jèko (appel authentifié avec
 * nos clés). Le webhook ne sert qu'à nous dire « regarde cette demande » :
 * le statut et le montant retenus sont toujours ceux renvoyés ici.
 */
export async function getJekoPaymentRequest(paymentRequestId: string) {
  const { headers } = credentials()
  const res = await $fetch<JekoPaymentRequest>(`${JEKO_BASE_URL}/payment_requests/${encodeURIComponent(paymentRequestId)}`, { headers })
    .catch((e) => providerError('échec vérification de la demande de paiement', e))

  return {
    success: res.status === 'success',
    status: res.status,
    reference: res.reference,
    /** Montant réellement encaissé, en centimes (undefined si Jèko ne le renvoie pas). */
    amountCents: res.transaction?.amount?.amount,
    currency: res.transaction?.amount?.currency,
  }
}

/**
 * Vérifie la signature d'un webhook : HMAC-SHA256 du CORPS BRUT, en hexadécimal
 * minuscule, dans l'en-tête `Jeko-Signature`. Comparaison à temps constant.
 */
export function verifyJekoSignature(rawBody: string, signature: string | undefined): boolean {
  const secret = String(useRuntimeConfig().jekoWebhookSecret || '')
  if (!secret || !signature) return false

  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const received = signature.trim().toLowerCase()
  if (received.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(received, 'utf8'), Buffer.from(expected, 'utf8'))
}
