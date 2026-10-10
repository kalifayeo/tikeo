-- ============================================================
-- TIKEO — Transfert de billet
-- ============================================================
-- Le titulaire d'un billet valide peut l'offrir à quelqu'un d'autre en
-- indiquant son adresse email. Le destinataire (compte Tikeo avec cette même
-- adresse) accepte ou refuse depuis le lien reçu.
--
-- SÉCURITÉ :
--   * à l'acceptation, le billet change de propriétaire ET son qr_token est
--     RÉGÉNÉRÉ : l'ancien QR code (dans l'email et le PDF de l'expéditeur, ou
--     une capture d'écran) ne fonctionne plus jamais ;
--   * seul le compte dont l'email correspond à l'invitation peut accepter ;
--   * un billet utilisé, annulé ou d'un événement déjà commencé ne se transfère pas ;
--   * un seul transfert en attente par billet, 3 transferts maximum par billet
--     (limite le revente en chaîne), invitation valable 7 jours ;
--   * l'organisateur peut désactiver les transferts pour son événement.
--
-- Toutes les écritures passent par des fonctions security definer appelées
-- par les routes serveur (jamais directement par le navigateur).
-- ============================================================

alter table events add column if not exists allow_ticket_transfers boolean not null default true;
alter table tickets add column if not exists transferred_count integer not null default 0 check (transferred_count >= 0);

create table if not exists ticket_transfers (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_email text not null,
  to_user_id uuid references auth.users(id) on delete set null,
  -- Jeton du lien d'invitation : deux UUID v4 (≈ 244 bits d'aléa), non devinable.
  token text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  message text check (message is null or char_length(message) <= 300),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  expires_at timestamptz not null default now() + interval '7 days',
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists ticket_transfers_one_pending_idx
  on ticket_transfers (ticket_id) where status = 'pending';
create index if not exists ticket_transfers_email_idx
  on ticket_transfers (lower(to_email)) where status = 'pending';
create index if not exists ticket_transfers_from_idx on ticket_transfers (from_user_id, created_at desc);

alter table ticket_transfers enable row level security;

-- Lecture seule côté navigateur : l'expéditeur, le destinataire (par compte ou
-- par adresse email du jeton de session) et l'administration.
create policy "Transferts : expéditeur" on ticket_transfers
  for select using (auth.uid() = from_user_id);
