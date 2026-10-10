-- ============================================================
-- TIKEO — Notifications multi-canaux + rappels d'événement
-- ============================================================
-- Jusqu'ici, `notifications` ne servait qu'à l'affichage dans l'espace
-- membre. On la transforme en file de livraison :
--   - link            : page à ouvrir quand on clique sur la notification ;
--   - email_pending   : un email doit encore être envoyé ;
--   - push_pending    : une notification push doit encore être envoyée ;
--   - delivered_at    : dernière livraison réussie.
--
-- L'envoi réel (Brevo pour l'email, Web Push pour le navigateur/mobile) est
-- fait par la route serveur /api/cron/tick (voir server/utils/notifyDispatcher.ts),
-- qui « réclame » des lots de notifications via claim_pending_notifications()
-- (verrou skip locked : deux exécutions simultanées n'envoient jamais deux fois).
--
-- Rappels : generate_event_reminders() crée, pour chaque détenteur de billet
-- valide, un rappel 24 h puis 3 h avant l'événement (une seule fois par
-- personne, événement et type de rappel : table event_reminder_log).
-- ============================================================

-- 1. Colonnes de livraison ------------------------------------------------
alter table notifications add column if not exists link text;
alter table notifications add column if not exists email_pending boolean not null default false;
alter table notifications add column if not exists push_pending boolean not null default false;
alter table notifications add column if not exists delivered_at timestamptz;
alter table notifications add column if not exists delivery_claimed_at timestamptz;

create index if not exists notifications_pending_delivery_idx
  on notifications (created_at)
  where email_pending or push_pending;

-- Un utilisateur connecté ne doit pas pouvoir déclencher lui-même des envois
-- d'emails (la policy « Notifications personnelles » lui laisse écrire ses
-- propres lignes) : les drapeaux de livraison sont remis à zéro, sauf pour
--   - le serveur (service_role) et les sessions sans utilisateur (cron, SQL) ;
--   - les fonctions SQL de Tikeo qui annoncent explicitement leur légitimité
--     avec set_config('tikeo.allow_delivery_flags', '1', true) (liste d'attente,
--     transferts...) — un client ne peut pas appeler set_config via l'API ;
--   - les administrateurs.
create or replace function public.notifications_guard_delivery_flags()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or auth.role() = 'service_role'
     or coalesce(current_setting('tikeo.allow_delivery_flags', true), '') = '1'
     or public.is_admin()
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.email_pending := false;
    new.push_pending := false;
    new.delivered_at := null;
    new.delivery_claimed_at := null;
    return new;
  end if;

  new.email_pending := old.email_pending;
  new.push_pending := old.push_pending;
  new.delivered_at := old.delivered_at;
  new.delivery_claimed_at := old.delivery_claimed_at;
  new.link := old.link;
  return new;
end;
$$;

drop trigger if exists trg_notifications_guard_delivery_flags on notifications;
create trigger trg_notifications_guard_delivery_flags
  before insert or update on notifications
  for each row execute function public.notifications_guard_delivery_flags();

-- 2. Abonnements Web Push --------------------------------------------------
create table if not exists push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- Création / suppression passent par le serveur (validation de l'endpoint) ;
-- l'utilisateur peut seulement voir et retirer ses propres appareils.
create policy "Appareils push personnels (lecture)" on push_subscriptions
  for select using (auth.uid() = user_id);
create policy "Appareils push personnels (suppression)" on push_subscriptions
  for delete using (auth.uid() = user_id);

-- 3. Journal des rappels envoyés ------------------------------------------
create table if not exists event_reminder_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  kind text not null check (kind in ('h24', 'h3')),
  created_at timestamptz not null default now(),
  primary key (user_id, event_id, kind)
);

alter table event_reminder_log enable row level security;
-- Aucune policy : table interne, lue/écrite uniquement par les fonctions SQL et le serveur.

-- 4. Génération des rappels -------------------------------------------------
create or replace function public.generate_event_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_count integer := 0;
  v_when text;
  v_place text;
begin
  for r in
    select tk.user_id,
           e.id as event_id,
           e.slug,
           e.title,
           e.start_date,
           e.location_name,
           e.city,
           k.kind,
           count(*)::integer as n,
           coalesce(p.notify_email, true) as wants_email
      from tickets tk
      join events e on e.id = tk.event_id
      left join profiles p on p.user_id = tk.user_id
     cross join (values ('h24', interval '24 hours'), ('h3', interval '3 hours')) as k(kind, lead)
     where tk.status = 'valid'
       and e.status in ('published', 'sold_out')
       and e.start_date > now()
       and e.start_date <= now() + k.lead
       -- Pas de rappel « demain » à quelqu'un qui vient d'acheter son billet la veille.
       and tk.created_at <= e.start_date - k.lead
       and not exists (
         select 1 from event_reminder_log l
          where l.user_id = tk.user_id and l.event_id = e.id and l.kind = k.kind
       )
     group by tk.user_id, e.id, e.slug, e.title, e.start_date, e.location_name, e.city, k.kind, p.notify_email
  loop
    insert into event_reminder_log (user_id, event_id, kind)
    values (r.user_id, r.event_id, r.kind)
    on conflict do nothing;

    if found then
      v_when := to_char(r.start_date at time zone 'Africa/Abidjan', 'DD/MM/YYYY') || ' à ' ||
                to_char(r.start_date at time zone 'Africa/Abidjan', 'HH24"h"MI');
      v_place := coalesce(nullif(r.location_name, ''), r.city, '');

      insert into notifications (user_id, title, message, type, link, email_pending, push_pending)
      values (
        r.user_id,
        case when r.kind = 'h24' then 'C''est demain : ' || r.title else 'Bientôt : ' || r.title end,
        case when r.kind = 'h24'
          then 'Rendez-vous le ' || v_when || case when v_place <> '' then ' — ' || v_place else '' end ||
               '. Vous avez ' || r.n || case when r.n > 1 then ' billets' else ' billet' end || ' : gardez-' ||
               case when r.n > 1 then 'les' else 'le' end || ' à portée de main (même sans connexion).'
          else 'L''événement commence à ' || to_char(r.start_date at time zone 'Africa/Abidjan', 'HH24"h"MI') ||
               case when v_place <> '' then ' — ' || v_place else '' end ||
               '. Ouvrez votre billet et présentez le QR code à l''entrée.'
        end,
        'event_reminder',
        '/mon-espace/mes-billets',
        r.wants_email,
        true
      );
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- 5. Lot de notifications à livrer (verrou skip locked) ---------------------
create or replace function public.claim_pending_notifications(p_limit integer default 100)
returns setof notifications
language sql
security definer
set search_path = public
as $$
  update notifications n
     set delivery_claimed_at = now()
   where n.id in (
     select id
       from notifications
      where (email_pending or push_pending)
        and (delivery_claimed_at is null or delivery_claimed_at < now() - interval '10 minutes')
      order by created_at
      limit greatest(1, least(coalesce(p_limit, 100), 500))
        for update skip locked
   )
  returning n.*;
$$;

-- 6. Droits : serveur uniquement --------------------------------------------
revoke all on function public.generate_event_reminders() from public, anon, authenticated;
revoke all on function public.claim_pending_notifications(integer) from public, anon, authenticated;
grant execute on function public.generate_event_reminders() to service_role;
grant execute on function public.claim_pending_notifications(integer) to service_role;
