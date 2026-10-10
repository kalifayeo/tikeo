-- ============================================================
-- TIKEO — Durcissement de sécurité (audit pré-lancement)
-- ============================================================
-- À exécuter dans Supabase > SQL Editor. Sans risque pour les données :
-- uniquement des retraits de droits et des triggers protégés par un bloc
-- d'exception (ils ne peuvent jamais bloquer une connexion).
-- Après exécution : lancer supabase/security/audit_rls.sql et vérifier.
-- ============================================================

-- 1. Fonctions d'autorisation réservées au serveur ------------------------
-- has_permission_for(uuid, text) et is_super_admin_for(uuid) prennent un
-- identifiant en paramètre. Accordées par défaut à anon/authenticated par
-- Supabase, elles permettaient à n'importe qui de demander « tel UUID est-il
-- administrateur ? ». Seul le serveur (service_role) les utilise.
revoke all on function public.has_permission_for(uuid, text) from public, anon, authenticated;
revoke all on function public.is_super_admin_for(uuid) from public, anon, authenticated;
grant execute on function public.has_permission_for(uuid, text) to service_role;
grant execute on function public.is_super_admin_for(uuid) to service_role;

-- 2. Codes promo : plus d'essai direct depuis le navigateur ---------------
-- La vérification passe désormais par /api/promo/validate (limitée en nombre
-- d'essais). La migration 0029 ne retirait le droit qu'à « public », pas à
-- « anon » : un visiteur non connecté pouvait deviner des codes sans limite.
revoke all on function public.validate_promo_code(uuid, text) from public, anon, authenticated;
grant execute on function public.validate_promo_code(uuid, text) to service_role;

-- 3. Fonctions de lecture réservées aux admins : plus pour les anonymes ----
revoke execute on function public.get_admin_context() from public, anon;
revoke execute on function public.admin_revenue_timeseries(integer) from public, anon;
revoke execute on function public.admin_signups_timeseries(integer) from public, anon;
revoke execute on function public.admin_top_events(integer) from public, anon;
grant execute on function public.get_admin_context() to authenticated;
grant execute on function public.admin_revenue_timeseries(integer) to authenticated;
grant execute on function public.admin_signups_timeseries(integer) to authenticated;
grant execute on function public.admin_top_events(integer) to authenticated;

-- 4. Messages de contact : insertion uniquement via le serveur -----------
-- /api/contact (Turnstile + limite de débit + contrôle de longueur) insère
-- avec la clé service_role. L'ancienne policy « with check (true) » laissait
-- n'importe qui inonder la table directement via l'API REST, en
-- contournant tous ces contrôles.
drop policy if exists "Tout le monde peut envoyer un message" on contact_messages;

-- 5. Stockage : un compte suspendu ne peut plus envoyer de fichiers -------
drop policy if exists "Envoi de médias par les comptes connectés" on storage.objects;
create policy "Envoi de médias par les comptes connectés" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and public.current_user_is_active()
    and (
      (storage.foldername(name))[1] in ('event-covers', 'seating-plans', 'organizer-logos', 'avatars')
      or ((storage.foldername(name))[1] = 'home-slides' and is_admin())
    )
  );

-- 6. Révocation des sessions ---------------------------------------------
-- Suspension ou suppression d'un compte : toutes ses sessions sont fermées
-- (plus de renouvellement de jeton possible ; le jeton déjà émis est de toute
-- façon refusé par le serveur, voir server/utils/userAuth.ts).
create or replace function public.revoke_sessions_on_lock()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.status in ('suspended', 'deleted') and old.status is distinct from new.status then
    begin
      delete from auth.sessions where user_id = new.user_id;
    exception when others then
      raise warning 'revoke_sessions_on_lock : %', sqlerrm;  -- ne bloque jamais la suspension
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_revoke_sessions_on_lock on public.profiles;
create trigger trg_revoke_sessions_on_lock
  after update of status on public.profiles
  for each row execute function public.revoke_sessions_on_lock();

-- Changement de mot de passe : les AUTRES appareils sont déconnectés
-- (on garde la session la plus récente = celle qui vient de changer le mot de passe).
create or replace function public.revoke_other_sessions_on_password_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    begin
      delete from auth.sessions s
       where s.user_id = new.id
         and s.id <> coalesce(
           (select s2.id from auth.sessions s2 where s2.user_id = new.id order by coalesce(s2.updated_at, s2.created_at) desc limit 1),
           '00000000-0000-0000-0000-000000000000'::uuid
         );
    exception when others then
      raise warning 'revoke_other_sessions_on_password_change : %', sqlerrm;  -- ne bloque jamais le changement
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_revoke_sessions_on_password_change on auth.users;
create trigger trg_revoke_sessions_on_password_change
  after update of encrypted_password on auth.users
  for each row execute function public.revoke_other_sessions_on_password_change();

revoke all on function public.revoke_sessions_on_lock() from public, anon, authenticated;
revoke all on function public.revoke_other_sessions_on_password_change() from public, anon, authenticated;