create policy "Transferts : destinataire" on ticket_transfers
  for select using (
    auth.uid() = to_user_id
    or lower(to_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
create policy "Transferts : administration" on ticket_transfers
  for select using (is_admin());

-- 1. Création ------------------------------------------------------------------------
-- Erreurs : TICKET_NOT_FOUND, TICKET_NOT_TRANSFERABLE, TRANSFERS_DISABLED,
--   EVENT_STARTED, TRANSFER_LIMIT_REACHED, INVALID_EMAIL, SELF_TRANSFER,
--   TRANSFER_ALREADY_PENDING
create or replace function public.create_ticket_transfer(
  p_user_id uuid,
  p_ticket_id uuid,
  p_to_email text,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_max_transfers constant integer := 3;
  v_ticket tickets%rowtype;
  v_event events%rowtype;
  v_email text := lower(btrim(coalesce(p_to_email, '')));
  v_sender_email text;
  v_sender_name text;
  v_recipient uuid;
  v_type_name text;
  v_transfer ticket_transfers%rowtype;
begin
  perform set_config('tikeo.allow_delivery_flags', '1', true);

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'INVALID_EMAIL';
  end if;

  select * into v_ticket from tickets where id = p_ticket_id and user_id = p_user_id for update;
  if not found then
    raise exception 'TICKET_NOT_FOUND';
  end if;
  if v_ticket.status <> 'valid' then
    raise exception 'TICKET_NOT_TRANSFERABLE';
  end if;
  if v_ticket.transferred_count >= c_max_transfers then
    raise exception 'TRANSFER_LIMIT_REACHED';
  end if;

  select * into v_event from events where id = v_ticket.event_id;
  if not v_event.allow_ticket_transfers then
    raise exception 'TRANSFERS_DISABLED';
  end if;
  if v_event.start_date <= now() then
    raise exception 'EVENT_STARTED';
  end if;

  select lower(u.email) into v_sender_email from auth.users u where u.id = p_user_id;
  if v_sender_email = v_email then
    raise exception 'SELF_TRANSFER';
  end if;

  select u.id into v_recipient from auth.users u where lower(u.email) = v_email limit 1;

  begin
    insert into ticket_transfers (ticket_id, from_user_id, to_email, to_user_id, message)
    values (p_ticket_id, p_user_id, v_email, v_recipient, nullif(btrim(coalesce(p_message, '')), ''))
    returning * into v_transfer;
  exception when unique_violation then
    raise exception 'TRANSFER_ALREADY_PENDING';
  end;

  select coalesce(nullif(btrim(full_name), ''), 'Un ami') into v_sender_name from profiles where user_id = p_user_id;
  select name into v_type_name from ticket_types where id = v_ticket.ticket_type_id;

  if v_recipient is not null then
    insert into notifications (user_id, title, message, type, link, email_pending, push_pending)
    values (
      v_recipient,
      'Un billet vous est offert',
      coalesce(v_sender_name, 'Un ami') || ' souhaite vous transférer un billet pour « ' || v_event.title || ' ».',
      'ticket_transfer_received',
      '/transfert/' || v_transfer.token,
      false,   -- l'email d'invitation dédié est envoyé par la route serveur
      true
    );
  end if;

  return jsonb_build_object(
    'id', v_transfer.id,
    'token', v_transfer.token,
    'to_email', v_transfer.to_email,
    'recipient_has_account', v_recipient is not null,
    'expires_at', v_transfer.expires_at,
    'sender_name', coalesce(v_sender_name, 'Un ami'),
    'message', v_transfer.message,
    'ticket_number', v_ticket.ticket_number,
    'ticket_type', v_type_name,
    'event', jsonb_build_object(
      'title', v_event.title,
      'slug', v_event.slug,
      'start_date', v_event.start_date,
      'location_name', v_event.location_name,
      'city', v_event.city
    )
  );
end;
$$;

-- 2. Réponse du destinataire ----------------------------------------------------------
-- Retourne { status: accepted | declined | expired | cancelled, ... } ;
-- erreurs : TRANSFER_NOT_FOUND, TRANSFER_NOT_PENDING, TRANSFER_WRONG_RECIPIENT
create or replace function public.respond_ticket_transfer(
  p_user_id uuid,
  p_token text,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tr ticket_transfers%rowtype;
  v_ticket tickets%rowtype;
  v_event events%rowtype;
  v_user_email text;
  v_recipient_name text;
begin
  perform set_config('tikeo.allow_delivery_flags', '1', true);

  select * into v_tr from ticket_transfers where token = p_token for update;
  if not found then
    raise exception 'TRANSFER_NOT_FOUND';
  end if;

  select lower(u.email) into v_user_email from auth.users u where u.id = p_user_id;
  if v_user_email is null or v_user_email <> lower(v_tr.to_email) then
    raise exception 'TRANSFER_WRONG_RECIPIENT';
  end if;

  if v_tr.status <> 'pending' then
    raise exception 'TRANSFER_NOT_PENDING';
  end if;

  if v_tr.expires_at < now() then
    update ticket_transfers set status = 'expired', responded_at = now() where id = v_tr.id;
    return jsonb_build_object('status', 'expired');
  end if;

  select * into v_ticket from tickets where id = v_tr.ticket_id for update;
  select * into v_event from events where id = v_ticket.event_id;
  select coalesce(nullif(btrim(full_name), ''), v_user_email) into v_recipient_name from profiles where user_id = p_user_id;

  if not p_accept then
    update ticket_transfers set status = 'declined', to_user_id = p_user_id, responded_at = now() where id = v_tr.id;
    insert into notifications (user_id, title, message, type, link)
    values (v_tr.from_user_id, 'Transfert refusé',
            coalesce(v_recipient_name, v_tr.to_email) || ' a refusé le billet pour « ' || v_event.title || ' ». Il reste à votre nom.',
            'ticket_transfer_declined', '/mon-espace/mes-billets');
    return jsonb_build_object('status', 'declined', 'event_title', v_event.title);
  end if;

  -- Le billet a pu être utilisé, annulé, ou l'événement commencer entre-temps.
  if v_ticket.user_id <> v_tr.from_user_id or v_ticket.status <> 'valid' or v_event.start_date <= now() then
    update ticket_transfers set status = 'cancelled', responded_at = now() where id = v_tr.id;
    return jsonb_build_object('status', 'cancelled');
  end if;

  -- Changement de propriétaire + nouveau QR code : l'ancien ne sera plus jamais accepté.
  update tickets
     set user_id = p_user_id,
         qr_token = gen_random_uuid()::text,
         transferred_count = transferred_count + 1
   where id = v_ticket.id;

  update ticket_transfers
     set status = 'accepted', to_user_id = p_user_id, responded_at = now()
   where id = v_tr.id;

  insert into notifications (user_id, title, message, type, link)
  values (v_tr.from_user_id, 'Billet transféré',
          coalesce(v_recipient_name, v_tr.to_email) || ' a accepté votre billet pour « ' || v_event.title || ' ».',
          'ticket_transfer_accepted', '/mon-espace/mes-billets');

  return jsonb_build_object(
    'status', 'accepted',
    'ticket_number', v_ticket.ticket_number,
    'event_title', v_event.title,
    'event_slug', v_event.slug
  );
end;
$$;

-- 3. Annulation par l'expéditeur ------------------------------------------------------
create or replace function public.cancel_ticket_transfer(p_user_id uuid, p_transfer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tr ticket_transfers%rowtype;
begin
  select * into v_tr from ticket_transfers where id = p_transfer_id and from_user_id = p_user_id for update;
  if not found then
    raise exception 'TRANSFER_NOT_FOUND';
  end if;
  if v_tr.status <> 'pending' then
    raise exception 'TRANSFER_NOT_PENDING';
  end if;
  update ticket_transfers set status = 'cancelled', responded_at = now() where id = v_tr.id;
  return jsonb_build_object('status', 'cancelled');
end;
$$;

-- 4. Expiration des invitations (cron) -------------------------------------------------
create or replace function public.expire_ticket_transfers()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update ticket_transfers set status = 'expired', responded_at = now()
   where status = 'pending' and expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.create_ticket_transfer(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.respond_ticket_transfer(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.cancel_ticket_transfer(uuid, uuid) from public, anon, authenticated;
revoke all on function public.expire_ticket_transfers() from public, anon, authenticated;
grant execute on function public.create_ticket_transfer(uuid, uuid, text, text) to service_role;
grant execute on function public.respond_ticket_transfer(uuid, text, boolean) to service_role;
grant execute on function public.cancel_ticket_transfer(uuid, uuid) to service_role;
grant execute on function public.expire_ticket_transfers() to service_role;
