/**
 * Intégration CinetPay (https://cinetpay.com) — agrégateur de paiement qui
 * couvre en une seule API Wave, Orange Money, MTN MoMo, Moov Money, Djamo et
 * la carte bancaire en Côte d'Ivoire (et le reste de la zone UEMOA/CEMAC).
 *
 * On utilise le mode "hosted checkout" (v2/payment) : CinetPay renvoie une
 * URL de paiement vers laquelle on redirige l'acheteur. C'est CinetPay qui
 * affiche le choix de l'opérateur et gère l'OTP/QR code — Tikeo ne manipule
 * jamais de numéro de téléphone ni de code secret (pas de scope PCI/mobile
 * money à porter soi-même).
 *
 * Clés à fournir dans .env : CINETPAY_API_KEY, CINETPAY_SITE_ID.
 * Aucune clé n'est exposée au client : ce fichier ne doit être importé que
 * depuis server/.
 */

const CINETPAY_BASE_URL = 'https://api-checkout.cinetpay.com/v2'

/** Regroupe les 4 moyens de paiement de l'écran récap sur les 3 familles CinetPay. */
export type CinetpayChannel = 'ALL' | 'MOBILE_MONEY' | 'CREDIT_CARD' | 'WALLET'

export const PAYMENT_METHOD_TO_CHANNEL: Record<string, CinetpayChannel> = {
  wave: 'WALLET',
  mobile_money: 'MOBILE_MONEY',
  djamo: 'WALLET',
  card: 'CREDIT_CARD',
}

interface InitPaymentParams {
  transactionId: string
  amount: number
  currency: string
  description: string
  notifyUrl: string
  returnUrl: string
  channels: CinetpayChannel
  customerName?: string
  customerEmail?: string
}

interface CinetpayInitResponse {
  code: string
  message: string
  description: string
  data?: { payment_token: string; payment_url: string }
}

function credentials() {
  const config = useRuntimeConfig()
  if (!config.cinetpayApiKey || !config.cinetpaySiteId) {
    // Sans ce `data.code`, le client retombait sur le code générique
    // PAYMENT_INIT_FAILED et la vraie cause (clés absentes) restait invisible.
    console.error('[cinetpay] CINETPAY_API_KEY / CINETPAY_SITE_ID absents du .env — paiement impossible.')
    throw createError({
      statusCode: 500,
      statusMessage: 'PAYMENT_NOT_CONFIGURED',
      data: { code: 'PAYMENT_NOT_CONFIGURED' },
    })
  }
  return { apikey: config.cinetpayApiKey, site_id: config.cinetpaySiteId }
}

/** Ouvre une tentative de paiement chez CinetPay et renvoie l'URL de paiement à laquelle rediriger l'acheteur. */
export async function initCinetpayPayment(params: InitPaymentParams): Promise<{ paymentUrl: string; paymentToken: string }> {
  const { apikey, site_id } = credentials()

  const res = await $fetch<CinetpayInitResponse>(`${CINETPAY_BASE_URL}/payment`, {
    method: 'POST',
    body: {
      apikey,
      site_id,
      transaction_id: params.transactionId,
      amount: params.amount,
      currency: params.currency,
      description: params.description.slice(0, 255),
      notify_url: params.notifyUrl,
      return_url: params.returnUrl,
      channels: params.channels,
      customer_name: params.customerName,
      customer_email: params.customerEmail,
      lang: 'fr',
    },
  }).catch((e) => {
    console.error('[cinetpay] échec initialisation :', e?.data ?? e)
    throw createError({ statusCode: 502, statusMessage: 'PAYMENT_PROVIDER_ERROR', data: { code: 'PAYMENT_PROVIDER_ERROR' } })
  })

  if (res.code !== '201' || !res.data?.payment_url) {
    console.error('[cinetpay] réponse inattendue :', res)
    throw createError({ statusCode: 502, statusMessage: 'PAYMENT_PROVIDER_ERROR', data: { code: 'PAYMENT_PROVIDER_ERROR' } })
  }

  return { paymentUrl: res.data.payment_url, paymentToken: res.data.payment_token }
}

interface CinetpayCheckResponse {
  code: string
  message: string
  data?: {
    status: 'ACCEPTED' | 'REFUSED' | 'CANCELLED' | 'WAITING_CUSTOMER_ACTION_FOR_INSTALLMENT' | string
    amount: number
    currency: string
    payment_method: string
    operator_id: string
  }
}

/**
 * Revérifie l'état d'une transaction DIRECTEMENT auprès de CinetPay (jamais
 * en se fiant au seul corps du webhook, qui peut être rejoué ou falsifié —
 * cahier des charges §64 : le serveur ne fait jamais confiance à une simple
 * affirmation, il revérifie la source de vérité).
 */
export async function checkCinetpayStatus(transactionId: string) {
  const { apikey, site_id } = credentials()

  const res = await $fetch<CinetpayCheckResponse>(`${CINETPAY_BASE_URL}/payment/check`, {
    method: 'POST',
    body: { apikey, site_id, transaction_id: transactionId },
  }).catch((e) => {
    console.error('[cinetpay] échec vérification :', e?.data ?? e)
    throw createError({ statusCode: 502, statusMessage: 'PAYMENT_PROVIDER_ERROR', data: { code: 'PAYMENT_PROVIDER_ERROR' } })
  })

  return {
    accepted: res.data?.status === 'ACCEPTED',
    status: res.data?.status ?? 'UNKNOWN',
    amount: res.data?.amount ?? 0,
    currency: res.data?.currency ?? '',
    paymentMethod: res.data?.payment_method ?? '',
  }
}
