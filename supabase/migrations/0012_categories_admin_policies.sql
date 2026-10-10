-- ============================================================
-- TIKEO — Gestion des catégories par l'admin (page /admin/categories)
-- ============================================================
-- La table `categories` n'avait NI RLS activé NI colonne d'ordre :
--   1. Sans RLS, n'importe quel visiteur muni de la clé publique pouvait
--      déjà insérer/modifier/supprimer des catégories via l'API Supabase.
--      On corrige ça : lecture ouverte à tous (nécessaire pour que le site
--      public affiche les catégories), écriture réservée à l'admin.
--   2. Sans colonne d'ordre, les catégories n'avaient d'autre tri possible
--      que l'ordre alphabétique : on ajoute `position` pour que l'admin
--      choisisse l'ordre d'affichage des sections sur la page d'accueil.
-- ============================================================

alter table categories add column if not exists position integer not null default 0;

-- Ordre de départ cohérent avec seed.sql, pour ne pas casser l'existant.
update categories set position = t.rn
from (
  select id, row_number() over (order by name) as rn from categories
) as t
where categories.id = t.id and categories.position = 0;

alter table categories enable row level security;

create policy "Tout le monde peut lire les catégories" on categories
  for select using (true);

create policy "Admin gère les catégories" on categories
  for all using (is_admin()) with check (is_admin());
