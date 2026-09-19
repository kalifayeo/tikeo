-- ============================================================
-- TIKEO — Retour à Supabase Auth (annule 0002_custom_auth.sql)
-- ============================================================
-- Le SMTP Supabase est maintenant configuré avec Brevo (dashboard
-- Supabase > Authentication > SMTP Settings). L'application utilise
-- donc à nouveau auth.users comme source de vérité pour les comptes,
-- au lieu de la table "users" maison créée par 0002.
--
-- ⚠️ Ce script supprime la table "users" et "otp_codes" créées par
-- 0002 (projet encore en développement, sans données de production).

-- ------------------------------------------------------------
-- 1) Rebrancher les clés étrangères sur auth.users
-- ------------------------------------------------------------
alter table profiles drop constraint if exists profiles_user_id_fkey;
alter table profiles add constraint profiles_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table organizers drop constraint if exists organizers_user_id_fkey;
alter table organizers add constraint organizers_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table orders drop constraint if exists orders_user_id_fkey;
alter table orders add constraint orders_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table tickets drop constraint if exists tickets_user_id_fkey;
alter table tickets add constraint tickets_user_id_fkey
  foreign key (user_id) references auth.users(id);

alter table tickets drop constraint if exists tickets_used_by_fkey;
alter table tickets add constraint tickets_used_by_fkey
  foreign key (used_by) references auth.users(id);

alter table event_agents drop constraint if exists event_agents_user_id_fkey;
alter table event_agents add constraint event_agents_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table favorites drop constraint if exists favorites_user_id_fkey;
alter table favorites add constraint favorites_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table notifications drop constraint if exists notifications_user_id_fkey;
alter table notifications add constraint notifications_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table audit_logs drop constraint if exists audit_logs_user_id_fkey;
alter table audit_logs add constraint audit_logs_user_id_fkey
  foreign key (user_id) references auth.users(id);

-- ------------------------------------------------------------
-- 2) Création automatique du profil à l'inscription
-- ------------------------------------------------------------
-- supabase.auth.signUp({ options: { data: { full_name, phone } } })
-- transmet ces champs dans raw_user_meta_data, récupérés ici.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, phone, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    new.email,
    'buyer'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ------------------------------------------------------------
-- 3) Nettoyage de l'authentification maison (0002)
-- ------------------------------------------------------------
drop table if exists otp_codes;
drop table if exists users cascade;
drop type if exists otp_purpose;
