-- ============================================================
-- TIKEO — Limite de billets par acheteur + accès admin sur order_items
-- ============================================================
-- Demande organisateur : pouvoir plafonner, événement par événement, le
-- nombre de billets qu'un même acheteur peut acquérir (1, 2, 3, 5... ou
-- illimité si rien n'est coché). Comme pour le prix et le stock (cahier des
-- charges §64), cette règle est appliquée EN BASE dans create_order() : le
-- frontend ne fait qu'informer/désactiver les boutons, il ne décide jamais.
--
-- On en profite pour corriger un oubli : l'admin avait un accès global en
-- lecture sur events/ticket_types/orders/payments/tickets (migrations 0004
-- et 0010), mais PAS sur order_items — ce qui empêche de calculer des
-- statistiques de vente par type de billet côté admin.

-- 1. Nouvelle colonne : limite de billets par acheteur, par événement -------
alter table events
  add column if not exists max_tickets_per_buyer integer;

alter table events
  add constraint max_tickets_per_buyer_positive
  check (max_tickets_per_buyer is null or max_tickets_per_buyer > 0);

comment on column events.max_tickets_per_buyer is
  'Nombre maximum de billets qu''un même acheteur (même compte) peut acheter pour cet événement, tous types de billets confondus. NULL = illimité.';

-- 2. Verrouillage : ce champ suit la même gouvernance que les autres champs
--    de contenu d'un événement (migration 0009) — modifiable librement en
--    brouillon, soumis à validation admin une fois l'événement publié.
create or replace function enforce_event_content_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or is_admin() then
    return new;
  end if;

  if old.status = 'draft' then
    return new;
  end if;

  if new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.cover_image is distinct from old.cover_image
     or new.seating_plan_url is distinct from old.seating_plan_url
     or new.category_id is distinct from old.category_id
     or new.start_date is distinct from old.start_date
     or new.end_date is distinct from old.end_date
     or new.location_name is distinct from old.location_name
     or new.address is distinct from old.address
     or new.city is distinct from old.city
     or new.country is distinct from old.country
     or new.slug is distinct from old.slug
     or new.max_tickets_per_buyer is distinct from old.max_tickets_per_buyer
  then
    raise exception 'MODIFICATION_REQUIRES_ADMIN_APPROVAL: cet événement est déjà publié — soumettez une demande de modification depuis l''espace organisateur.';
  end if;

  return new;
end;
$$;

-- 3. create_order() : appliquer la limite ------------------------------
-- Remplace intégralement la fonction de la migration 0017 pour y ajouter le
-- contrôle de la limite par acheteur. Tout le reste (verrouillage FOR
-- UPDATE, prix relus en base, fenêtre de vente, anti-accaparement...) est
-- inchangé.
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
  v_requested_qty integer;
  v_already_held integer;
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

  -- Limite de billets par acheteur pour CET événement (tous types de billets
  -- confondus). NULL = illimité. On compte les billets déjà « tenus » par ce
  -- compte (commandes payées + réservations en attente non expirées) et on y
  -- ajoute la quantité demandée dans cette nouvelle commande.
  if v_event.max_tickets_per_buyer is not null then
    select coalesce(sum(oi.quantity), 0) into v_already_held
      from order_items oi
      join orders o on o.id = oi.order_id
     where o.event_id = p_event_id
       and o.user_id = p_user_id
       and (o.status = 'paid' or (o.status = 'pending' and (o.expires_at is null or o.expires_at > now())));

    select coalesce(sum((e->>'quantity')::integer), 0) into v_requested_qty
      from jsonb_array_elements(p_items) e;

    if v_already_held + v_requested_qty > v_event.max_tickets_per_buyer then
      raise exception 'MAX_TICKETS_PER_BUYER_EXCEEDED' using hint = v_event.max_tickets_per_buyer::text;
    end if;
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

-- 4. Accès admin manquant sur order_items --------------------------------
-- 0004_admin_policies.sql donnait déjà à l'admin un accès global sur
-- events / ticket_types / orders / payments, et 0010 a ajouté tickets, mais
-- order_items avait été oublié : l'admin ne pouvait donc pas lire le détail
-- des lignes de commande (nécessaire pour les statistiques de vente par
-- type de billet dans /admin/evenements/[id]/statistiques).
create policy "Admin voit toutes les lignes de commande" on order_items
  for select using (is_admin());
