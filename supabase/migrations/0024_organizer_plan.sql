-- ============================================================
-- TIKEO — Formule choisie par l'organisateur (tarifs)
-- ============================================================
-- Jusqu'ici, la page /organisateur/tarifs n'était qu'une vitrine : les
-- boutons "Devenir organisateur" de chaque formule renvoyaient tous vers le
-- même écran d'activation en un clic (/devenir-organisateur), sans jamais
-- enregistrer quelle formule la personne avait réellement choisie. On
-- ajoute donc une colonne `plan` sur `organizers`, renseignée par
-- /api/account/become-organizer au moment de la création de l'espace
-- organisateur (voir ce fichier), et affichée à l'organisateur
-- (paramètres) comme à l'administrateur (liste des organisateurs).
--
-- 'decouverte' reste la valeur par défaut pour les lignes déjà existantes :
-- elles ont été créées avant l'existence des formules, donc on ne peut pas
-- deviner ce qu'elles auraient choisi, mais 'decouverte' (formule gratuite,
-- la moins engageante) est le choix le plus sûr par défaut.
alter table organizers
  add column if not exists plan text not null default 'decouverte'
  check (plan in ('decouverte', 'essentiel', 'pro', 'business'));

comment on column organizers.plan is 'Formule tarifaire choisie sur /organisateur/tarifs au moment de la demande.';
