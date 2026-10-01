-- ============================================================
-- TIKEO — Diagnostic : pourquoi tout s'affiche sous « Autres événements »
-- ============================================================
-- La page d'accueil crée UNE SECTION PAR CATÉGORIE. Un événement dont
-- `category_id` est vide n'appartient à aucune catégorie : il est alors
-- regroupé dans la section de repli « Autres événements ».
--
-- Si TOUS les événements sont dans cette section, c'est que leur
-- `category_id` est null. Exécute les requêtes ci-dessous dans l'ordre
-- pour identifier la cause, puis applique la réparation correspondante.
-- ============================================================


-- ÉTAPE 1 — La table des catégories est-elle remplie ?
-- Résultat attendu : 11 lignes (Concert, Festival, Conférence, ...).
-- Si 0 ligne  ->  exécute d'abord supabase/seed/seed.sql, puis reviens ici.
select count(*) as nb_categories from categories;
select name, slug, status from categories order by name;


-- ÉTAPE 2 — Combien d'événements n'ont AUCUNE catégorie ?
-- C'est le nombre de cartes qui atterrissent dans « Autres événements ».
select
  count(*) filter (where category_id is null) as sans_categorie,
  count(*) filter (where category_id is not null) as avec_categorie,
  count(*) as total
from events;


-- ÉTAPE 3 — Voir le détail, événement par événement.
select
  e.title,
  coalesce(c.name, '(aucune)') as categorie,
  e.status,
  e.start_date::date
from events e
left join categories c on c.id = e.category_id
order by e.start_date;


-- ============================================================
-- RÉPARATION (facultative)
-- ============================================================
-- Les catégories se modifient normalement depuis l'interface :
--   /organisateur/evenements  ->  ouvrir l'événement  ->  Modifier
--   ->  liste déroulante « Catégorie »  ->  Enregistrer
--
-- Les requêtes ci-dessous ne servent qu'à corriger plusieurs événements
-- d'un coup. Décommente (retire les « -- ») la ligne voulue avant de
-- l'exécuter, et adapte le titre / la catégorie.

-- Affecter une catégorie à UN événement précis, par son titre :
-- update events
-- set category_id = (select id from categories where slug = 'concert')
-- where title = 'TAYC EN CONCERT';

-- Affecter une catégorie à tous les événements dont le titre contient un mot
-- (ex. tout ce qui contient « concert » devient catégorie Concert) :
-- update events
-- set category_id = (select id from categories where slug = 'concert')
-- where category_id is null
--   and title ilike '%concert%';

-- Ranger tout ce qui reste sans catégorie dans « Autres », pour que plus
-- aucun événement ne soit orphelin :
-- update events
-- set category_id = (select id from categories where slug = 'autres')
-- where category_id is null;
