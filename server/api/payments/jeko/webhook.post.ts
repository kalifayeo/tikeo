import { getJekoPaymentRequest, verifyJekoSignature } from '~/server/utils/jeko'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { sendTransactionalEmail, ticketsEmailTemplate } from '~/server/utils/brevo'

/**
 * POST /api/payments/jeko/webhook — notification serveur-à-serveur envoyée par
 * Jèko quand une transaction est terminée (événement TRANSACTION_COMPLETED).
 * À déclarer dans Jèko : Dashboard > Paramètres > API & Webhooks, URL HTTPS
 *   https://<votre-domaine>/api/payments/jeko/webhook
 *
 * SÉCURITÉ (cahier des charges §64 : le serveur ne fait jamais confiance à une
 * simple affirmation reçue de l'extérieur) :
 *   1. La signature HMAC-SHA256 (en-tête Jeko-Signature) est vérifiée sur le
 *      CORPS BRUT, avec le secret webhook. Sans signature valide → 401.
 *   2. Le corps ne sert ensuite qu'à retrouver QUELLE commande est concernée
 *      (référence) : le statut et le montant sont relus chez Jèko avec nos
 *      propres clés API (GET payment_requests/:id).
 *   3. Le montant encaissé doit correspondre exactement au total de la commande.
 *   4. La validation passe par confirm_order_payment() (même fonction SQL que la
 *      confirmation manuelle admin) : un seul chemin de code marque « payée ».
 *
 * Idempotent : Jèko réessaie jusqu'à 3 fois ; une commande déjà payée est ignorée.
 * On répond 200 pour tout cas « légitime » (échec, doublon, inconnu) afin
 * d'éviter des relances inutiles — et 5xx seulement pour une panne transitoire.
 */
