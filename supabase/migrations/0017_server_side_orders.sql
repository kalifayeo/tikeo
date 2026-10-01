-- ============================================================
-- TIKEO — Création de commande 100 % côté serveur (sécurité + stock)
-- ============================================================
-- AVANT : le navigateur insérait lui-même la commande (orders) et ses lignes
-- (order_items) avec les prix qu'il voulait. La RLS ne vérifiait que
-- « auth.uid() = user_id » : un acheteur pouvait donc envoyer un total de
-- 1 FCFA, un statut « paid », ou dépasser le stock (cahier des charges §49,
-- §64 : le frontend ne décide jamais de rien).
--
-- MAINTENANT :
--   1. Le navigateur appelle POST /api/orders (server/api/orders.post.ts) avec
--      seulement { eventId, items: [{ ticketTypeId, quantity }] }.
--   2. La route serveur vérifie la session puis appelle create_order() avec la
--      clé service_role.
--   3. create_order() relit les prix EN BASE, verrouille les types de billets
--      (FOR UPDATE), contrôle stock / fenêtre de vente / statut, réserve le
--      stock de façon ATOMIQUE et crée la commande + ses lignes.
--   4. Les policies d'insertion directe depuis le navigateur sont supprimées.
--
-- Réservation temporaire (§48) : une commande « pending » retient son stock
-- pendant 15 minutes (orders.expires_at). Passé ce délai, release_expired_orders()
-- annule la commande et rend le stock. Elle est appelée automatiquement au début
-- de chaque create_order(). Pour un nettoyage régulier même sans nouvelle
-- commande, planifier (extension pg_cron de Supabase, optionnel) :
--   select cron.schedule('release-expired-orders', '*/5 * * * *',
--                        'select public.release_expired_orders()');
--
-- À exécuter dans Supabase > SQL Editor (ou via la CLI : supabase db push).
-- ============================================================

-- 1. Expiration des réservations ---------------------------------------
alter table orders add column if not exists expires_at timestamptz;

create index if not exists orders_pending_expiry_idx
  on orders (expires_at)
  where status = 'pending';

-- 2. Numéros de commande au format du cahier des charges (§18) : TKO-2026-000001
create sequence if not exists order_number_seq;

-- 3. Libération des commandes en attente expirées ----------------------
create or replace function public.release_expired_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_count integer := 0;
begin
  for v_order in
    select id
      from orders
     where status = 'pending'
       and expires_at is not null
       and expires_at < now()
     for update skip locked
  loop
    -- Rend le stock, type de billet par type de billet.
    update ticket_types tt
       set sold_quantity = greatest(0, tt.sold_quantity - x.qty),
           updated_at = now()
      from (
        select ticket_type_id, sum(quantity)::integer as qty
          from order_items
         where order_id = v_order.id
         group by ticket_type_id
      ) x
     where tt.id = x.ticket_type_id;

    update orders
       set status = 'cancelled', updated_at = now()
     where id = v_order.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- 4. Création atomique d'une commande ----------------------------------
