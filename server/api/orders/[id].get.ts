const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET /api/orders/:id — détail d'une commande, pour la page récapitulatif
 * de commande / paiement (§24) et pour l'écran de retour après paiement.
 *
 * Réservé au propriétaire de la commande : on relit l'identité depuis le
 * jeton de session (requireUser), jamais depuis l'URL (cahier des charges §64).
 */
export default defineEventHandler(async (event) => {
  const { userId } = await requireUser(event)

  const orderId = getRouterParam(event, 'id') ?? ''
  if (!UUID_RE.test(orderId)) {
    throw createError({ statusCode: 400, statusMessage: 'INVALID_ORDER_ID', data: { code: 'INVALID_ORDER_ID' } })
  }

  const supabaseAdmin = useSupabaseAdmin()

  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select(
      `id, order_number, subtotal, fees, total, currency, status, expires_at, created_at,
       event:events ( id, title, slug, cover_image, start_date, location_name, city, country ),
       order_items ( id, ticket_type_id, quantity, unit_price, total, ticket_type:ticket_types ( name ) )`
    )
    .eq('id', orderId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[api/orders/:id] échec de lecture :', error)
    throw createError({ statusCode: 500, statusMessage: 'ORDER_FETCH_FAILED', data: { code: 'ORDER_FETCH_FAILED' } })
  }
  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'ORDER_NOT_FOUND', data: { code: 'ORDER_NOT_FOUND' } })
  }

  return { order }
})
