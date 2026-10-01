-- ============================================================
-- TIKEO — Stockage des fichiers images (bucket Storage "media")
-- ============================================================
-- Jusqu'ici, toutes les images du site (affiche d'événement, plan de salle,
-- logo d'organisateur, bannière d'accueil) ne pouvaient être renseignées
-- que sous forme d'URL externe : impossible d'envoyer un fichier depuis son
-- ordinateur. On crée un bucket Storage public pour héberger ces fichiers
-- directement dans le projet Supabase.
--
-- Bucket public : les images doivent être lisibles sans authentification
-- (page d'accueil, pages d'événements, partages sur les réseaux sociaux).
-- Le contrôle porte donc sur l'ÉCRITURE, pas sur la lecture.
--
-- Convention de dossiers (premier segment du `name` de l'objet) :
--   event-covers/    affiches d'événements
--   seating-plans/   plans de salle
--   organizer-logos/ logos d'organisateurs
--   home-slides/     images et gifs de la bannière d'accueil (admin)
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  10485760, -- 10 Mo : large pour une affiche ou un gif, assez bas pour éviter les abus
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml', 'application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Lecture : ouverte à tous, comme n'importe quelle image d'un site public.
create policy "Lecture publique des médias" on storage.objects
  for select using (bucket_id = 'media');

-- Écriture : tout compte connecté peut envoyer un fichier. Les organisateurs
-- en ont besoin pour leurs événements ; le dossier `home-slides/` reste
-- réservé à l'admin puisqu'il alimente la page d'accueil du site.
create policy "Envoi de médias par les comptes connectés" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (
      (storage.foldername(name))[1] in ('event-covers', 'seating-plans', 'organizer-logos')
      or ((storage.foldername(name))[1] = 'home-slides' and is_admin())
    )
  );

-- Mise à jour / suppression : uniquement le compte qui a envoyé le fichier,
-- ou l'admin (ménage, modération).
create policy "Modification de ses propres médias" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (owner = auth.uid() or is_admin()))
  with check (bucket_id = 'media' and (owner = auth.uid() or is_admin()));

create policy "Suppression de ses propres médias" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (owner = auth.uid() or is_admin()));