-- p_items : [{ "ticket_type_id": "<uuid>", "quantity": 2 }, ...]
-- Codes d'erreur levés (message de l'exception) — mappés en HTTP par
-- server/api/orders.post.ts et traduits côté interface (event.orderErrors.*) :
--   EMPTY_ORDER, INVALID_QUANTITY, EVENT_NOT_AVAILABLE, TICKET_NOT_AVAILABLE,
--   SALE_NOT_OPEN, SALE_CLOSED, SOLD_OUT, TOO_MANY_PENDING
create or replace function public.create_order(
  p_user_id uuid,
  p_event_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_max_qty_per_type constant integer := 10;
  c_max_lines constant integer := 10;
  c_max_pending constant integer := 5;
  c_hold interval := interval '15 minutes';

  v_event events%rowtype;
  v_line record;
  v_tt ticket_types%rowtype;
  v_order_id uuid := gen_random_uuid();
  v_order_number text;
  v_subtotal numeric(12,2) := 0;
  v_fees numeric(12,2) := 0;      -- commissions : à brancher avec la configuration admin (§38)
  v_expires timestamptz := now() + c_hold;
  v_pending integer;
  v_lines integer := 0;
  v_result jsonb;
begin
  -- Nettoyage paresseux des réservations expirées (rend le stock avant de le contrôler).
  perform release_expired_orders();

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_ORDER';
  end if;
  if jsonb_array_length(p_items) > c_max_lines * 5 then
    raise exception 'INVALID_QUANTITY';
  end if;

  -- Événement vendable : publié uniquement.
  select * into v_event from events where id = p_event_id and status = 'published';
  if not found then
    raise exception 'EVENT_NOT_AVAILABLE';
  end if;

  -- Anti-accaparement du stock : limite de commandes en attente par compte.
  select count(*) into v_pending
    from orders
   where user_id = p_user_id and status = 'pending' and (expires_at is null or expires_at > now());
  if v_pending >= c_max_pending then
    raise exception 'TOO_MANY_PENDING';
  end if;

  -- 1re passe : on regroupe les doublons éventuels et on parcourt les types de
  -- billets dans un ordre fixe (évite les blocages croisés entre commandes simultanées).
  for v_line in
    select (e->>'ticket_type_id')::uuid as tid,
           sum((e->>'quantity')::integer)::integer as qty
      from jsonb_array_elements(p_items) e
     group by 1
     order by 1
  loop
    v_lines := v_lines + 1;
    if v_lines > c_max_lines then
      raise exception 'INVALID_QUANTITY';
    end if;
    if v_line.qty is null or v_line.qty < 1 or v_line.qty > c_max_qty_per_type then
      raise exception 'INVALID_QUANTITY';
    end if;

    -- Verrou de ligne : deux acheteurs simultanés sont sérialisés sur ce type de billet.
    select * into v_tt
      from ticket_types
     where id = v_line.tid and event_id = p_event_id
       for update;

    if not found or v_tt.status <> 'active' then
      raise exception 'TICKET_NOT_AVAILABLE';
    end if;
    if v_tt.sale_start is not null and now() < v_tt.sale_start then
      raise exception 'SALE_NOT_OPEN';
    end if;
    if v_tt.sale_end is not null and now() > v_tt.sale_end then
      raise exception 'SALE_CLOSED';
    end if;
    if v_tt.quantity - v_tt.sold_quantity < v_line.qty then
      raise exception 'SOLD_OUT' using hint = v_tt.name;
    end if;

    -- Le prix vient de la base, jamais du navigateur.
    v_subtotal := v_subtotal + v_tt.price * v_line.qty;
  end loop;

  v_order_number := 'TKO-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('order_number_seq')::text, 6, '0');

  insert into orders (id, user_id, event_id, order_number, subtotal, fees, total, currency, status, expires_at)
  values (v_order_id, p_user_id, p_event_id, v_order_number, v_subtotal, v_fees, v_subtotal + v_fees, 'XOF', 'pending', v_expires);

  -- 2e passe : réservation du stock + lignes de commande (les verrous sont déjà tenus).
  for v_line in
    select (e->>'ticket_type_id')::uuid as tid,
           sum((e->>'quantity')::integer)::integer as qty
      from jsonb_array_elements(p_items) e
     group by 1
     order by 1
  loop
    select * into v_tt from ticket_types where id = v_line.tid;

    update ticket_types
       set sold_quantity = sold_quantity + v_line.qty, updated_at = now()
     where id = v_line.tid;

    insert into order_items (order_id, ticket_type_id, quantity, unit_price, total)
    values (v_order_id, v_line.tid, v_line.qty, v_tt.price, v_tt.price * v_line.qty);
  end loop;

  select jsonb_build_object(
           'id', o.id,
           'order_number', o.order_number,
           'subtotal', o.subtotal,
           'fees', o.fees,
           'total', o.total,
           'currency', o.currency,
           'status', o.status,
           'expires_at', o.expires_at
         )
    into v_result
    from orders o
   where o.id = v_order_id;

  return v_result;
end;
$$;

-- 5. Droits : seules les routes serveur (service_role) peuvent appeler ces fonctions.
revoke all on function public.release_expired_orders() from public, anon, authenticated;
revoke all on function public.create_order(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.release_expired_orders() to service_role;
grant execute on function public.create_order(uuid, uuid, jsonb) to service_role;

-- 6. Plus aucune écriture directe de commande depuis le navigateur.
drop policy if exists "Acheteur crée ses commandes" on orders;
drop policy if exists "Acheteur crée ses lignes de commande" on order_items;
