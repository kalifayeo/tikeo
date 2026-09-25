import { checkCinetpayStatus } from '~/server/utils/cinetpay'
import { sendTransactionalEmail, ticketsEmailTemplate } from '~/server/utils/brevo'

/**
 * POST /api/payments/cinetpay/webhook — notification serveur-à-serveur
 * (notify_url) envoyée par CinetPay quand une transaction est traitée.
 *
 * SÉCURITÉ (cahier des charges §64 : le serveur ne fait jamais confiance à
 * une simple affirmation reçue de l'extérieur) :
 *   1. Le corps du webhook ne sert qu'à retrouver QUEL identifiant de
 *      transaction est concerné — on ne lit ni son statut ni son montant.
 *   2. On revérifie IMMÉDIATEMENT le statut réel auprès de CinetPay
 *      (checkCinetpayStatus, appel authentifié avec notre propre apikey).
 *   3. On revérifie que le montant confirmé correspond au total de la
 *      commande en base avant de valider quoi que ce soit.
 *   4. La validation elle-même passe par confirm_order_payment() (même
 *      fonction SQL que la confirmation manuelle admin, migration 0019) :
 *      un seul chemin de code fait passer une commande à « payée ».
 *
 * Toujours répondre 200 une fois le traitement terminé (succès ou rejet
 * légitime) pour éviter que CinetPay ne renvoie indéfiniment la même
 * notification ; ne renvoyer une erreur que pour un problème transitoire
 * qui justifie un nouvel essai de leur part.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, unknown>>(event).catch(() => ({}))
  const transactionId = String(body?.cpm_trans_id ?? body?.transaction_id ?? '').trim()

  if (!transactionId) {
    throw createError({ statusCode: 400, statusMessage: 'MISSING_TRANSACTION_ID' })
  }

  const supabaseAdmin = useSupabaseAdmin()

  const { data: order, error: findError } = await supabaseAdmin
    .from('orders')
    .select('id, status, total, currency')
    .eq('pending_transaction_ref', transactionId)
    .maybeSingle()

  if (findError) {
    console.error('[webhook/cinetpay] échec de recherche de commande :', findError)
    throw createError({ statusCode: 500, statusMessage: 'WEBHOOK_LOOKUP_FAILED' })
  }
  if (!order) {
    // Transaction inconnue (rejouée, expérimentée par un tiers, etc.) : rien à faire.
    console.warn('[webhook/cinetpay] transaction inconnue :', transactionId)
    return { received: true }
  }
  if (order.status !== 'pending') {
    // Déjà traitée (webhook potentiellement reçu deux fois) : idempotent.
    return { received: true }
  }

  const check = await checkCinetpayStatus(transactionId)

  if (!check.accepted) {
    // Paiement refusé/annulé côté opérateur : la commande reste « pending »
    // jusqu'à expiration (release_expired_orders, migration 0017) — l'acheteur
    // peut retenter un paiement depuis la page récapitulatif.
    console.info('[webhook/cinetpay] paiement non accepté :', transactionId, check.status)
    return { received: true }
  }

  // Défense en profondeur : le montant confirmé par CinetPay doit correspondre
  // exactement à ce que la commande doit réellement (jamais une valeur du webhook).
  if (Math.round(check.amount) !== Math.round(Number(order.total)) || check.currency !== order.currency) {
    console.error('[webhook/cinetpay] montant incohérent :', { transactionId, check, order })
    throw createError({ statusCode: 409, statusMessage: 'AMOUNT_MISMATCH' })
  }

  const { data, error } = await supabaseAdmin.rpc('confirm_order_payment', {
    p_order_id: order.id,
    p_provider: 'cinetpay',
    p_transaction_reference: transactionId,
  })

  if (error) {
    // ORDER_NOT_PAYABLE veut dire qu'une autre notification a déjà tout confirmé
    // entre-temps (verrou pris dans confirm_order_payment) : idempotent, pas une erreur.
    if (String(error.message).trim() === 'ORDER_NOT_PAYABLE') return { received: true }
    console.error('[webhook/cinetpay] échec confirm_order_payment :', error)
    throw createError({ statusCode: 500, statusMessage: 'CONFIRM_FAILED' })
  }

  const summary = data as {
    order: { id: string; order_number: string; total: number; currency: string }
    buyer: { email: string | null; full_name: string | null }
    event: { title: string; start_date: string; location_name: string | null; city: string | null }
    tickets: Array<{ ticket_number: string; type_name: string; price: number }>
  }

  if (summary?.buyer?.email) {
    try {
      const { subject, html } = ticketsEmailTemplate({
        orderNumber: summary.order.order_number,
        total: summary.order.total,
        currency: summary.order.currency,
        eventTitle: summary.event.title,
        eventDate: summary.event.start_date,
        eventLocation: summary.event.location_name || summary.event.city || '',
        tickets: summary.tickets ?? [],
      })
      await sendTransactionalEmail({
        to: summary.buyer.email,
        toName: summary.buyer.full_name || summary.buyer.email,
        subject,
        htmlContent: html,
      })
    } catch (e) {
      console.error('[webhook/cinetpay] échec envoi email billets :', e)
    }
  }

  await supabaseAdmin.from('audit_logs').insert({
    action: 'ORDER_PAYMENT_CONFIRMED',
    entity_type: 'orders',
    entity_id: order.id,
    metadata: { provider: 'cinetpay', transactionReference: transactionId, ticketCount: summary?.tickets?.length ?? 0 },
  })

  return { received: true }
})
