import { requireCsrf } from '~/server/utils/csrf'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { sendTransactionalEmail, ticketsEmailTemplate } from '~/server/utils/brevo'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ERROR_STATUS: Record<string, number> = {
  ORDER_NOT_FOUND: 404,
  ORDER_NOT_PAYABLE: 409,
}

/**
 * POST /api/orders/:id/claim-free — récupère les billets d'une commande
 * dont le total est 0 (événement gratuit / billets gratuits), SANS passer
 * par Jèko : il n'y a rien à payer, donc pas de page de paiement à
 * afficher (voir pages/commande/[id]/index.vue).
 *
 * Réutilise exactement le même chemin de validation qu'un paiement réel
 * (fonction SQL confirm_order_payment(), migration 0019/0025) : un seul
 * code fait passer une commande à « payée » et génère les billets, que ce
 * soit via Jèko, l'admin, ou ici. La seule différence est provider = 'free'.
 *
 * SÉCURITÉ : on revérifie en base que order.total vaut bien 0 avant
 * d'appeler confirm_order_payment — impossible de « débloquer » une
 * commande payante en appelant cette route directement.
 */
export default defineEventHandler(async (event) => {
  requireCsrf(event)
  await checkRateLimit(event, { key: 'orders-claim-free', max: 15, windowMs: 10 * 60 * 1000 })

  const { userId, email } = await requireUser(event)

  const orderId = getRouterParam(event, 'id') ?? ''
  if (!UUID_RE.test(orderId)) {
    throw createError({ statusCode: 400, statusMessage: 'INVALID_ORDER_ID', data: { code: 'INVALID_ORDER_ID' } })
  }

  const supabaseAdmin = useSupabaseAdmin()

  // Compte actif ? (même contrôle que /api/orders et /api/orders/:id/pay).
  const { data: payerProfile } = await supabaseAdmin.from('profiles').select('status').eq('user_id', userId).maybeSingle()
  if (payerProfile?.status === 'suspended') {
    throw createError({ statusCode: 403, statusMessage: 'ACCOUNT_SUSPENDED', data: { code: 'ACCOUNT_SUSPENDED' } })
  }

  // La commande doit exister, appartenir à l'acheteur, être encore payable,
  // ne pas avoir expiré, et — condition propre à cette route — être à 0.
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, status, total, currency, expires_at')
    .eq('id', orderId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[api/orders/claim-free] échec de lecture de la commande :', error)
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
  if (Math.round(Number(order.total)) !== 0) {
    // Commande payante : cette route n'est pas le bon chemin, il faut /pay.
    throw createError({ statusCode: 409, statusMessage: 'ORDER_NOT_FREE', data: { code: 'ORDER_NOT_FREE' } })
  }

  const { data, error: confirmError } = await supabaseAdmin.rpc('confirm_order_payment', {
    p_order_id: orderId,
    p_provider: 'free',
    p_transaction_reference: null,
  })

  if (confirmError) {
    const code = String(confirmError.message ?? '').trim()
    if (code in ERROR_STATUS) {
      throw createError({ statusCode: ERROR_STATUS[code], statusMessage: code, data: { code } })
    }
    console.error('[api/orders/claim-free] échec confirm_order_payment :', confirmError)
    throw createError({ statusCode: 500, statusMessage: 'CONFIRM_FAILED', data: { code: 'CONFIRM_FAILED' } })
  }

  const summary = data as {
    order: { id: string; order_number: string; total: number; currency: string }
    buyer: { email: string | null; full_name: string | null }
    event: { title: string; start_date: string; location_name: string | null; city: string | null; cover_image: string | null }
    tickets: Array<{ ticket_number: string; type_name: string; price: number; qr_token: string | null }>
  }

  // Email non bloquant : les billets sont déjà enregistrés même si l'envoi échoue.
  const recipientEmail = summary?.buyer?.email || email
  if (recipientEmail) {
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
        to: recipientEmail,
        toName: summary.buyer.full_name || recipientEmail,
        subject,
        htmlContent: html,
        attachments,
      })
    } catch (e) {
      console.error('[api/orders/claim-free] échec envoi email billets :', e)
    }
  }

  await supabaseAdmin.from('audit_logs').insert({
    user_id: userId,
    action: 'ORDER_PAYMENT_CONFIRMED',
    entity_type: 'orders',
    entity_id: orderId,
    metadata: { provider: 'free', ticketCount: summary?.tickets?.length ?? 0 },
  })

  return { order: summary?.order, ticketCount: summary?.tickets?.length ?? 0 }
})
