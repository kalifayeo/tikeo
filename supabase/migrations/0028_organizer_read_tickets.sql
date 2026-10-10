-- ============================================================
-- TIKEO — L'organisateur peut lire les billets émis sur ses événements
-- ============================================================
-- Nécessaire à l'export CSV des participants (page statistiques). Jusqu'ici
-- seuls l'acheteur (0001) et l'admin (0010/0021) pouvaient lire `tickets`.
-- Lecture seule, limitée aux événements de l'organisateur connecté ; les
-- coordonnées des acheteurs (table profiles) restent, elles, inaccessibles.
create policy "Organisateur voit les billets de ses événements" on tickets
  for select using (
    event_id in (
      select id from events where organizer_id in (
        select id from organizers where user_id = auth.uid()
      )
    )
  );
