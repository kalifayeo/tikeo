-- 0038 — Suppression de l'historique côté acheteur + visite guidée de la barre du bas (mobile)
--
-- 1. Billets et commandes : « supprimer » côté acheteur = MASQUER.
--    On ne détruit jamais une ligne de commande ou de billet : l'organisateur,
--    l'admin, les statistiques de ventes, les revenus et le scan à l'entrée en
--    ont besoin. La colonne hidden_by_user_at fait simplement disparaître
--    la ligne des écrans de l'acheteur (Mes billets, Mes commandes, Tableau de bord).
--    L'écriture passe par POST /api/account/hide-items (clé service, identité
--    vérifiée par le jeton de session) : aucune policy d'écriture n'est ouverte.
alter table orders  add column if not exists hidden_by_user_at timestamptz;
alter table tickets add column if not exists hidden_by_user_at timestamptz;

-- 2. Visite guidée : on autorise aussi les boutons de la barre du bas mobile.
alter table tour_steps drop constraint if exists tour_steps_target_check;
alter table tour_steps add constraint tour_steps_target_check check (
  target in (
    'search', 'publish', 'pricing', 'community', 'notifications', 'favorites', 'account', 'theme', 'language',
    'nav-home', 'nav-explore', 'nav-scanner', 'nav-profile', 'nav-settings'
  )
);

-- 3. Étapes de départ pour la barre du bas (modifiables / supprimables depuis
--    /admin/introduction). Ignorées automatiquement sur ordinateur, où cette
--    barre n'existe pas. Sans doublon si la migration est rejouée.
insert into tour_steps (target, title, description, position)
select v.target, v.title, v.description, (select coalesce(max(position), 0) from tour_steps) + v.ord
from (values
  ('nav-home',     'Accueil',      'Revenez à la page d''accueil en un geste, où que vous soyez sur Tikeo.', 1),
  ('nav-explore',  'Explorer',     'Parcourez tous les événements et filtrez par ville, date ou catégorie.', 2),
  ('nav-scanner',  'Scanner',      'Organisateur ? Scannez les billets à l''entrée de votre événement.', 3),
  ('nav-profile',  'Votre profil', 'Retrouvez vos informations personnelles et votre photo.', 4),
  ('nav-settings', 'Paramètres',   'Langue, thème, notifications : réglez Tikeo à votre goût.', 5)
) as v(target, title, description, ord)
where not exists (select 1 from tour_steps t where t.target = v.target);
