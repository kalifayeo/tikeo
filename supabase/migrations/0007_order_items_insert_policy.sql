-- La RLS était activée sur order_items sans aucune policy d'INSERT : la
-- création de commande depuis la page événement (pages/e/[slug].vue) était
-- donc systématiquement rejetée après l'insert réussi de la ligne `orders`.
-- On autorise l'acheteur à insérer des lignes rattachées à ses propres
-- commandes (même logique que la policy de lecture déjà en place).
create policy "Acheteur crée ses lignes de commande" on order_items
  for insert with check (
    order_id in (select id from orders where user_id = auth.uid())
  );
