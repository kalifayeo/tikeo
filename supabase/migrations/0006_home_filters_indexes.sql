-- ============================================================
-- TIKEO — Index de performance : filtres accueil + tableau de bord
-- ============================================================
-- Ajoutés suite au câblage des filtres de la page d'accueil (catégorie,
-- ville, favoris) et à l'enrichissement du tableau de bord organisateur
-- (revenus, commandes en attente). Ces colonnes sont désormais filtrées
-- ou jointes à chaque chargement de page ; sans index, Postgres devait
-- scanner l'intégralité de `events` / `orders` / `organizers`.

create index if not exists events_category_id_idx on events(category_id);
create index if not exists organizers_status_idx on organizers(status);
create index if not exists orders_event_id_idx on orders(event_id);
create index if not exists favorites_user_id_idx on favorites(user_id);
