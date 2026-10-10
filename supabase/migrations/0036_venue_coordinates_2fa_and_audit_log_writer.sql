-- ============================================================
-- TIKEO — Carte du lieu, double authentification, journal d'activité
-- ============================================================

-- 1. CARTE DU LIEU ---------------------------------------------------------------
-- Coordonnées facultatives d'un événement, saisies par l'organisateur (recherche
-- d'adresse ou pointage sur la carte, voir components/VenueMapPicker.vue) et
-- affichées sur la page événement (components/VenueMap.vev, OpenStreetMap/Leaflet,
-- sans clé API). Champ éditable, soumis aux mêmes règles de verrouillage après
-- publication que les autres champs de localisation (migration 0009).
alter table events add column if not exists latitude double precision check (latitude between -90 and 90);
alter table events add column if not exists longitude double precision check (longitude between -180 and 180);

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
     or new.latitude is distinct from old.latitude
     or new.longitude is distinct from old.longitude
  then
    raise exception 'MODIFICATION_REQUIRES_ADMIN_APPROVAL: cet événement est déjà publié — soumettez une demande de modification depuis l''espace organisateur.';
  end if;

  return new;
end;
$$;

-- Le composable de demandes de modification (useEventEditRequests.ts) doit
-- pouvoir proposer lat/lng dans son diff — voir EDITABLE_EVENT_FIELDS côté front.

-- 2. DOUBLE AUTHENTIFICATION (2FA) ------------------------------------------------
-- L'inscription des facteurs TOTP et leur vérification passent entièrement par
-- l'API native `supabase.auth.mfa.*` (table interne auth.mfa_factors, hors du
-- schéma applicatif) : Tikeo n'a pas besoin de stocker de secret lui-même. On
-- ajoute seulement :
--   - une préférence « exiger la 2FA pour se connecter » par profil, utile pour
--     forcer les rôles sensibles (admin) une fois qu'ils ont activé un facteur ;
--   - une fonction lisible par tous pour savoir si le compte connecté a un
--     facteur vérifié (utilisée par l'interface pour proposer/masquer l'étape).
alter table profiles add column if not exists mfa_required boolean not null default false;

-- Un admin doit activer la 2FA sur son propre compte avant de pouvoir l'exiger
-- pour lui-même ; personne ne peut l'exiger pour un tiers depuis le client.
create or replace function public.profiles_guard_mfa_required()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.mfa_required and not old.mfa_required and auth.role() <> 'service_role' and not public.is_admin() then
    if not exists (
      select 1 from auth.mfa_factors f
       where f.user_id = auth.uid() and f.status = 'verified'
    ) then
      raise exception 'MFA_NOT_ENROLLED: activez un facteur de double authentification avant de l''exiger.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_guard_mfa_required on profiles;
create trigger trg_profiles_guard_mfa_required
  before update of mfa_required on profiles
  for each row execute function public.profiles_guard_mfa_required();

create or replace function public.current_user_has_verified_mfa()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;

grant execute on function public.current_user_has_verified_mfa() to authenticated;

-- Un compte admin qui exige la 2FA mais se retrouve sans facteur vérifié
-- (dernier facteur supprimé) perd immédiatement ses privilèges d'administration
-- jusqu'à en réinscrire un — pour que « exiger la 2FA » soit une garantie réelle,
-- pas seulement un texte affiché dans l'interface.
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles p
     where p.user_id = auth.uid()
       and p.role = 'admin'
       and p.status = 'active'
       and (
         not p.mfa_required
         or exists (select 1 from auth.mfa_factors f where f.user_id = p.user_id and f.status = 'verified')
       )
  );
$$;

-- 3. JOURNAL D'ACTIVITÉ ------------------------------------------------------------
-- La permission `audit.view` et la policy de lecture globale du journal
-- existent déjà (migration 0030_audit_log_viewer.sql) : rien à refaire ici.
-- On ajoute seulement une fonction d'écriture unique pour les routes serveur.
create or replace function public.log_admin_action(
  p_user_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_ip_address text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into audit_logs (user_id, action, entity_type, entity_id, metadata, ip_address)
  values (p_user_id, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb), p_ip_address);
$$;

revoke all on function public.log_admin_action(uuid, text, text, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.log_admin_action(uuid, text, text, uuid, jsonb, text) to service_role;
