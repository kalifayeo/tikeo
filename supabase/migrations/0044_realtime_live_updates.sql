-- ============================================================
-- TIKEO — Mises à jour en direct (Supabase Realtime)
-- ============================================================
-- Permet au site d'afficher sans rechargement :
--   * les nouvelles notifications (pastille de la cloche du header),
--   * les favoris (pastille du cœur du header, synchro entre onglets).
-- À exécuter dans Supabase > SQL Editor. Sans risque : n'ajoute que les deux
-- tables à la publication temps réel ; les policies RLS existantes
-- continuent de limiter chaque utilisateur à ses propres lignes.
-- (Équivalent : Database > Replication > supabase_realtime > cocher les tables.)
-- ============================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
    ) then
      alter publication supabase_realtime add table public.notifications;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'favorites'
    ) then
      alter publication supabase_realtime add table public.favorites;
    end if;
  end if;
end $$;
