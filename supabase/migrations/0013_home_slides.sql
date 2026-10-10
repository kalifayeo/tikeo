-- ============================================================
-- TIKEO — Bannière d'accueil pilotée depuis l'admin (page /admin/accueil)
-- ============================================================
-- La section héro de l'accueil (grande image centrale + colonnes gauche et
-- droite) était figée en dur sur /sample-event.jpg dans HeroSection.vue.
-- On la rend éditable depuis l'admin :
--   1. `home_slides` : les images/gifs qui défilent, par zone
--      ('center' = grande bannière centrale, 'left'/'right' = colonnes
--      latérales sur desktop), avec leur ordre d'affichage.
--   2. `home_hero_content` : le texte affiché par-dessus la bannière
--      centrale (titre, sous-titre, bouton d'action), en ligne unique
--      (id fixé à 1) puisqu'il n'y a qu'un seul jeu de textes.
-- ============================================================

create table home_slides (
  id uuid primary key default uuid_generate_v4(),
  zone text not null check (zone in ('center', 'left', 'right')),
  media_url text not null,
  media_type text not null default 'image' check (media_type in ('image', 'gif')),
  position integer not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create index home_slides_zone_position_idx on home_slides (zone, position);

alter table home_slides enable row level security;

create policy "Tout le monde peut lire les slides actifs" on home_slides
  for select using (status = 'active' or is_admin());

create policy "Admin gère les slides de l'accueil" on home_slides
  for all using (is_admin()) with check (is_admin());

-- Ligne unique (id = 1) pour le texte de la bannière centrale.
create table home_hero_content (
  id smallint primary key default 1 check (id = 1),
  title text,
  subtitle text,
  cta_label text,
  cta_url text,
  updated_at timestamptz not null default now()
);

insert into home_hero_content (id) values (1);

alter table home_hero_content enable row level security;

create policy "Tout le monde peut lire le texte de la bannière" on home_hero_content
  for select using (true);

create policy "Admin modifie le texte de la bannière" on home_hero_content
  for update using (is_admin()) with check (is_admin());
