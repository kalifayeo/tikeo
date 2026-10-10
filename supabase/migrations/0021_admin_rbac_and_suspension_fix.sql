-- ============================================================
-- TIKEO — Correctif "Suspendre un utilisateur" + RBAC administrateurs
-- ============================================================
-- PARTIE A — Pourquoi la suspension "ne marchait pas" -------------------
-- Le bouton Suspendre/Réactiver (pages/admin/utilisateurs/index.vue) met
-- correctement à jour `profiles.status` (la policy "Admin modifie tous les
-- profils" + le trigger de 0016 l'autorisaient déjà pour un admin). Le vrai
-- problème est en aval : une fois `status = 'suspended'` enregistré, RIEN
-- dans l'application n'en tenait compte :
--   1. `is_admin()` ne vérifiait que `role = 'admin'`, jamais `status` : un
--      admin suspendu gardait TOUS ses droits d'administration.
--   2. Aucune policy RLS n'empêchait un compte suspendu de continuer à
--      utiliser la plateforme (devenir organisateur, créer un événement,
--      modifier son espace organisateur, soumettre une demande de
--      modification, mettre à jour son propre profil...).
--   3. Côté client, rien ne déconnectait un compte suspendu déjà connecté :
--      son token restait valide jusqu'à expiration.
-- Donc "suspendre" changeait une valeur en base sans aucun effet réel — la
-- suspension semblait fonctionner (le badge de statut changeait) mais
-- n'empêchait rien. On corrige ça au niveau base de données (RLS +
-- triggers), qui est la seule couche qu'un accès direct à l'API Supabase ne
-- peut pas contourner. Le correctif frontend (déconnexion immédiate d'un
-- compte suspendu) vient en complément, jamais en remplacement.
--
-- PARTIE B — RBAC administrateurs ---------------------------------------
-- Nouveau modèle : `profiles.role = 'admin'` continue de signifier "a accès
-- à l'espace d'administration". Le PÉRIMÈTRE de cet accès est désormais
-- gouverné par des rôles administrateurs (table admin_roles) porteurs de
-- permissions précises (table permissions / admin_role_permissions),
-- assignés à un compte admin via admin_user_roles (plusieurs rôles
-- possibles par admin, pour rester évolutif). Le rôle système "super_admin"
-- garde un accès total (bypass explicite), tous les autres rôles n'ont que
-- les permissions qui leur sont assignées.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Compte actif : helper réutilisé par toutes les policies "self-service"
-- ------------------------------------------------------------
create or replace function public.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select status = 'active' from profiles where user_id = auth.uid()),
    false
  );
$$;

comment on function public.current_user_is_active() is
  'Vrai si le profil de l''utilisateur connecté existe et a le statut ''active''. Utilisé pour bloquer les écritures des comptes suspendus au niveau RLS (pas seulement côté interface).';

grant execute on function public.current_user_is_active() to authenticated, anon;

-- ------------------------------------------------------------
-- 2. is_admin() doit exiger un compte actif : un admin suspendu ne doit
--    conserver AUCUN privilège (lecture ou écriture).
-- ------------------------------------------------------------
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where user_id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

