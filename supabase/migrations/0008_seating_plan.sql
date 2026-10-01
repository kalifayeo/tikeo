-- Ajoute un champ optionnel "plan de salle" sur les événements (URL d'une
-- image ou d'un PDF), pour le bouton "Voir le plan de salle" affiché sur
-- l'onglet Tickets de la page événement (façon Tikerama). Rempli par
-- l'organisateur à la création/édition de l'événement, laissé vide sinon —
-- le bouton n'apparaît alors pas sur la page publique.
alter table events
  add column if not exists seating_plan_url text;