export default defineEventHandler(async (event) => {
  const rawBody = (await readRawBody(event, 'utf8')) ?? ''
  const signature = getHeader(event, 'jeko-signature')

  if (!verifyJekoSignature(rawBody, signature)) {
    console.warn('[webhook/jeko] signature invalide ou secret absent — requête rejetée.')
    // Trace de sécurité (visible dans Admin > Journal), limitée pour qu'un attaquant
    // ne puisse pas inonder le journal en répétant des appels falsifiés.
    try {
      await checkRateLimit(event, { key: 'webhook-bad-signature', max: 20, windowMs: 10 * 60 * 1000 })
      await useSupabaseAdmin().from('audit_logs').insert({
        action: 'SECURITY_WEBHOOK_BAD_SIGNATURE',
        entity_type: 'payments',
        metadata: { ip: getRequestIP(event, { xForwardedFor: true }) || 'unknown', hasSignature: !!signature },
      })
    } catch {
      // limite atteinte ou journal indisponible : le rejet 401 ci-dessous reste prioritaire
    }
    throw createError({ statusCode: 401, statusMessage: 'INVALID_SIGNATURE' })
  }

  const eventName = getHeader(event, 'jeko-event')
  if (eventName && eventName !== 'TRANSACTION_COMPLETED') {
    return { received: true } // escrow, rattachement, conformité… : sans objet pour Tikeo
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'INVALID_JSON' })
  }

  // Seuls les encaissements réussis nous intéressent (un paiement en échec
  // n'envoie de toute façon pas cet événement, et les transferts sont des reversements).
  if (payload?.transactionType !== 'payment' || payload?.status !== 'success') {
    return { received: true }
  }

  const reference = String(payload?.transactionDetails?.reference ?? '').trim()
  const paymentRequestId = String(payload?.transactionDetails?.id ?? '').trim()
  if (!reference || !paymentRequestId) {
    console.warn('[webhook/jeko] référence ou identifiant de demande manquant :', { reference, paymentRequestId })
    return { received: true }
  }

  const supabaseAdmin = useSupabaseAdmin()

  let { data: order, error: findError } = await supabaseAdmin
    .from('orders')
    .select('id, status, total, currency')
    .eq('pending_transaction_ref', reference)
    .maybeSingle()

  if (findError) {
    console.error('[webhook/jeko] échec de recherche de commande :', findError)
    throw createError({ statusCode: 500, statusMessage: 'WEBHOOK_LOOKUP_FAILED' }) // Jèko réessaiera
  }

  // Tentative précédente d'une commande relancée (ex. demande USSD MTN/Moov confirmée après
  // un nouvel essai) : `pending_transaction_ref` ne garde que la dernière référence. Toutes
  // nos références ont la forme TKO-<numéro de commande>-<8 hex> : on retrouve la commande par
  // son numéro. Le montant est de toute façon revérifié chez Jèko plus bas.
  if (!order) {
    const m = /^TKO-(TKO-\d{4}-\d{6,})-[0-9a-f]{8}$/.exec(reference)
    if (m) {
      const byNumber = await supabaseAdmin.from('orders').select('id, status, total, currency').eq('order_number', m[1]).maybeSingle()
      if (byNumber.error) {
        console.error('[webhook/jeko] échec de recherche par numéro de commande :', byNumber.error)
        throw createError({ statusCode: 500, statusMessage: 'WEBHOOK_LOOKUP_FAILED' })
      }
      order = byNumber.data
    }
  }
  if (!order) {
    console.warn('[webhook/jeko] référence inconnue :', reference)
    return { received: true }
  }
  if (order.status !== 'pending') {
    return { received: true } // déjà traitée (relance Jèko) : idempotent
  }

  // Source de vérité : on relit la demande de paiement chez Jèko.
  const check = await getJekoPaymentRequest(paymentRequestId)

  if (check.reference !== reference) {
    console.error('[webhook/jeko] référence incohérente :', { reference, jeko: check.reference })
    return { received: true }
  }
  if (!check.success) {
    console.info('[webhook/jeko] paiement non confirmé par Jèko :', reference, check.status)
    return { received: true }
  }

  // Défense en profondeur : le montant (en centimes) doit être exactement celui de la commande.
  const expectedCents = Math.round(Number(order.total)) * 100
  if (check.amountCents !== expectedCents || (check.currency && check.currency !== order.currency)) {
    console.error('[webhook/jeko] montant incohérent :', { reference, expectedCents, check, order })
    throw createError({ statusCode: 409, statusMessage: 'AMOUNT_MISMATCH' })
  }

  const { data, error } = await supabaseAdmin.rpc('confirm_order_payment', {
    p_order_id: order.id,
    p_provider: 'jeko',
    p_transaction_reference: reference,
  })

  if (error) {
    // ORDER_NOT_PAYABLE : une autre notification a déjà tout confirmé (verrou pris
    // dans confirm_order_payment) → idempotent, pas une erreur.
    if (String(error.message).trim() === 'ORDER_NOT_PAYABLE') return { received: true }
    console.error('[webhook/jeko] échec confirm_order_payment :', error)
    throw createError({ statusCode: 500, statusMessage: 'CONFIRM_FAILED' })
  }

  const summary = data as {
    order: { id: string; order_number: string; total: number; currency: string }
    buyer: { email: string | null; full_name: string | null }
    event: { title: string; start_date: string; location_name: string | null; city: string | null; cover_image: string | null }
    tickets: Array<{ ticket_number: string; type_name: string; price: number; qr_token: string | null }>
  }

  // Email non bloquant : le paiement et les billets sont déjà enregistrés même si l'envoi échoue.
  if (summary?.buyer?.email) {
    try {
      const { subject, html, attachments } = await ticketsEmailTemplate({
        orderNumber: summary.order.order_number,
        total: summary.order.total,
        currency: summary.order.currency,
        eventTitle: summary.event.title,
        eventDate: summary.event.start_date,
        eventLocation: summary.event.location_name || summary.event.city || '',
        eventCoverImage: summary.event.cover_image,
        holderName: summary.buyer?.full_name,
        tickets: summary.tickets ?? [],
      })
      await sendTransactionalEmail({
        to: summary.buyer.email,
        toName: summary.buyer.full_name || summary.buyer.email,
        subject,
        htmlContent: html,
        attachments,
      })
    } catch (e) {
      console.error('[webhook/jeko] échec envoi email billets :', e)
    }
  }

  await supabaseAdmin.from('audit_logs').insert({
    action: 'ORDER_PAYMENT_CONFIRMED',
    entity_type: 'orders',
    entity_id: order.id,
    metadata: { provider: 'jeko', transactionReference: reference, ticketCount: summary?.tickets?.length ?? 0 },
  })

  return { received: true }
})
