-- ============================================================
-- TIKEO — Policies RLS : revenus organisateur
-- ============================================================
-- Jusqu'ici, seules deux policies existaient sur orders/payments :
-- l'acheteur (propriétaire de la commande) et l'admin (migration 0004).
-- L'organisateur n'avait AUCUN moyen de lire les commandes/paiements de
-- ses propres événements, ce qui rendait la page /organisateur/revenus
-- impossible à construire (RLS bloquait tout, silencieusement).

-- ORDERS : l'organisateur voit les commandes passées sur ses événements
create policy "Organisateur voit les commandes de ses événements" on orders
  for select using (
    event_id in (
      select id from events where organizer_id in (
        select id from organizers where user_id = auth.uid()
      )
    )
  );

-- ORDER_ITEMS : visibles via la commande parente (donc via l'événement)
create policy "Organisateur voit les lignes de commande de ses événements" on order_items
  for select using (
    order_id in (
      select id from orders where event_id in (
        select id from events where organizer_id in (
          select id from organizers where user_id = auth.uid()
        )
      )
    )
  );

-- PAYMENTS : l'organisateur voit le statut des paiements de ses commandes
-- (nécessaire pour distinguer chiffre d'affaires encaissé vs en attente)
create policy "Organisateur voit les paiements de ses événements" on payments
  for select using (
    order_id in (
      select id from orders where event_id in (
        select id from events where organizer_id in (
          select id from organizers where user_id = auth.uid()
        )
      )
    )
  );
