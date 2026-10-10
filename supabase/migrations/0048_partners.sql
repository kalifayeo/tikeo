-- ============================================================
-- TIKEO — Partenaires (section d'accueil + page /partenaires)
-- ============================================================
-- Les partenaires de Tikeo (sponsors, moyens de paiement, médias, salles,
-- partenaires techniques, institutions) sont gérés depuis l'administration
-- (/admin/partenaires) : ajout, modification, suppression, ordre d'affichage,
-- mise en avant et activation / désactivation.
--
-- Lecture publique des partenaires ACTIFS uniquement ; écriture réservée aux
-- admins porteurs de la permission `partners.manage` (RBAC, migration 0021).
-- Le Super Admin et l'Admin Marketing la portent par défaut.
-- ============================================================

-- 1. Permission et rôle dédié -----------------------------------------
insert into permissions (key, category, description) values
  ('partners.manage', 'marketing', 'Gérer les partenaires affichés sur l''accueil et la page Partenaires')
on conflict (key) do nothing;

insert into admin_roles (key, name, description, is_system) values
  ('partner_admin', 'Admin Partenaires', 'Gère les partenaires affichés sur le site.', false)
on conflict (key) do nothing;

insert into admin_role_permissions (role_id, permission_id)
select r.id, p.id from admin_roles r join permissions p on p.key = 'partners.manage' where r.key = 'partner_admin'
on conflict do nothing;

insert into admin_role_permissions (role_id, permission_id)
select r.id, p.id from admin_roles r join permissions p on p.key = 'partners.manage'
where r.key in ('super_admin', 'marketing_admin')
on conflict do nothing;

-- 2. Table des partenaires --------------------------------------------
create table if not exists partners (
  id uuid primary key default uuid_generate_v4(),
  name text not null check (char_length(name) between 1 and 80),
  description text check (description is null or char_length(description) <= 300),
  logo_url text,
  website_url text check (website_url is null or website_url ~* '^https?://'),
  category text not null default 'sponsor'
    check (category in ('sponsor', 'payment', 'media', 'venue', 'tech', 'institution', 'other')),
  is_featured boolean not null default false,
  position integer not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partners_status_position_idx on partners (status, position);

alter table partners enable row level security;

create policy "Lecture des partenaires actifs" on partners
  for select using (status = 'active' or has_permission('partners.manage'));

create policy "Gestion des partenaires" on partners
  for all using (has_permission('partners.manage')) with check (has_permission('partners.manage'));

-- 3. Stockage : dossier `partner-logos/` réservé aux gestionnaires ------
-- Même règle qu'en 0043 (compte actif obligatoire) + le nouveau dossier.
drop policy if exists "Envoi de médias par les comptes connectés" on storage.objects;
create policy "Envoi de médias par les comptes connectés" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and public.current_user_is_active()
    and (
      (storage.foldername(name))[1] in ('event-covers', 'seating-plans', 'organizer-logos', 'avatars')
      or ((storage.foldername(name))[1] = 'home-slides' and is_admin())
      or ((storage.foldername(name))[1] = 'partner-logos' and has_permission('partners.manage'))
    )
  );
