-- ============================================================
-- TIKEO — Accès admin en lecture sur les billets (page /admin/billets)
-- ============================================================
-- 0004_admin_policies.sql donnait déjà à l'admin un accès global sur
-- profiles, organizers, events, ticket_types, orders et payments, mais la
-- table `tickets` avait été oubliée : l'admin ne pouvait donc pas lister les
-- billets émis sur la plateforme. On complète ici avec la même fonction
-- `is_admin()` déjà en place.

create policy "Admin voit tous les billets" on tickets
  for select using (is_admin());
