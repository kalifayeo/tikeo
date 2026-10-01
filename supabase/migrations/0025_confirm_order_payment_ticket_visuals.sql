-- ============================================================
-- TIKEO — Enrichissement de confirm_order_payment() pour le
-- billet "joli" (email + espace acheteur) : QR code + photo
-- ============================================================
-- CONTEXTE : confirm_order_payment() (migration 0019) renvoyait déjà tout
-- ce qu'il fallait pour un email texte (numéro de billet, type, prix), mais
-- pas de quoi générer un visuel de billet soigné : il manquait le
-- qr_token (déjà stocké par billet, jamais renvoyé) et la photo de
-- couverture de l'événement.
--
-- Ce fichier NE CHANGE AUCUNE LOGIQUE : même verrouillage, même génération
-- de billets, même signature de fonction. Seul le JSON retourné gagne deux
-- champs :
--   - event.cover_image
--   - tickets[].qr_token
-- Utilisé par server/utils/brevo.ts (ticketsEmailTemplate) pour construire
-- un billet visuel avec photo + QR code dans l'email de confirmation.
-- ============================================================

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

  -- 1. Paiement enregistré (provider = 'free' pour un événement gratuit,
  --    voir server/api/orders/[id]/claim-free.post.ts).
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

  -- 4. Récapitulatif complet pour l'email de confirmation + le billet
  --    visuel (event.cover_image et tickets[].qr_token en plus de 0019).
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
             'city', e.city,
             'cover_image', e.cover_image
           ),
           'tickets', (
             select jsonb_agg(jsonb_build_object(
                      'ticket_number', tk.ticket_number,
                      'type_name', tt.name,
                      'price', tt.price,
                      'qr_token', tk.qr_token
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

-- Seule une route serveur (service_role) peut appeler cette fonction (inchangé).
revoke all on function public.confirm_order_payment(uuid, text, text) from public, anon, authenticated;
grant execute on function public.confirm_order_payment(uuid, text, text) to service_role;
