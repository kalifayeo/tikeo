-- ============================================================
-- TIKEO — Policies RLS pour le rôle admin (cahier des charges §29, §41-44)
-- ============================================================
-- Jusqu'ici, seuls les organisateurs et acheteurs avaient des policies sur
-- leurs propres données. L'administration a besoin d'un accès global en
-- lecture (et en modification de statut) sur les événements, organisateurs
-- et utilisateurs, sans jamais exposer la clé service_role au client.

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- PROFILES : l'admin voit et modifie tous les profils (suspension, rôle...)
create policy "Admin voit tous les profils" on profiles
  for select using (is_admin());
create policy "Admin modifie tous les profils" on profiles
  for update using (is_admin());

-- ORGANIZERS : l'admin approuve/suspend les organisateurs
create policy "Admin gère tous les organisateurs" on organizers
  for all using (is_admin());

-- EVENTS : l'admin voit et modère tous les événements (publier/masquer/supprimer)
create policy "Admin gère tous les événements" on events
  for all using (is_admin());

-- TICKET_TYPES : nécessaire pour afficher/gérer la billetterie depuis l'admin
create policy "Admin gère tous les types de billets" on ticket_types
  for all using (is_admin());

-- ORDERS / PAYMENTS : lecture globale pour les statistiques et remboursements
create policy "Admin voit toutes les commandes" on orders
  for select using (is_admin());
create policy "Admin voit tous les paiements" on payments
  for select using (is_admin());