-- ------------------------------------------------------------
-- 3. Schéma RBAC
-- ------------------------------------------------------------
create table if not exists admin_roles (
  id uuid primary key default uuid_generate_v4(),
  key text not null unique,             -- ex: 'super_admin', 'users_admin'
  name text not null,                    -- libellé affiché
  description text,
  is_system boolean not null default false, -- true pour super_admin : non supprimable
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists permissions (
  id uuid primary key default uuid_generate_v4(),
  key text not null unique,              -- ex: 'users.suspend'
  category text not null,                -- regroupement pour l'UI ('users', 'events', ...)
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists admin_role_permissions (
  role_id uuid not null references admin_roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

-- Plusieurs rôles par admin possibles (architecture évolutive : un admin
-- peut cumuler "Admin Événements" + "Admin Billetterie" par exemple).
create table if not exists admin_user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references admin_roles(id) on delete cascade,
  assigned_by uuid references auth.users(id),
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create index if not exists admin_role_permissions_permission_idx on admin_role_permissions(permission_id);
create index if not exists admin_user_roles_role_idx on admin_user_roles(role_id);

-- ------------------------------------------------------------
-- 4. Fonctions RBAC
-- ------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from admin_user_roles ur
      join admin_roles r on r.id = ur.role_id
      join profiles p on p.user_id = ur.user_id
     where ur.user_id = auth.uid()
       and r.key = 'super_admin'
       and p.role = 'admin'
       and p.status = 'active'
  );
$$;

comment on function public.is_super_admin() is
  'Super Admin : accès total à la plateforme, bypass de toute vérification de permission fine.';

grant execute on function public.is_super_admin() to authenticated;

create or replace function public.has_permission(p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or exists (
      select 1
        from admin_user_roles ur
        join admin_role_permissions rp on rp.role_id = ur.role_id
        join permissions perm on perm.id = rp.permission_id
        join profiles p on p.user_id = ur.user_id
       where ur.user_id = auth.uid()
         and perm.key = p_permission_key
         and p.role = 'admin'
         and p.status = 'active'
    );
$$;

comment on function public.has_permission(text) is
  'Vrai si l''utilisateur connecté est Super Admin, ou si l''un de ses rôles administrateurs porte la permission demandée. Utilisée dans les policies RLS ET côté serveur : c''est la SEULE source de vérité pour l''autorisation.';

grant execute on function public.has_permission(text) to authenticated;

-- Variantes "avec identifiant explicite", pour les routes serveur qui
-- utilisent la clé service_role (donc sans auth.uid() dans la session
-- Postgres). Le serveur a déjà vérifié le jeton via requireUser() avant
-- d'appeler ces fonctions (server/utils/adminAuth.ts) : jamais d'identifiant
-- fourni tel quel par le client.
create or replace function public.is_super_admin_for(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from admin_user_roles ur
      join admin_roles r on r.id = ur.role_id
      join profiles p on p.user_id = ur.user_id
     where ur.user_id = p_user_id
       and r.key = 'super_admin'
       and p.role = 'admin'
       and p.status = 'active'
  );
$$;

create or replace function public.has_permission_for(p_user_id uuid, p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin_for(p_user_id)
    or exists (
      select 1
        from admin_user_roles ur
        join admin_role_permissions rp on rp.role_id = ur.role_id
        join permissions perm on perm.id = rp.permission_id
        join profiles p on p.user_id = ur.user_id
       where ur.user_id = p_user_id
         and perm.key = p_permission_key
         and p.role = 'admin'
         and p.status = 'active'
    );
$$;

grant execute on function public.is_super_admin_for(uuid) to service_role;
grant execute on function public.has_permission_for(uuid, text) to service_role;

-- Contexte complet de l'admin connecté, pour l'interface (un seul aller-retour
-- réseau au lieu de multiples requêtes sur les tables de jonction, qui ne
-- sont volontairement pas ouvertes en lecture large).
create or replace function public.get_admin_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile profiles%rowtype;
  v_result jsonb;
begin
  select * into v_profile from profiles where user_id = auth.uid();

  if v_profile.user_id is null or v_profile.role <> 'admin' or v_profile.status <> 'active' then
    return jsonb_build_object('isAdmin', false, 'isSuperAdmin', false, 'roles', '[]'::jsonb, 'permissions', '[]'::jsonb);
  end if;

  select jsonb_build_object(
    'isAdmin', true,
    'isSuperAdmin', public.is_super_admin(),
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object('key', r.key, 'name', r.name) order by r.name)
        from admin_user_roles ur
        join admin_roles r on r.id = ur.role_id
       where ur.user_id = auth.uid()
    ), '[]'::jsonb),
    'permissions', case
      when public.is_super_admin() then (select coalesce(jsonb_agg(key order by key), '[]'::jsonb) from permissions)
      else coalesce((
        select jsonb_agg(distinct perm.key)
          from admin_user_roles ur
          join admin_role_permissions rp on rp.role_id = ur.role_id
          join permissions perm on perm.id = rp.permission_id
         where ur.user_id = auth.uid()
      ), '[]'::jsonb)
    end
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_admin_context() to authenticated;

-- ------------------------------------------------------------
-- 5. Catalogue des permissions (cahier des charges : liste d'exemples)
-- ------------------------------------------------------------
insert into permissions (key, category, description) values
  ('users.view',        'users',      'Voir la liste des utilisateurs'),
  ('users.create',      'users',      'Créer un utilisateur'),
  ('users.update',      'users',      'Modifier un utilisateur'),
  ('users.suspend',     'users',      'Suspendre un utilisateur'),
  ('users.reactivate',  'users',      'Réactiver un utilisateur'),
  ('users.delete',      'users',      'Supprimer un utilisateur'),
  ('users.manage_roles','users',      'Changer le rôle applicatif d''un utilisateur (acheteur/organisateur/agent/admin)'),
  ('organizers.view',      'organizers', 'Voir les organisateurs'),
  ('organizers.approve',   'organizers', 'Approuver un espace organisateur'),
  ('organizers.suspend',   'organizers', 'Suspendre un espace organisateur'),
  ('events.view',       'events',     'Voir les événements'),
  ('events.validate',   'events',     'Valider une demande de modification d''événement'),
  ('events.update',     'events',     'Modifier un événement'),
  ('events.delete',     'events',     'Supprimer un événement'),
  ('tickets.view',      'tickets',    'Voir les billets émis'),
  ('tickets.manage',    'tickets',    'Gérer les types de billets'),
  ('orders.view',       'orders',     'Voir les commandes'),
  ('payments.view',     'payments',   'Voir les paiements'),
  ('payments.refund',   'payments',   'Effectuer un remboursement'),
  ('payments.confirm',  'payments',   'Confirmer manuellement un paiement reçu'),
  ('support.view',      'support',    'Voir les messages de support/contact'),
  ('support.manage',    'support',    'Traiter les messages de support/contact'),
  ('moderation.manage', 'moderation', 'Gérer les catégories et la modération de contenu'),
  ('marketing.manage',  'marketing',  'Gérer la bannière d''accueil et le contenu marketing'),
  ('admin.manage_admins',      'admin', 'Créer/modifier/désactiver des administrateurs'),
  ('admin.manage_permissions', 'admin', 'Attribuer des rôles et des permissions'),
  ('settings.manage',   'settings',   'Gérer les paramètres de la plateforme')
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- 6. Rôles par défaut
-- ------------------------------------------------------------
insert into admin_roles (key, name, description, is_system) values
  ('super_admin',    'Super Admin',        'Accès complet à toute la plateforme.', true),
  ('users_admin',      'Admin Utilisateurs', 'Gestion des comptes utilisateurs (voir, modifier, suspendre, réactiver).', false),
  ('events_admin',     'Admin Événements',   'Modération des événements et des espaces organisateurs.', false),
  ('ticketing_admin',  'Admin Billetterie',  'Gestion des types de billets et des billets émis.', false),
  ('finance_admin',    'Admin Finance',      'Consultation des commandes/paiements et remboursements.', false),
  ('support_admin',    'Admin Support',      'Traitement des messages de contact / support.', false),
  ('moderation_admin', 'Admin Modération',   'Gestion des catégories et de la modération de contenu.', false),
  ('marketing_admin',  'Admin Marketing',    'Gestion de la bannière d''accueil et du contenu marketing.', false)
on conflict (key) do nothing;

-- Super Admin porte explicitement toutes les permissions (en plus du bypass
-- is_super_admin()) : cela permet à l'écran "Administrateurs" d'afficher un
-- récapitulatif fidèle sans cas particulier.
insert into admin_role_permissions (role_id, permission_id)
select r.id, p.id from admin_roles r cross join permissions p where r.key = 'super_admin'
on conflict do nothing;

insert into admin_role_permissions (role_id, permission_id)
select r.id, p.id from admin_roles r join permissions p on p.key in
  ('users.view', 'users.create', 'users.update', 'users.suspend', 'users.reactivate', 'users.manage_roles')
where r.key = 'users_admin'
on conflict do nothing;

insert into admin_role_permissions (role_id, permission_id)
select r.id, p.id from admin_roles r join permissions p on p.key in
  ('events.view', 'events.validate', 'events.update', 'events.delete', 'organizers.view', 'organizers.approve', 'organizers.suspend')
where r.key = 'events_admin'
on conflict do nothing;

insert into admin_role_permissions (role_id, permission_id)
select r.id, p.id from admin_roles r join permissions p on p.key in
  ('tickets.view', 'tickets.manage', 'events.view')
where r.key = 'ticketing_admin'
on conflict do nothing;

insert into admin_role_permissions (role_id, permission_id)
select r.id, p.id from admin_roles r join permissions p on p.key in
  ('orders.view', 'payments.view', 'payments.refund', 'payments.confirm')
where r.key = 'finance_admin'
on conflict do nothing;

insert into admin_role_permissions (role_id, permission_id)
select r.id, p.id from admin_roles r join permissions p on p.key in
  ('support.view', 'support.manage')
where r.key = 'support_admin'
on conflict do nothing;

insert into admin_role_permissions (role_id, permission_id)
select r.id, p.id from admin_roles r join permissions p on p.key in
  ('moderation.manage', 'events.view')
where r.key = 'moderation_admin'
on conflict do nothing;

insert into admin_role_permissions (role_id, permission_id)
select r.id, p.id from admin_roles r join permissions p on p.key in
  ('marketing.manage')
where r.key = 'marketing_admin'
on conflict do nothing;

-- ------------------------------------------------------------
-- 7. Migration des admins existants : tout compte déjà role='admin' reçoit
--    le rôle système "super_admin" pour ne rien casser (comportement
--    identique à avant : accès complet).
-- ------------------------------------------------------------
insert into admin_user_roles (user_id, role_id)
select p.user_id, r.id
  from profiles p
  cross join admin_roles r
 where p.role = 'admin' and r.key = 'super_admin'
on conflict do nothing;

-- ------------------------------------------------------------
-- 8. RLS sur les nouvelles tables
-- ------------------------------------------------------------
alter table admin_roles enable row level security;
alter table permissions enable row level security;
alter table admin_role_permissions enable row level security;
alter table admin_user_roles enable row level security;

-- Catalogue (rôles/permissions) : lisible par tout admin actif (nécessaire
-- pour afficher les menus/formulaires d'attribution), gérable seulement par
-- qui a la permission dédiée.
create policy "Admin lit les rôles" on admin_roles
  for select using (is_admin());
create policy "Gestion des permissions modifie les rôles" on admin_roles
  for insert with check (has_permission('admin.manage_permissions') and not is_system);
create policy "Gestion des permissions met à jour les rôles" on admin_roles
  for update using (has_permission('admin.manage_permissions') and not is_system)
  with check (not is_system);
create policy "Gestion des permissions supprime les rôles" on admin_roles
  for delete using (has_permission('admin.manage_permissions') and not is_system);

create policy "Admin lit le catalogue de permissions" on permissions
  for select using (is_admin());

create policy "Admin lit les permissions des rôles" on admin_role_permissions
  for select using (is_admin());
create policy "Gestion des permissions assigne des permissions" on admin_role_permissions
  for insert with check (
    has_permission('admin.manage_permissions')
    and not exists (select 1 from admin_roles r where r.id = role_id and r.key = 'super_admin')
  );
create policy "Gestion des permissions retire des permissions" on admin_role_permissions
  for delete using (
    has_permission('admin.manage_permissions')
    and not exists (select 1 from admin_roles r where r.id = role_id and r.key = 'super_admin')
  );

-- Un admin voit ses propres rôles ; qui gère les admins voit/assigne tout.
create policy "Admin voit ses propres rôles" on admin_user_roles
  for select using (user_id = auth.uid() or has_permission('admin.manage_admins'));
create policy "Gestion des admins assigne un rôle" on admin_user_roles
  for insert with check (
    has_permission('admin.manage_admins')
    and exists (select 1 from profiles p where p.user_id = admin_user_roles.user_id and p.role = 'admin')
  );
create policy "Gestion des admins retire un rôle" on admin_user_roles
  for delete using (has_permission('admin.manage_admins'));

-- ------------------------------------------------------------
-- 9. Trigger de verrouillage des profils : granularité fine par permission
--    (remplace la version 0016, qui n'autorisait que "admin ou rien").
-- ------------------------------------------------------------
create or replace function enforce_profile_privilege_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or is_super_admin() then
    return new;
  end if;

  -- Gérer les administrateurs (créer/modifier/désactiver, cf. cahier des
  -- charges) est une permission à part entière qui couvre à la fois le
  -- rôle et le statut d'un compte admin — sans avoir besoin des permissions
  -- "utilisateurs" classiques.
  if has_permission('admin.manage_admins') then
    return new;
  end if;

  if new.role is distinct from old.role then
    if not has_permission('users.manage_roles') then
      raise exception 'ROLE_CHANGE_FORBIDDEN: permission users.manage_roles requise pour changer le rôle d''un compte.';
    end if;
  end if;

  if new.status is distinct from old.status then
    -- Suspension et réactivation sont deux permissions distinctes (cahier
    -- des charges) : un rôle peut avoir l'une sans l'autre.
    if new.status = 'suspended' then
      if not has_permission('users.suspend') then
        raise exception 'STATUS_CHANGE_FORBIDDEN: permission users.suspend requise pour suspendre un compte.';
      end if;
    elsif old.status = 'suspended' then
      if not has_permission('users.reactivate') then
        raise exception 'STATUS_CHANGE_FORBIDDEN: permission users.reactivate requise pour réactiver un compte.';
      end if;
    elsif not has_permission('users.update') then
      raise exception 'STATUS_CHANGE_FORBIDDEN: permission users.update requise pour changer le statut d''un compte.';
    end if;
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 10. Trigger organizers.status : permissions dédiées approve/suspend
-- ------------------------------------------------------------
create or replace function enforce_organizer_status_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or is_super_admin() then
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'suspended' then
      if not has_permission('organizers.suspend') then
        raise exception 'STATUS_CHANGE_FORBIDDEN: permission organizers.suspend requise.';
      end if;
    else
      if not has_permission('organizers.approve') then
        raise exception 'STATUS_CHANGE_FORBIDDEN: permission organizers.approve requise.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 11. Comptes suspendus : blocage RLS des actions d'auto-service (défense
--     en profondeur — un token encore valide ne doit plus rien pouvoir
--     écrire, même en appelant l'API Supabase directement).
-- ------------------------------------------------------------

-- Profil : un compte suspendu ne peut plus modifier ses propres informations.
drop policy if exists "Profil modifiable par son propriétaire" on profiles;
create policy "Profil modifiable par son propriétaire" on profiles
  for update using (auth.uid() = user_id and status <> 'suspended')
  with check (auth.uid() = user_id);

-- Organizers : demander/gérer un espace organisateur requiert un compte actif.
drop policy if exists "Création de son espace organisateur" on organizers;
create policy "Création de son espace organisateur" on organizers
  for insert with check (auth.uid() = user_id and current_user_is_active());

drop policy if exists "Organisateur modifie son propre espace" on organizers;
create policy "Organisateur modifie son propre espace" on organizers
  for update using (auth.uid() = user_id and current_user_is_active());

-- Events : créer/mettre à jour ses événements requiert un compte actif.
drop policy if exists "Organisateur crée ses événements" on events;
create policy "Organisateur crée ses événements" on events
  for insert with check (
    current_user_is_active()
    and organizer_id in (select id from organizers where user_id = auth.uid())
  );

drop policy if exists "Organisateur met à jour ses événements" on events;
create policy "Organisateur met à jour ses événements" on events
  for update using (
    current_user_is_active()
    and organizer_id in (select id from organizers where user_id = auth.uid())
  )
  with check (organizer_id in (select id from organizers where user_id = auth.uid()));

-- Ticket types : idem.
drop policy if exists "Organisateur crée des types de billets" on ticket_types;
create policy "Organisateur crée des types de billets" on ticket_types
  for insert with check (
    current_user_is_active()
    and event_id in (select id from events where organizer_id in (
      select id from organizers where user_id = auth.uid()
    ))
  );

drop policy if exists "Organisateur met à jour ses types de billets" on ticket_types;
create policy "Organisateur met à jour ses types de billets" on ticket_types
  for update using (
    current_user_is_active()
    and event_id in (select id from events where organizer_id in (
      select id from organizers where user_id = auth.uid()
    ))
  ) with check (
    event_id in (select id from events where organizer_id in (
      select id from organizers where user_id = auth.uid()
    ))
  );

-- Demandes de modification : un organisateur suspendu ne peut plus en créer.
drop policy if exists "Organisateur crée une demande de modification" on event_edit_requests;
create policy "Organisateur crée une demande de modification" on event_edit_requests
  for insert with check (
    current_user_is_active()
    and organizer_id in (select id from organizers where user_id = auth.uid())
    and requested_by = auth.uid()
  );

-- Favoris : un compte suspendu ne peut plus en ajouter (il garde l'accès en
-- lecture/suppression sur ce qu'il a déjà, aucune raison de l'en priver).
drop policy if exists "Favoris personnels" on favorites;
create policy "Favoris personnels lecture" on favorites
  for select using (auth.uid() = user_id);
create policy "Favoris personnels ajout" on favorites
  for insert with check (auth.uid() = user_id and current_user_is_active());
create policy "Favoris personnels suppression" on favorites
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 12. Policies existantes basées sur is_admin() : passage à des permissions
--     fines. Les lectures "globales" (dashboard) restent ouvertes à tout
--     admin actif ; les écritures/consultations sensibles exigent la
--     permission dédiée.
-- ------------------------------------------------------------

-- PROFILES (0004) : lecture ouverte à tout admin actif, écriture réservée
-- à qui peut au moins gérer les utilisateurs (le trigger ci-dessus affine
-- ensuite selon le champ modifié).
drop policy if exists "Admin voit tous les profils" on profiles;
create policy "Admin voit tous les profils" on profiles
  for select using (has_permission('users.view') or has_permission('admin.manage_admins'));

drop policy if exists "Admin modifie tous les profils" on profiles;
create policy "Admin modifie tous les profils" on profiles
  for update using (
    has_permission('users.update') or has_permission('users.suspend')
    or has_permission('users.reactivate') or has_permission('users.manage_roles')
    or has_permission('admin.manage_admins')
  );

-- ORGANIZERS (0004)
drop policy if exists "Admin gère tous les organisateurs" on organizers;
create policy "Admin voit tous les organisateurs" on organizers
  for select using (has_permission('organizers.view'));
create policy "Admin gère le statut des organisateurs" on organizers
  for update using (has_permission('organizers.approve') or has_permission('organizers.suspend'));
create policy "Admin supprime un organisateur" on organizers
  for delete using (is_super_admin());

-- EVENTS (0004) : modération (validation/suppression) par events.*
drop policy if exists "Admin gère tous les événements" on events;
create policy "Admin voit tous les événements" on events
  for select using (has_permission('events.view'));
create policy "Admin met à jour tous les événements" on events
  for update using (has_permission('events.update') or has_permission('events.validate'));
create policy "Admin supprime un événement" on events
  for delete using (has_permission('events.delete'));

-- TICKET_TYPES (0004) : gestion complète (créer/supprimer des types de
-- billets côté admin) via tickets.manage ; la mise à jour est en plus
-- ouverte à events.validate car approuver une demande de modification
-- (useEventEditRequests.approveRequest) peut mettre à jour des types de
-- billets existants au nom de l'organisateur.
drop policy if exists "Admin gère tous les types de billets" on ticket_types;
create policy "Admin voit tous les types de billets" on ticket_types
  for select using (has_permission('tickets.manage') or has_permission('events.validate') or has_permission('events.view'));
create policy "Admin crée des types de billets" on ticket_types
  for insert with check (has_permission('tickets.manage'));
create policy "Admin met à jour les types de billets" on ticket_types
  for update using (has_permission('tickets.manage') or has_permission('events.validate'))
  with check (has_permission('tickets.manage') or has_permission('events.validate'));
create policy "Admin supprime des types de billets" on ticket_types
  for delete using (has_permission('tickets.manage'));

-- ORDERS / PAYMENTS (0004)
drop policy if exists "Admin voit toutes les commandes" on orders;
create policy "Admin voit toutes les commandes" on orders
  for select using (has_permission('orders.view'));
drop policy if exists "Admin voit tous les paiements" on payments;
create policy "Admin voit tous les paiements" on payments
  for select using (has_permission('payments.view'));

-- TICKETS (0010)
drop policy if exists "Admin voit tous les billets" on tickets;
create policy "Admin voit tous les billets" on tickets
  for select using (has_permission('tickets.view'));

-- CONTACT_MESSAGES / SUPPORT (0011)
drop policy if exists "Admin voit tous les messages de contact" on contact_messages;
create policy "Admin voit tous les messages de contact" on contact_messages
  for select using (has_permission('support.view'));
drop policy if exists "Admin met à jour les messages de contact" on contact_messages;
create policy "Admin met à jour les messages de contact" on contact_messages
  for update using (has_permission('support.manage'));

-- CATEGORIES / MODERATION (0012)
drop policy if exists "Admin gère les catégories" on categories;
create policy "Admin gère les catégories" on categories
  for all using (has_permission('moderation.manage')) with check (has_permission('moderation.manage'));

-- HOME SLIDES / HERO CONTENT / MARKETING (0013)
drop policy if exists "Tout le monde peut lire les slides actifs" on home_slides;
create policy "Tout le monde peut lire les slides actifs" on home_slides
  for select using (status = 'active' or has_permission('marketing.manage'));
drop policy if exists "Admin gère les slides de l'accueil" on home_slides;
create policy "Admin gère les slides de l'accueil" on home_slides
  for all using (has_permission('marketing.manage')) with check (has_permission('marketing.manage'));
drop policy if exists "Admin modifie le texte de la bannière" on home_hero_content;
create policy "Admin modifie le texte de la bannière" on home_hero_content
  for update using (has_permission('marketing.manage')) with check (has_permission('marketing.manage'));

-- EVENT_EDIT_REQUESTS (0009) : validation par permission dédiée.
drop policy if exists "Organisateur voit ses demandes de modification" on event_edit_requests;
create policy "Organisateur voit ses demandes de modification" on event_edit_requests
  for select using (
    organizer_id in (select id from organizers where user_id = auth.uid())
    or has_permission('events.validate')
  );
drop policy if exists "Admin traite les demandes de modification" on event_edit_requests;
create policy "Admin traite les demandes de modification" on event_edit_requests
  for update using (has_permission('events.validate')) with check (has_permission('events.validate'));

-- Notifications / audit : déclenchées par n'importe quelle action admin,
-- on garde is_admin() (actif) plutôt qu'une permission dédiée inexistante.
-- (rien à changer ici : is_admin() a déjà été redéfini plus haut.)

-- Verrous de contenu événement/billet (0009) : un Admin Événements doit
-- pouvoir éditer directement même un événement publié.
create or replace function enforce_event_content_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or is_super_admin() or has_permission('events.update') then
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
  then
    raise exception 'MODIFICATION_REQUIRES_ADMIN_APPROVAL: cet événement est déjà publié — soumettez une demande de modification depuis l''espace organisateur.';
  end if;

  return new;
end;
$$;

create or replace function enforce_ticket_type_content_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_status event_status;
begin
  if auth.role() = 'service_role' or is_super_admin() or has_permission('tickets.manage') then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select status into parent_status from events where id = coalesce(new.event_id, old.event_id);

  if parent_status = 'draft' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'MODIFICATION_REQUIRES_ADMIN_APPROVAL: impossible de supprimer un type de billet d''un événement déjà publié.';
  end if;

  if new.name is distinct from old.name
     or new.description is distinct from old.description
     or new.price is distinct from old.price
     or new.quantity is distinct from old.quantity
     or new.sale_start is distinct from old.sale_start
     or new.sale_end is distinct from old.sale_end
  then
    raise exception 'MODIFICATION_REQUIRES_ADMIN_APPROVAL: ce type de billet appartient à un événement déjà publié — soumettez une demande de modification.';
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 13. updated_at automatique sur admin_roles
-- ------------------------------------------------------------
create or replace function set_admin_roles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_admin_roles_updated_at on admin_roles;
create trigger trg_admin_roles_updated_at
  before update on admin_roles
  for each row execute function set_admin_roles_updated_at();
