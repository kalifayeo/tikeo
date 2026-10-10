-- ============================================================
-- TIKEO — Codes promo par événement
-- ============================================================
-- Un organisateur peut créer, par événement, des codes de réduction
-- (pourcentage ou montant fixe), avec une limite d'utilisations totale et
-- par acheteur, et une période de validité optionnelle.
--
-- Comme pour le prix et le stock, la réduction est calculée ET appliquée
-- EN BASE, jamais depuis ce que le navigateur affiche : create_order()
-- relit le code, vérifie qu'il est valable, calcule la remise sur le
-- sous-total recalculé, et incrémente son compteur d'utilisation de façon
-- atomique (verrou de ligne), pour éviter qu'un code à usage limité soit
-- consommé deux fois par deux commandes simultanées.
--
-- Aucune policy SELECT publique sur promo_codes : la liste des codes d'un
-- événement n'est lisible que par l'organisateur propriétaire et l'admin.
-- Un visiteur ne peut que la TESTER via la fonction validate_promo_code()
-- ci-dessous, qui ne renvoie jamais la liste des codes, seulement le
-- résultat pour LE code qu'il a saisi.

-- 1. Table ------------------------------------------------------------------
create table if not exists promo_codes (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events(id) on delete cascade,
  code text not null check (char_length(code) between 2 and 30),
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  -- Pourcentage borné à 100 ; un montant fixe est plafonné au sous-total au moment de l'usage.
  check (discount_type <> 'percent' or discount_value <= 100),
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0,
  max_uses_per_buyer integer not null default 1 check (max_uses_per_buyer > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, code),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists promo_codes_event_idx on promo_codes (event_id);

comment on table promo_codes is 'Codes de réduction par événement. Appliqués et décomptés côté serveur (create_order), jamais depuis le navigateur.';

alter table promo_codes enable row level security;

create policy "Organisateur gère les codes de ses événements" on promo_codes
  for all using (
    event_id in (select id from events where organizer_id in (select id from organizers where user_id = auth.uid()))
  ) with check (
    event_id in (select id from events where organizer_id in (select id from organizers where user_id = auth.uid()))
  );

create policy "Admin gère tous les codes promo" on promo_codes
  for all using (is_admin()) with check (is_admin());

-- 2. Colonnes de réduction sur les commandes ---------------------------------
alter table orders
  add column if not exists discount numeric(12,2) not null default 0,
  add column if not exists promo_code text,
  add column if not exists promo_code_id uuid references promo_codes(id) on delete set null;

-- 3. Vérification d'un code SANS le consommer (aperçu avant paiement) -------
-- SECURITY DEFINER : contourne volontairement le verrou RLS ci-dessus (qui
-- interdit toute lecture publique de la table) pour ne renvoyer que le
-- résultat du code précis soumis — jamais la liste des codes existants.
create or replace function public.validate_promo_code(p_event_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_promo promo_codes%rowtype;
begin
  if v_code = '' then
    return jsonb_build_object('valid', false, 'error', 'PROMO_INVALID');
  end if;

  select * into v_promo from promo_codes where event_id = p_event_id and code = v_code;

  if not found or v_promo.status <> 'active' then
    return jsonb_build_object('valid', false, 'error', 'PROMO_INVALID');
  end if;
  if v_promo.starts_at is not null and now() < v_promo.starts_at then
    return jsonb_build_object('valid', false, 'error', 'PROMO_INVALID');
  end if;
  if v_promo.ends_at is not null and now() > v_promo.ends_at then
    return jsonb_build_object('valid', false, 'error', 'PROMO_EXPIRED');
  end if;
  if v_promo.max_uses is not null and v_promo.used_count >= v_promo.max_uses then
    return jsonb_build_object('valid', false, 'error', 'PROMO_EXHAUSTED');
  end if;

  return jsonb_build_object(
    'valid', true,
    'code', v_promo.code,
    'discount_type', v_promo.discount_type,
    'discount_value', v_promo.discount_value
  );
end;
$$;

revoke all on function public.validate_promo_code(uuid, text) from public;
grant execute on function public.validate_promo_code(uuid, text) to authenticated;

-- 4. create_order() : applique et décompte le code promo --------------------
-- Remplace intégralement la fonction (0017 puis 0026) pour y ajouter le
-- paramètre optionnel p_promo_code. Tout le reste est inchangé.
create or replace function public.create_order(
  p_user_id uuid,
  p_event_id uuid,
  p_items jsonb,
  p_promo_code text default null
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
  v_discount numeric(12,2) := 0;
  v_expires timestamptz := now() + c_hold;
  v_pending integer;
  v_lines integer := 0;
  v_result jsonb;
  v_requested_qty integer;
  v_already_held integer;
  v_promo promo_codes%rowtype;
  v_promo_code_norm text := upper(trim(coalesce(p_promo_code, '')));
  v_promo_used_by_buyer integer;
  v_promo_rows_locked integer;
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
  -- confondus). NULL = illimité.
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

  -- Code promo (facultatif) : validé et CONSOMMÉ ici, à l'intérieur de la
  -- même transaction que la réservation du stock.
  if v_promo_code_norm <> '' then
    select * into v_promo
      from promo_codes
     where event_id = p_event_id and code = v_promo_code_norm
       for update; -- sérialise les commandes concurrentes sur ce même code

    if not found or v_promo.status <> 'active' then
      raise exception 'PROMO_INVALID';
    end if;
    if v_promo.starts_at is not null and now() < v_promo.starts_at then
      raise exception 'PROMO_INVALID';
    end if;
    if v_promo.ends_at is not null and now() > v_promo.ends_at then
      raise exception 'PROMO_EXPIRED';
    end if;
    if v_promo.max_uses is not null and v_promo.used_count >= v_promo.max_uses then
      raise exception 'PROMO_EXHAUSTED';
    end if;

    select coalesce(sum(1), 0) into v_promo_used_by_buyer
      from orders
     where promo_code_id = v_promo.id
       and user_id = p_user_id
       and (status = 'paid' or (status = 'pending' and (expires_at is null or expires_at > now())));
    if v_promo_used_by_buyer >= v_promo.max_uses_per_buyer then
      raise exception 'PROMO_LIMIT_REACHED';
    end if;

    v_discount := case
      when v_promo.discount_type = 'percent' then round(v_subtotal * v_promo.discount_value / 100, 2)
      else least(v_promo.discount_value, v_subtotal)
    end;

    update promo_codes set used_count = used_count + 1, updated_at = now() where id = v_promo.id;
  end if;

  v_order_number := 'TKO-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('order_number_seq')::text, 6, '0');

  insert into orders (id, user_id, event_id, order_number, subtotal, fees, discount, total, currency, status, expires_at, promo_code, promo_code_id)
  values (
    v_order_id, p_user_id, p_event_id, v_order_number, v_subtotal, v_fees, v_discount,
    greatest(v_subtotal + v_fees - v_discount, 0), 'XOF', 'pending', v_expires,
    nullif(v_promo_code_norm, ''), nullif(v_promo.id::text, '')::uuid
  );

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
           'discount', o.discount,
           'promo_code', o.promo_code,
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
