-- ============================================================
-- TIKEO — Consultation du journal d'audit par les admins habilités
-- ============================================================
-- La table `audit_logs` existe depuis la migration 0001 et de nombreuses
-- actions y écrivent déjà (paiements, suspensions, changements de rôle,
-- demandes de modification d'événement...). Mais sa seule policy de lecture
-- ("Journal d'audit réservé à l'utilisateur concerné", 0001) limite chacun
-- à SES PROPRES entrées — utile pour rien côté supervision, puisqu'un admin
-- ne peut alors jamais voir les actions des AUTRES admins.
--
-- On ajoute donc une permission dédiée `audit.view` (sur le même modèle que
-- onboarding.manage / popups.manage, migration 0027) qui donne accès à
-- l'ensemble du journal, réservée par défaut au Super Admin — la policy
-- existante reste en place pour que chaque admin voie au moins ses propres
-- actions même sans cette permission.

insert into permissions (key, category, description) values
  ('audit.view', 'admin', 'Consulter le journal d''audit de toute la plateforme (actions de tous les administrateurs)')
on conflict (key) do nothing;

create policy "Journal d'audit consultable par les admins habilités" on audit_logs
  for select using (has_permission('audit.view'));
