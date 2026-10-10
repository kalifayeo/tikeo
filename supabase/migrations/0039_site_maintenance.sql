-- ============================================================
-- TIKEO — Mode maintenance piloté depuis l'administration
-- ============================================================
-- Une seule ligne (id = 1) décrit l'état de maintenance du site :
--   enabled   : le site est-il fermé au public ?
--   kind      : 'planned' (maintenance programmée, prévue à l'avance) ou
--               'emergency' (intervention urgente suite à un incident)
--   title / message : textes affichés aux visiteurs (vides = textes par défaut)
--   ends_at   : retour estimé, INFORMATIF seulement (le site ne se rouvre pas
--               tout seul : c'est l'admin qui désactive la maintenance)
--
-- Lecture : publique (la page /maintenance et le garde serveur ont besoin de
-- savoir si le site est fermé, et la ligne ne contient rien de sensible).
-- Écriture : réservée aux admins porteurs de la permission `settings.manage`
-- (RBAC, migration 0021) — le Super Admin passe toujours via has_permission().
-- En pratique l'écriture se fait par POST /api/admin/maintenance (clé
-- service_role), mais la policy protège aussi un accès direct à l'API Supabase.
-- ============================================================

create table if not exists site_maintenance (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default false,
  kind text not null default 'planned' check (kind in ('planned', 'emergency')),
  title text check (title is null or char_length(title) <= 120),
  message text check (message is null or char_length(message) <= 600),
  ends_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into site_maintenance (id) values (1) on conflict (id) do nothing;

alter table site_maintenance enable row level security;

drop policy if exists "Tout le monde peut lire l'état de maintenance" on site_maintenance;
create policy "Tout le monde peut lire l'état de maintenance" on site_maintenance
  for select using (true);

drop policy if exists "Admin modifie l'état de maintenance" on site_maintenance;
create policy "Admin modifie l'état de maintenance" on site_maintenance
  for update using (has_permission('settings.manage')) with check (has_permission('settings.manage'));
