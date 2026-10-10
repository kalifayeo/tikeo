-- ============================================================
-- TIKEO — Réconciliation : liste d'attente complète + fusion create_order()
-- ============================================================
-- Cette migration fait le lien entre deux travaux menés en parallèle :
--   - la migration 0029 a ajouté les codes promo, avec un create_order() à
--     4 paramètres (p_promo_code en plus) ;
--   - la migration 0031 a ajouté une liste d'attente simple (capture d'email,
--     notification manuelle par l'organisateur) mais n'a PAS touché create_order().
--
-- Deux problèmes en résultent, indépendants de tout ajout futur :
--
-- 1) create_order() existe maintenant en DEUX versions (3 paramètres depuis
--    0026, et 4 paramètres depuis 0029). PostgREST/Postgres, interrogé avec
--    les 3 paramètres historiques (p_user_id, p_event_id, p_items), résout
--    TOUJOURS vers la version à 3 paramètres — celle qui ignore totalement
--    les codes promo. Concrètement, un code promo n'a jamais pu réellement
--    s'appliquer tant que l'appelant ne précise pas explicitement
--    p_promo_code. Ce n'est pas un bug introduit ici : c'est déjà le cas
--    avec les seules migrations 0001-0031. On corrige en ne gardant qu'UNE
--    seule fonction à 4 paramètres (le 4e avec une valeur par défaut NULL),
--    donc un appel à 3 arguments continue de fonctionner normalement.
--
-- 2) La liste d'attente actuelle (0031) est une simple capture d'email avec
--    notification manuelle par l'organisateur. Pour obtenir une vraie file
--    d'attente automatique (réservation temporaire dès qu'une place se
--    libère, conversion automatique en commande), il faut un modèle de
--    données différent (par type de billet, avec statut et expiration de
--    réservation). On remplace donc la table par la version complète.
--
-- ⚠️ IMPORTANT : cette migration SUPPRIME la table waitlist_entries actuelle
-- et la recrée avec un schéma différent. Si des inscriptions existent déjà
-- dedans (peu probable si la fonctionnalité vient d'être mise en place),
-- elles seront perdues. Vérifiez `select count(*) from waitlist_entries;`
-- avant d'exécuter cette migration si vous avez un doute.
-- ============================================================

-- 1. Remplacement de la liste d'attente simple par la liste d'attente complète
-- ------------------------------------------------------------------------------
drop policy if exists "Organisateur voit la liste d'attente de ses événements" on waitlist_entries;
drop policy if exists "Admin voit toutes les listes d'attente" on waitlist_entries;
drop table if exists waitlist_entries;

create table waitlist_entries (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events(id) on delete cascade,
  ticket_type_id uuid not null references ticket_types(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  quantity integer not null default 1 check (quantity between 1 and 10),
  status text not null default 'waiting'
    check (status in ('waiting', 'notified', 'converted', 'expired', 'cancelled')),
  notified_at timestamptz,
  hold_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table waitlist_entries is
  'Liste d''attente PAR TYPE DE BILLET (remplace la version "capture email" de la migration 0031) : '
  'quand des places se libèrent, la tête de file est automatiquement notifiée et ses billets lui sont '
  'réservés 24h (voir process_waitlist()) ; create_order() retire ces places réservées du stock visible par les autres.';

-- Une seule inscription « vivante » par personne et par type de billet.
create unique index waitlist_one_active_per_user_type
  on waitlist_entries (ticket_type_id, user_id)
  where status in ('waiting', 'notified');
create index waitlist_queue_idx
  on waitlist_entries (ticket_type_id, created_at)
  where status = 'waiting';
create index waitlist_holds_idx
  on waitlist_entries (ticket_type_id)
  where status = 'notified';
create index waitlist_user_idx on waitlist_entries (user_id);

alter table waitlist_entries enable row level security;

create policy "Liste d'attente : mes inscriptions" on waitlist_entries
  for select using (auth.uid() = user_id);

create policy "Liste d'attente : vue organisateur" on waitlist_entries
  for select using (
    event_id in (
      select e.id from events e
       where e.organizer_id in (select id from organizers where user_id = auth.uid())
    )
  );

create policy "Liste d'attente : vue admin" on waitlist_entries
  for select using (is_admin());

-- Se désinscrire : la seule modification permise à l'acheteur.
create policy "Liste d'attente : je me désinscris" on waitlist_entries
  for update
  using (auth.uid() = user_id and status in ('waiting', 'notified'))
  with check (auth.uid() = user_id and status = 'cancelled');

-- 1a. Stock réellement libre --------------------------------------------------
-- quantité - vendu - billets tenus pour les autres (réservation de liste d'attente).
create or replace function public.waitlist_available(
  p_ticket_type_id uuid,
  p_exclude_user uuid default null
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    0,
    tt.quantity - tt.sold_quantity - coalesce((
      select sum(w.quantity)::integer
        from waitlist_entries w
       where w.ticket_type_id = tt.id
         and w.status = 'notified'
         and w.hold_expires_at > now()
         and (p_exclude_user is null or w.user_id <> p_exclude_user)
    ), 0)
  )
  from ticket_types tt
  where tt.id = p_ticket_type_id;
$$;

-- Nombre de personnes en attente pour un type de billet, sans exposer les
-- lignes elles-mêmes (RLS) — pour l'affichage public sur la page événement.
create or replace function public.waitlist_count(p_ticket_type_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from waitlist_entries
   where ticket_type_id = p_ticket_type_id and status = 'waiting';
$$;

-- 1b. Réveil de la file --------------------------------------------------------
create or replace function public.process_waitlist(p_ticket_type_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c_hold constant interval := interval '24 hours';
  v_tt ticket_types%rowtype;
  v_event events%rowtype;
  v_avail integer;
  v_entry record;
  v_count integer := 0;
  v_hold_until timestamptz;
  v_wants_email boolean;
begin
  perform set_config('tikeo.allow_delivery_flags', '1', true);

  select * into v_tt from ticket_types where id = p_ticket_type_id and status = 'active';
  if not found then
    return 0;
  end if;
  if v_tt.sale_end is not null and now() > v_tt.sale_end then
    return 0;
  end if;

  select * into v_event from events where id = v_tt.event_id;
  if not found or v_event.status <> 'published' or v_event.start_date <= now() then
    return 0;
  end if;

  v_avail := public.waitlist_available(p_ticket_type_id);
  if v_avail <= 0 then
    return 0;
  end if;

  v_hold_until := least(now() + c_hold, v_event.start_date);

  for v_entry in
    select * from waitlist_entries
     where ticket_type_id = p_ticket_type_id and status = 'waiting'
     order by created_at
       for update skip locked
  loop
    exit when v_avail <= 0;
    continue when v_entry.quantity > v_avail;

    update waitlist_entries
       set status = 'notified', notified_at = now(), hold_expires_at = v_hold_until, updated_at = now()
     where id = v_entry.id;

    select coalesce(p.notify_email, true) into v_wants_email
      from profiles p where p.user_id = v_entry.user_id;

    insert into notifications (user_id, title, message, type, link, email_pending, push_pending)
    values (
      v_entry.user_id,
      'Des billets se sont libérés !',
      v_entry.quantity || case when v_entry.quantity > 1 then ' billets « ' else ' billet « ' end || v_tt.name ||
        ' » ' || case when v_entry.quantity > 1 then 'sont' else 'est' end || ' de nouveau disponible' ||
        case when v_entry.quantity > 1 then 's' else '' end || ' pour « ' || v_event.title || ' ». ' ||
        case when v_entry.quantity > 1 then 'Ils vous sont réservés' else 'Il vous est réservé' end ||
        ' jusqu''au ' || to_char(v_hold_until at time zone 'Africa/Abidjan', 'DD/MM/YYYY') || ' à ' ||
        to_char(v_hold_until at time zone 'Africa/Abidjan', 'HH24"h"MI') || '.',
      'waitlist_available',
      '/e/' || v_event.slug,
      coalesce(v_wants_email, true),
      true
    );

    v_avail := v_avail - v_entry.quantity;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- 1c. Inscription ---------------------------------------------------------------
-- Codes d'erreur : TICKET_NOT_AVAILABLE, EVENT_NOT_AVAILABLE, SALE_CLOSED,
--   INVALID_QUANTITY, NOT_SOLD_OUT, ALREADY_ON_WAITLIST, ACCOUNT_SUSPENDED
create or replace function public.join_waitlist(
  p_user_id uuid,
  p_ticket_type_id uuid,
  p_quantity integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tt ticket_types%rowtype;
  v_event events%rowtype;
  v_id uuid;
  v_position integer;
begin
  if p_quantity is null or p_quantity < 1 or p_quantity > 10 then
    raise exception 'INVALID_QUANTITY';
  end if;

  select * into v_tt from ticket_types where id = p_ticket_type_id and status = 'active';
  if not found then
    raise exception 'TICKET_NOT_AVAILABLE';
  end if;

  select * into v_event from events where id = v_tt.event_id and status = 'published' and start_date > now();
  if not found then
    raise exception 'EVENT_NOT_AVAILABLE';
  end if;
  if v_tt.sale_end is not null and now() > v_tt.sale_end then
    raise exception 'SALE_CLOSED';
  end if;
  if v_event.max_tickets_per_buyer is not null and p_quantity > v_event.max_tickets_per_buyer then
    raise exception 'INVALID_QUANTITY';
  end if;

  if public.waitlist_available(p_ticket_type_id, p_user_id) >= p_quantity then
    raise exception 'NOT_SOLD_OUT';
  end if;

  begin
    insert into waitlist_entries (event_id, ticket_type_id, user_id, quantity)
    values (v_tt.event_id, p_ticket_type_id, p_user_id, p_quantity)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'ALREADY_ON_WAITLIST';
  end;

  select count(*) + 1 into v_position
    from waitlist_entries
   where ticket_type_id = p_ticket_type_id
     and status = 'waiting'
     and created_at < (select created_at from waitlist_entries where id = v_id);

  return jsonb_build_object('id', v_id, 'position', v_position, 'quantity', p_quantity);
end;
$$;

-- 1d. Nettoyage périodique ---------------------------------------------------------
create or replace function public.expire_waitlist_entries()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_holds integer;
  v_started integer;
begin
  update waitlist_entries
     set status = 'expired', updated_at = now()
   where status = 'notified' and hold_expires_at < now();
  get diagnostics v_holds = row_count;

  update waitlist_entries w
     set status = 'expired', updated_at = now()
    from events e
   where e.id = w.event_id
     and w.status = 'waiting'
     and e.start_date <= now();
  get diagnostics v_started = row_count;

  return v_holds + v_started;
end;
$$;

create or replace function public.waitlist_entry_released()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'notified' and new.status in ('cancelled', 'expired') then
    perform public.process_waitlist(new.ticket_type_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_waitlist_entry_released on waitlist_entries;
create trigger trg_waitlist_entry_released
  after update of status on waitlist_entries
  for each row execute function public.waitlist_entry_released();

create or replace function public.ticket_type_quantity_increased()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.process_waitlist(new.id);
  return new;
end;
$$;

drop trigger if exists trg_ticket_type_quantity_increased on ticket_types;
create trigger trg_ticket_type_quantity_increased
  after update of quantity on ticket_types
  for each row
  when (new.quantity > old.quantity)
  execute function public.ticket_type_quantity_increased();

-- 2. Fusion de create_order() : UNE seule fonction (promo + liste d'attente) ----
-- ------------------------------------------------------------------------------
-- On supprime explicitement les deux anciennes signatures avant de recréer,
-- pour ne jamais se retrouver avec deux fonctions create_order en même temps
-- (c'est exactement ce qui causait le bug « code promo jamais appliqué »).
drop function if exists public.create_order(uuid, uuid, jsonb);
drop function if exists public.create_order(uuid, uuid, jsonb, text);

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
  v_fees numeric(12,2) := 0;
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
begin
  perform release_expired_orders();

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_ORDER';
  end if;
  if jsonb_array_length(p_items) > c_max_lines * 5 then
    raise exception 'INVALID_QUANTITY';
  end if;

  select * into v_event from events where id = p_event_id and status = 'published';
  if not found then
    raise exception 'EVENT_NOT_AVAILABLE';
  end if;

  select count(*) into v_pending
    from orders
   where user_id = p_user_id and status = 'pending' and (expires_at is null or expires_at > now());
  if v_pending >= c_max_pending then
    raise exception 'TOO_MANY_PENDING';
  end if;

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

    -- Stock réellement libre : on retient les places tenues par la liste
    -- d'attente pour D'AUTRES personnes (les siennes, l'acheteur peut les acheter).
    if public.waitlist_available(v_tt.id, p_user_id) < v_line.qty then
      raise exception 'SOLD_OUT' using hint = v_tt.name;
    end if;

    v_subtotal := v_subtotal + v_tt.price * v_line.qty;
  end loop;

  -- Code promo (facultatif), logique inchangée depuis la migration 0029.
  if v_promo_code_norm <> '' then
    select * into v_promo
      from promo_codes
     where event_id = p_event_id and code = v_promo_code_norm
       for update;

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

    -- L'acheteur était en liste d'attente pour ce billet : sa place est consommée.
    update waitlist_entries
       set status = 'converted', updated_at = now()
     where user_id = p_user_id
       and ticket_type_id = v_line.tid
       and status in ('waiting', 'notified');
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

-- 3. release_expired_orders() : + liste d'attente + retour du code promo -------
create or replace function public.release_expired_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_count integer := 0;
  v_types uuid[] := '{}';
begin
  for v_order in
    select id, promo_code_id
      from orders
     where status = 'pending'
       and expires_at is not null
       and expires_at < now()
     for update skip locked
  loop
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

    v_types := v_types || coalesce(
      (select array_agg(distinct ticket_type_id) from order_items where order_id = v_order.id),
      '{}'::uuid[]
    );

    if v_order.promo_code_id is not null then
      update promo_codes set used_count = greatest(0, used_count - 1), updated_at = now() where id = v_order.promo_code_id;
    end if;

    update orders
       set status = 'cancelled', updated_at = now()
     where id = v_order.id;

    v_count := v_count + 1;
  end loop;

  if v_count > 0 then
    declare
      v_type uuid;
    begin
      for v_type in select distinct unnest(v_types)
      loop
        perform public.process_waitlist(v_type);
      end loop;
    end;
  end if;

  return v_count;
end;
$$;

-- 4. Droits : serveur uniquement --------------------------------------------------
revoke all on function public.process_waitlist(uuid) from public, anon, authenticated;
revoke all on function public.join_waitlist(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.expire_waitlist_entries() from public, anon, authenticated;
revoke all on function public.create_order(uuid, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.release_expired_orders() from public, anon, authenticated;
grant execute on function public.process_waitlist(uuid) to service_role;
grant execute on function public.join_waitlist(uuid, uuid, integer) to service_role;
grant execute on function public.expire_waitlist_entries() to service_role;
grant execute on function public.create_order(uuid, uuid, jsonb, text) to service_role;
grant execute on function public.release_expired_orders() to service_role;
grant execute on function public.waitlist_available(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.waitlist_count(uuid) to anon, authenticated, service_role;
