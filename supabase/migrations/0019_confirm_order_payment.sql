-- ============================================================
-- TIKEO — Confirmation de paiement + génération des billets
-- ============================================================
-- CONTEXTE : le paiement en ligne n'est pas encore branché (§24-26, voir
-- composables/useEventDetail.ts). En attendant l'intégration d'un vrai
-- fournisseur (CinetPay, Wave, Orange Money…), la confirmation d'un
-- paiement reçu (virement, mobile money vérifié manuellement, etc.) se fait
-- depuis le panneau admin (page « Commandes »).
--
-- Ce fichier ajoute la fonction confirm_order_payment(), appelée UNIQUEMENT
-- par une route serveur (clé service_role) : server/api/orders/[id]/confirm-payment.post.ts
--
-- Elle fait, de façon atomique :
--   1. Verrouille la commande, vérifie qu'elle est encore « pending ».
--   2. Enregistre un paiement « success » (table payments).
--   3. Passe la commande à « paid ».
--   4. Génère un billet (table tickets) par unité achetée, statut « valid ».
--   5. Retourne toutes les infos nécessaires à l'email de confirmation
--      (acheteur, événement, liste des billets) — voir
--      server/utils/brevo.ts (ticketsEmailTemplate) et
--      server/api/orders/[id]/confirm-payment.post.ts.
--
-- Codes d'erreur (message de l'exception, mappés en HTTP par la route
-- serveur) : ORDER_NOT_FOUND, ORDER_NOT_PAYABLE.
-- ============================================================

create sequence if not exists ticket_number_seq;

create or replace function public.confirm_order_payment(
  p_order_id uuid,
  p_provider text default 'manual',
  p_transaction_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_item record;
  v_i integer;
  v_ticket_number text;
  v_result jsonb;
begin
  -- Verrou de la commande : deux confirmations simultanées sont sérialisées.
  select * into v_order from orders where id = p_order_id for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.status <> 'pending' then
    raise exception 'ORDER_NOT_PAYABLE';
  end if;

  -- 1. Paiement enregistré.
  insert into payments (order_id, provider, transaction_reference, amount, currency, status, paid_at)
  values (p_order_id, coalesce(p_provider, 'manual'), p_transaction_reference, v_order.total, v_order.currency, 'success', now());

  -- 2. Commande marquée payée.
  update orders set status = 'paid', updated_at = now() where id = p_order_id;

  -- 3. Un billet par unité achetée, pour chaque ligne de la commande.
  for v_item in
    select oi.ticket_type_id, oi.quantity, tt.name as type_name, tt.price
      from order_items oi
      join ticket_types tt on tt.id = oi.ticket_type_id
     where oi.order_id = p_order_id
  loop
    v_i := 0;
    while v_i < v_item.quantity loop
      v_ticket_number := 'TIK-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('ticket_number_seq')::text, 6, '0');
      insert into tickets (order_id, event_id, ticket_type_id, user_id, ticket_number, qr_token, status)
      values (p_order_id, v_order.event_id, v_item.ticket_type_id, v_order.user_id, v_ticket_number, gen_random_uuid()::text, 'valid');
      v_i := v_i + 1;
    end loop;
  end loop;

  -- 4. Récapitulatif complet pour l'email de confirmation.
  select jsonb_build_object(
           'order', jsonb_build_object(
             'id', o.id,
             'order_number', o.order_number,
             'total', o.total,
             'currency', o.currency
           ),
           'buyer', jsonb_build_object(
             'email', p.email,
             'full_name', p.full_name
           ),
           'event', jsonb_build_object(
             'title', e.title,
             'start_date', e.start_date,
             'location_name', e.location_name,
             'city', e.city
           ),
           'tickets', (
             select jsonb_agg(jsonb_build_object(
                      'ticket_number', tk.ticket_number,
                      'type_name', tt.name,
                      'price', tt.price
                    ) order by tk.ticket_number)
               from tickets tk
               join ticket_types tt on tt.id = tk.ticket_type_id
              where tk.order_id = p_order_id
           )
         )
    into v_result
    from orders o
    join profiles p on p.user_id = o.user_id
    join events e on e.id = o.event_id
   where o.id = p_order_id;

  return v_result;
end;
$$;

-- Seule une route serveur (service_role) peut appeler cette fonction.
revoke all on function public.confirm_order_payment(uuid, text, text) from public, anon, authenticated;
grant execute on function public.confirm_order_payment(uuid, text, text) to service_role;
