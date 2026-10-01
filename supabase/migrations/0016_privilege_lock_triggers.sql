-- ============================================================
-- TIKEO — Audit sécurité : verrouillage des colonnes de privilège
-- ============================================================
-- Faille corrigée : les policies RLS "for update using (auth.uid() =
-- user_id)" restreignent QUELLES LIGNES on peut modifier, pas QUELLES
-- COLONNES. Un acheteur normal pouvait donc modifier son propre profil
-- (autorisé) en y glissant `role: 'admin'` (jamais prévu), et un
-- organisateur passer son propre `status` à `approved` en même temps
-- qu'un changement de nom/logo légitime. Même principe que le verrou déjà
-- en place sur `events`/`ticket_types` (0009_event_edit_requests.sql).

-- ------------------------------------------------------------
-- profiles.role / profiles.status : réservés à l'admin (ou service_role)
-- ------------------------------------------------------------
create or replace function enforce_profile_privilege_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'ROLE_CHANGE_FORBIDDEN: seul un administrateur peut changer le rôle d''un compte.';
  end if;

  if new.status is distinct from old.status then
    raise exception 'STATUS_CHANGE_FORBIDDEN: seul un administrateur peut changer le statut d''un compte.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_profile_privilege_lock on profiles;
create trigger trg_enforce_profile_privilege_lock
  before update on profiles
  for each row execute function enforce_profile_privilege_lock();

-- ------------------------------------------------------------
-- organizers.status : réservé à l'admin (ou service_role) — c'est ce
-- champ qui déclenche le badge "organisateur vérifié" côté acheteur.
-- ------------------------------------------------------------
create or replace function enforce_organizer_status_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or is_admin() then
    return new;
  end if;

  if new.status is distinct from old.status then
    raise exception 'STATUS_CHANGE_FORBIDDEN: seul un administrateur peut approuver/suspendre un espace organisateur.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_organizer_status_lock on organizers;
create trigger trg_enforce_organizer_status_lock
  before update on organizers
  for each row execute function enforce_organizer_status_lock();
