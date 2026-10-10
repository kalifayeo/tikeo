-- ============================================================
-- TIKEO — Avis sur les événements
-- ============================================================
-- Seul le détenteur d'un billet VALIDE ou UTILISÉ (= a réellement acheté,
-- peu importe qu'il ait assisté ou non) peut noter/commenter un événement,
-- une fois celui-ci terminé (date de fin passée). Un avis par personne et
-- par événement, modifiable, avec réponse possible de l'organisateur.
-- Modération : signalement + masquage par un admin (jamais de suppression
-- silencieuse : le compteur et la moyenne restent cohérents avec ce qui est
-- affiché grâce à `status`).
-- ============================================================

create table if not exists event_reviews (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 2000),
  organizer_reply text check (organizer_reply is null or char_length(organizer_reply) <= 2000),
  organizer_replied_at timestamptz,
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  hidden_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index if not exists event_reviews_event_idx on event_reviews (event_id, status);

create table if not exists event_review_reports (
  id uuid primary key default uuid_generate_v4(),
  review_id uuid not null references event_reviews(id) on delete cascade,
  reported_by uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (review_id, reported_by)
);

alter table event_review_reports enable row level security;
alter table event_reviews enable row level security;

-- 1. Qui peut noter : uniquement un détenteur de billet d'un événement terminé.
create or replace function public.can_review_event(p_user_id uuid, p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from tickets tk
      join events e on e.id = tk.event_id
     where tk.event_id = p_event_id
       and tk.user_id = p_user_id
       and tk.status in ('valid', 'used')
       and coalesce(e.end_date, e.start_date) < now()
  );
$$;

grant execute on function public.can_review_event(uuid, uuid) to authenticated;

-- 2. Normalisation + verrouillage des champs modérés ----------------------------
create or replace function public.event_reviews_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();

  if tg_op = 'INSERT' then
    if not public.can_review_event(new.user_id, new.event_id) then
      raise exception 'REVIEW_NOT_ELIGIBLE';
    end if;
    if new.order_id is null then
      select o.id into new.order_id
        from orders o join order_items oi on oi.order_id = o.id
        join ticket_types tt on tt.id = oi.ticket_type_id
       where o.event_id = new.event_id and o.user_id = new.user_id and o.status = 'paid'
       order by o.created_at desc limit 1;
    end if;
    new.status := 'visible';
    new.hidden_reason := null;
    new.organizer_reply := null;
    new.organizer_replied_at := null;
    return new;
  end if;

  -- UPDATE : un admin peut tout changer (modération) ; l'auteur peut revoir
  -- sa note/son commentaire (jamais les champs de modération ni la réponse
  -- de l'organisateur, gérée par une fonction dédiée) ; l'organisateur ne
  -- passe pas par un UPDATE direct (voir reply_to_review()).
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if auth.uid() = old.user_id then
    new.event_id := old.event_id;
    new.user_id := old.user_id;
    new.order_id := old.order_id;
    new.status := old.status;
    new.hidden_reason := old.hidden_reason;
    new.organizer_reply := old.organizer_reply;
    new.organizer_replied_at := old.organizer_replied_at;
    return new;
  end if;

  raise exception 'REVIEW_NOT_EDITABLE';
end;
$$;

drop trigger if exists trg_event_reviews_before_write on event_reviews;
create trigger trg_event_reviews_before_write
  before insert or update on event_reviews
  for each row execute function public.event_reviews_before_write();

-- 3. RLS -------------------------------------------------------------------------
create policy "Avis visibles de tous" on event_reviews
  for select using (
    status = 'visible'
    or auth.uid() = user_id
    or is_admin()
    or event_id in (select id from events where organizer_id in (select id from organizers where user_id = auth.uid()))
  );

create policy "Un acheteur publie son avis" on event_reviews
  for insert with check (auth.uid() = user_id and public.current_user_is_active());

create policy "L'auteur modifie son avis, l'admin modère" on event_reviews
  for update using (auth.uid() = user_id or is_admin());

create policy "L'auteur ou l'admin supprime l'avis" on event_reviews
  for delete using (auth.uid() = user_id or is_admin());

create policy "Signalement d'avis" on event_review_reports
  for insert with check (auth.uid() = reported_by);
create policy "Organisateur et admin voient les signalements" on event_review_reports
  for select using (
    is_admin()
    or review_id in (
      select er.id from event_reviews er
        join events e on e.id = er.event_id
       where e.organizer_id in (select id from organizers where user_id = auth.uid())
    )
  );

-- 4. Réponse de l'organisateur (fonction dédiée : jamais via UPDATE direct de la note) --
create or replace function public.reply_to_review(p_user_id uuid, p_review_id uuid, p_reply text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owns boolean;
begin
  select exists (
    select 1 from event_reviews er
      join events e on e.id = er.event_id
     where er.id = p_review_id
       and e.organizer_id in (select id from organizers where user_id = p_user_id)
  ) into v_owns;

  if not v_owns then
    raise exception 'NOT_EVENT_ORGANIZER';
  end if;

  update event_reviews
     set organizer_reply = nullif(btrim(coalesce(p_reply, '')), ''),
         organizer_replied_at = case when nullif(btrim(coalesce(p_reply, '')), '') is null then null else now() end
   where id = p_review_id;
end;
$$;

revoke all on function public.reply_to_review(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reply_to_review(uuid, uuid, text) to service_role;

-- 5. Agrégat : note moyenne + nombre d'avis, exposé publiquement ------------------
create or replace view public.event_review_stats as
  select event_id, count(*)::integer as review_count, round(avg(rating)::numeric, 1) as average_rating
    from event_reviews
   where status = 'visible'
   group by event_id;

grant select on public.event_review_stats to anon, authenticated;
