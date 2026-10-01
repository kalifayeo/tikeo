-- ============================================================
-- TIKEO — Introduction (onboarding), visite guidée du header et pop-ups
-- ============================================================
-- Trois contenus pilotés depuis l'administration :
--   1. onboarding_slides : pages de présentation affichées à la toute
--      première visite sur un appareil (Suivant / Précédent / Passer / X).
--   2. tour_steps        : visite guidée qui met en lumière les boutons
--      importants du header, un par un, avec une courte explication.
--   3. popups            : fenêtre d'annonce (promo, info...) avec image,
--      bouton d'action, période de diffusion et fréquence d'affichage.
--
-- Lecture publique du contenu ACTIF uniquement ; écriture réservée aux
-- admins porteurs de la permission dédiée (RBAC, migration 0021) — le
-- Super Admin passe toujours via has_permission().

-- 1. Permissions et rôles précis ------------------------------------
insert into permissions (key, category, description) values
  ('onboarding.manage', 'marketing', 'Gérer l''introduction (pages de présentation) et la visite guidée du header'),
  ('popups.manage',     'marketing', 'Gérer les pop-ups d''annonce affichés aux visiteurs')
on conflict (key) do nothing;

insert into admin_roles (key, name, description, is_system) values
  ('onboarding_admin', 'Admin Onboarding', 'Gère l''introduction et la visite guidée du site.', false),
  ('popup_admin',      'Admin Pop-ups',    'Gère les pop-ups d''annonce du site.', false)
on conflict (key) do nothing;

insert into admin_role_permissions (role_id, permission_id)
select r.id, p.id from admin_roles r join permissions p on p.key = 'onboarding.manage' where r.key = 'onboarding_admin'
on conflict do nothing;

insert into admin_role_permissions (role_id, permission_id)
select r.id, p.id from admin_roles r join permissions p on p.key = 'popups.manage' where r.key = 'popup_admin'
on conflict do nothing;

-- Le Super Admin et l'Admin Marketing portent les deux nouvelles permissions.
insert into admin_role_permissions (role_id, permission_id)
select r.id, p.id from admin_roles r join permissions p on p.key in ('onboarding.manage', 'popups.manage')
where r.key in ('super_admin', 'marketing_admin')
on conflict do nothing;

-- 2. Pages d'introduction ------------------------------------------------
create table if not exists onboarding_slides (
  id uuid primary key default uuid_generate_v4(),
  title text not null check (char_length(title) between 1 and 120),
  description text check (description is null or char_length(description) <= 500),
  image_url text,
  emoji text check (emoji is null or char_length(emoji) <= 8),
  position integer not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists onboarding_slides_position_idx on onboarding_slides (position);

-- 3. Étapes de la visite guidée ------------------------------------------
-- `target` désigne un bouton du header (attribut data-tour côté interface).
-- La liste est volontairement fermée : on ne peut pas viser un élément
-- arbitraire, seulement ceux que le header expose.
create table if not exists tour_steps (
  id uuid primary key default uuid_generate_v4(),
  target text not null check (target in ('search', 'publish', 'pricing', 'community', 'notifications', 'favorites', 'account', 'theme', 'language')),
  title text not null check (char_length(title) between 1 and 80),
  description text check (description is null or char_length(description) <= 300),
  position integer not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tour_steps_position_idx on tour_steps (position);

-- 4. Pop-ups ---------------------------------------------------------------
create table if not exists popups (
  id uuid primary key default uuid_generate_v4(),
  title text not null check (char_length(title) between 1 and 120),
  message text check (message is null or char_length(message) <= 800),
  image_url text,
  cta_label text check (cta_label is null or char_length(cta_label) <= 40),
  cta_url text check (cta_url is null or char_length(cta_url) <= 500),
  -- once = une seule fois par appareil ; session = une fois par visite ; always = à chaque page d'accueil
  frequency text not null default 'once' check (frequency in ('once', 'session', 'always')),
  audience text not null default 'all' check (audience in ('all', 'visitors', 'members')),
  starts_at timestamptz,
  ends_at timestamptz,
  -- Incrémenté par l'admin (« Réafficher à tous ») pour que les appareils qui
  -- ont déjà fermé ce pop-up le revoient.
  revision integer not null default 1,
  status text not null default 'inactive' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

-- 5. RLS ---------------------------------------------------------------------
alter table onboarding_slides enable row level security;
alter table tour_steps enable row level security;
alter table popups enable row level security;

create policy "Lecture des pages d'introduction actives" on onboarding_slides
  for select using (status = 'active' or has_permission('onboarding.manage'));
create policy "Gestion des pages d'introduction" on onboarding_slides
  for all using (has_permission('onboarding.manage')) with check (has_permission('onboarding.manage'));

create policy "Lecture des étapes de visite actives" on tour_steps
  for select using (status = 'active' or has_permission('onboarding.manage'));
create policy "Gestion des étapes de visite" on tour_steps
  for all using (has_permission('onboarding.manage')) with check (has_permission('onboarding.manage'));

-- Le filtrage par dates est fait ici aussi : un pop-up expiré ou pas encore
-- ouvert n'est jamais renvoyé au public, même si le client est bricolé.
create policy "Lecture des pop-ups actifs dans leur période" on popups
  for select using (
    has_permission('popups.manage')
    or (status = 'active'
        and (starts_at is null or starts_at <= now())
        and (ends_at is null or ends_at > now()))
  );
create policy "Gestion des pop-ups" on popups
  for all using (has_permission('popups.manage')) with check (has_permission('popups.manage'));

-- 6. Contenu de départ (modifiable / supprimable depuis l'admin) ---------
insert into onboarding_slides (title, description, emoji, position) values
  ('Bienvenue sur Tikeo 🎉', 'Découvrez et réservez les meilleurs événements près de chez vous, en quelques secondes.', '🎟️', 1),
  ('Trouvez votre prochaine sortie', 'Concerts, soirées, conférences… Filtrez par ville, date ou catégorie et ajoutez vos coups de cœur aux favoris.', '🔎', 2),
  ('Payez simplement, entrez sans stress', 'Réglez par Mobile Money ou carte, puis recevez vos billets avec QR code par email et dans « Mes billets ».', '📲', 3),
  ('Organisez vos propres événements', 'Publiez un événement, vendez vos billets et suivez vos ventes en temps réel depuis votre espace organisateur.', '🚀', 4);

insert into tour_steps (target, title, description, position) values
  ('search', 'Recherchez un événement', 'Tapez un nom, une ville ou un artiste pour trouver rapidement ce que vous cherchez.', 1),
  ('publish', 'Publiez votre événement', 'Vous organisez quelque chose ? Créez votre événement et vendez vos billets en ligne.', 2),
  ('notifications', 'Vos notifications', 'Retrouvez ici les confirmations de commande et les nouveautés importantes.', 3),
  ('favorites', 'Vos favoris', 'Gardez sous la main les événements qui vous intéressent.', 4),
  ('account', 'Votre compte', 'Accédez à vos billets, votre portefeuille, vos événements et vos paramètres.', 5);
