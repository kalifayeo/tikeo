import { requireCsrf } from '~/server/utils/csrf'
import { sendTransactionalEmail, ticketsEmailTemplate } from '~/server/utils/brevo'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ERROR_STATUS: Record<string, number> = {
  ORDER_NOT_FOUND: 404,
  ORDER_NOT_PAYABLE: 409,
}

/**
 * POST /api/orders/:id/confirm-payment
 *
 * Confirme la réception d'un paiement pour une commande « pending » et
 * déclenche la génération des billets + l'email de confirmation au client
 * (cahier des charges : après paiement, l'acheteur reçoit ses billets par
 * email).
 *
 * Réservé aux administrateurs : le paiement en ligne n'étant pas encore
 * branché (voir composables/useEventDetail.ts), c'est aujourd'hui l'admin
 * qui valide manuellement un paiement reçu (virement, mobile money vérifié).
 * Quand un vrai fournisseur de paiement sera intégré, son webhook pourra
 * appeler la même logique (fonction SQL confirm_order_payment, migration
 * 0019) sans rien changer côté billets/email.
 */
export default defineEventHandler(async (event) => {
  requireCsrf(event)
  const { adminUserId } = await requirePermission(event, 'payments.confirm')

  const orderId = getRouterParam(event, 'id') ?? ''
  if (!UUID_RE.test(orderId)) {
    throw createError({ statusCode: 400, statusMessage: 'INVALID_ORDER_ID', data: { code: 'INVALID_ORDER_ID' } })
  }

  const body = await readBody<{ provider?: unknown; transactionReference?: unknown }>(event).catch(() => ({}) as any)
  const provider = typeof body?.provider === 'string' && body.provider.trim() ? body.provider.trim() : 'manual'
  const transactionReference =
    typeof body?.transactionReference === 'string' && body.transactionReference.trim() ? body.transactionReference.trim() : null

  const supabaseAdmin = useSupabaseAdmin()

  const { data, error } = await supabaseAdmin.rpc('confirm_order_payment', {
    p_order_id: orderId,
    p_provider: provider,
    p_transaction_reference: transactionReference,
  })

  if (error) {
    const code = String(error.message ?? '').trim()
    if (code in ERROR_STATUS) {
      throw createError({ statusCode: ERROR_STATUS[code], statusMessage: code, data: { code } })
    }
    console.error('[api/orders/confirm-payment] échec confirm_order_payment :', error)
    throw createError({ statusCode: 500, statusMessage: 'CONFIRM_FAILED', data: { code: 'CONFIRM_FAILED' } })
  }

  const summary = data as {
    order: { id: string; order_number: string; total: number; currency: string }
    buyer: { email: string | null; full_name: string | null }
    event: { title: string; start_date: string; location_name: string | null; city: string | null }
    tickets: Array<{ ticket_number: string; type_name: string; price: number }>
  }

  // Email non bloquant : les billets et le paiement sont déjà enregistrés
  // même si l'envoi échoue (ex. Brevo non configuré en local).
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
      console.error('[api/orders/confirm-payment] échec envoi email billets :', e)
    }
  }

  await supabaseAdmin.from('audit_logs').insert({
    user_id: adminUserId,
    action: 'ORDER_PAYMENT_CONFIRMED',
    entity_type: 'orders',
    entity_id: orderId,
    metadata: { provider, transactionReference, ticketCount: summary?.tickets?.length ?? 0 },
  })

  return { order: summary?.order, ticketCount: summary?.tickets?.length ?? 0 }
})
