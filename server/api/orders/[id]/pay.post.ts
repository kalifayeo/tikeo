import { randomBytes } from 'node:crypto'
import { requireCsrf } from '~/server/utils/csrf'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { getSiteOrigin } from '~/server/utils/siteOrigin'
import { initCinetpayPayment, PAYMENT_METHOD_TO_CHANNEL } from '~/server/utils/cinetpay'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST /api/orders/:id/pay — initialise un paiement CinetPay pour une
 * commande « pending » et renvoie l'URL de paiement hébergée à laquelle
 * rediriger l'acheteur (Wave / Mobile Money / Djamo / carte, cf. §24-26).
 *
 * Corps attendu : { method: 'wave' | 'mobile_money' | 'djamo' | 'card' }
 * (sert uniquement à présélectionner la famille de moyens de paiement côté
 * CinetPay — aucune donnée sensible ne transite par ici).
 */
export default defineEventHandler(async (event) => {
  requireCsrf(event)
  checkRateLimit(event, { key: 'orders-pay', max: 15, windowMs: 10 * 60 * 1000 })

  const { userId, email } = await requireUser(event)

  const orderId = getRouterParam(event, 'id') ?? ''
  if (!UUID_RE.test(orderId)) {
    throw createError({ statusCode: 400, statusMessage: 'INVALID_ORDER_ID', data: { code: 'INVALID_ORDER_ID' } })
  }

  const body = await readBody<{ method?: unknown }>(event).catch(() => ({}) as any)
  const method = typeof body?.method === 'string' ? body.method : 'mobile_money'
  const channel = PAYMENT_METHOD_TO_CHANNEL[method] ?? 'ALL'

  const supabaseAdmin = useSupabaseAdmin()

  // Compte actif ? (un compte peut être suspendu entre la création de la
  // commande et le passage au paiement — même contrôle que /api/orders).
  const { data: payerProfile } = await supabaseAdmin.from('profiles').select('status').eq('user_id', userId).maybeSingle()
  if (payerProfile?.status === 'suspended') {
    throw createError({ statusCode: 403, statusMessage: 'ACCOUNT_SUSPENDED', data: { code: 'ACCOUNT_SUSPENDED' } })
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

  // Identifiant de transaction unique par tentative : une commande relancée
  // après échec obtient un nouvel identifiant (CinetPay refuse la réutilisation).
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
  const eventTitle = (order as any).event?.title ?? 'Billet Tikeo'

  const { paymentUrl } = await initCinetpayPayment({
    transactionId,
    amount: Math.round(Number(order.total)),
    currency: order.currency,
    description: `Commande ${order.order_number} — ${eventTitle}`,
    notifyUrl: `${siteOrigin}/api/payments/cinetpay/webhook`,
    returnUrl: `${siteOrigin}/commande/${orderId}/retour`,
    channels: channel,
    customerEmail: email ?? undefined,
  })

  return { paymentUrl }
})
