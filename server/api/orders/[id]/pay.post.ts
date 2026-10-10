import { randomBytes } from 'node:crypto'
import { requireCsrf } from '~/server/utils/csrf'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { getSiteOrigin } from '~/server/utils/siteOrigin'
import { createJekoPaymentRequest, isJekoPaymentMethod } from '~/server/utils/jeko'
import { maskIvorianPhone, normalizeIvorianPhone } from '~/server/utils/phone'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST /api/orders/:id/pay — initialise un paiement Jèko (Jèko Checkout) pour
 * une commande « pending » et renvoie l'URL de paiement à laquelle rediriger
 * l'acheteur (Wave / Orange Money / MTN MoMo / Moov Money / Djamo, cf. §24-26).
 *
 * Corps attendu : { method: 'wave' | 'orange' | 'mtn' | 'moov' | 'djamo', phone?: string }
 *
 * « API direct » Jèko : la page de paiement hébergée par Jèko (saisie du numéro)
 * n'est jamais affichée. Le numéro du payeur est celui de son profil Tikeo
 * (renseigné à l'inscription) ; `phone` ne sert que si le profil n'en a pas, ou
 * pour payer avec un autre numéro (MTN / Moov). Le code secret reste saisi dans
 * l'application de l'opérateur — il ne transite jamais par Tikeo.
 *
 * Réponse :
 *   { mode: 'redirect', paymentUrl }  Wave / Orange / Djamo : envoyer l'acheteur chez l'opérateur
 *   { mode: 'ussd', paymentUrl: null } MTN / Moov : l'opérateur pousse une demande de code sur le
 *                                      téléphone ; Tikeo affiche son écran d'attente
 *
 * Le paiement n'est JAMAIS validé ici : seul le webhook signé de Jèko
 * (server/api/payments/jeko/webhook.post.ts) fait passer la commande à « payée ».
 */
export default defineEventHandler(async (event) => {
  requireCsrf(event)
  await checkRateLimit(event, { key: 'orders-pay', max: 15, windowMs: 10 * 60 * 1000 })

  const { userId, email } = await requireUser(event)

  const orderId = getRouterParam(event, 'id') ?? ''
  if (!UUID_RE.test(orderId)) {
    throw createError({ statusCode: 400, statusMessage: 'INVALID_ORDER_ID', data: { code: 'INVALID_ORDER_ID' } })
  }

  const body = await readBody<{ method?: unknown; phone?: unknown }>(event).catch(() => ({}) as any)
  const method = body?.method
  if (!isJekoPaymentMethod(method)) {
    throw createError({ statusCode: 400, statusMessage: 'INVALID_PAYMENT_METHOD', data: { code: 'INVALID_PAYMENT_METHOD' } })
  }

  const supabaseAdmin = useSupabaseAdmin()

  // Compte actif ? (un compte peut être suspendu entre la création de la
  // commande et le passage au paiement — même contrôle que /api/orders).
  const { data: payerProfile } = await supabaseAdmin.from('profiles').select('status, phone').eq('user_id', userId).maybeSingle()
  if (payerProfile?.status === 'suspended') {
    throw createError({ statusCode: 403, statusMessage: 'ACCOUNT_SUSPENDED', data: { code: 'ACCOUNT_SUSPENDED' } })
  }

  // Numéro du payeur : celui saisi explicitement dans la demande, sinon celui du profil.
  const profilePhone = normalizeIvorianPhone(payerProfile?.phone)
  const typedPhone = typeof body?.phone === 'string' && body.phone.trim() ? normalizeIvorianPhone(body.phone) : null
  if (typeof body?.phone === 'string' && body.phone.trim() && !typedPhone) {
    throw createError({ statusCode: 422, statusMessage: 'PAYMENT_PHONE_INVALID', data: { code: 'PAYMENT_PHONE_INVALID' } })
  }
  const payerPhone = typedPhone ?? profilePhone
  if (!payerPhone) {
    throw createError({ statusCode: 422, statusMessage: 'PHONE_REQUIRED', data: { code: 'PHONE_REQUIRED' } })
  }

  // La commande doit exister, appartenir à l'acheteur, être encore payable
  // et ne pas avoir expiré (la réservation de stock retombe sinon, §48).
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, status, total, currency, expires_at, order_number, event:events(title)')
    .eq('id', orderId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[api/orders/pay] échec de lecture de la commande :', error)
    throw createError({ statusCode: 500, statusMessage: 'ORDER_FETCH_FAILED', data: { code: 'ORDER_FETCH_FAILED' } })
  }
  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'ORDER_NOT_FOUND', data: { code: 'ORDER_NOT_FOUND' } })
  }
  if (order.status !== 'pending') {
    throw createError({ statusCode: 409, statusMessage: 'ORDER_NOT_PAYABLE', data: { code: 'ORDER_NOT_PAYABLE' } })
  }
  if (order.expires_at && new Date(order.expires_at).getTime() < Date.now()) {
    throw createError({ statusCode: 409, statusMessage: 'ORDER_EXPIRED', data: { code: 'ORDER_EXPIRED' } })
  }

  // Référence unique par tentative (5-100 caractères côté Jèko) : une commande
  // relancée après échec obtient une nouvelle référence. Jèko la renvoie telle
  // quelle dans le webhook (transactionDetails.reference), ce qui permet de
  // retrouver la commande.
  const transactionId = `TKO-${order.order_number}-${randomBytes(4).toString('hex')}`

  const { error: updateError } = await supabaseAdmin
    .from('orders')
    .update({ pending_transaction_ref: transactionId })
    .eq('id', orderId)
    .eq('status', 'pending')

  if (updateError) {
    console.error('[api/orders/pay] échec enregistrement de la référence :', updateError)
    throw createError({ statusCode: 500, statusMessage: 'PAYMENT_INIT_FAILED', data: { code: 'PAYMENT_INIT_FAILED' } })
  }

  const siteOrigin = getSiteOrigin(event)
  const returnUrl = `${siteOrigin}/commande/${orderId}/retour`

  const { redirectUrl, mode } = await createJekoPaymentRequest({
    reference: transactionId,
    amount: Number(order.total),
    currency: order.currency,
    paymentMethod: method,
    successUrl: returnUrl,
    errorUrl: `${returnUrl}?status=error`,
    payerPhone,
  })

  // Le numéro n'est mémorisé qu'après un appel réussi, et seulement si le profil n'en avait pas
  // de valide : l'acheteur ne le saisira plus jamais.
  if (!profilePhone) {
    const { error: phoneError } = await supabaseAdmin.from('profiles').update({ phone: payerPhone }).eq('user_id', userId)
    if (phoneError) console.warn('[api/orders/pay] numéro non mémorisé dans le profil :', phoneError.message)
  }

  return { mode, paymentUrl: redirectUrl, phoneMasked: maskIvorianPhone(payerPhone) }
})
