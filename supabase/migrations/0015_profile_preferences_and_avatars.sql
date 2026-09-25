-- ============================================================
-- TIKEO — Préférences de notifications + avatars utilisateurs
-- ============================================================
-- La page "Paramètres" de l'espace acheteur permet désormais de gérer de
-- vraies préférences (au lieu du seul thème/langue déjà en cookie) : on a
-- besoin de les persister quelque part de durable et lié au compte, donc
-- directement sur `profiles` plutôt qu'en cookie.

alter table profiles
  add column if not exists notify_email boolean not null default true,
  add column if not exists notify_sms boolean not null default true,
  add column if not exists notify_promotions boolean not null default false;

comment on column profiles.notify_email is 'Reçoit les emails transactionnels (confirmation de commande, billets, rappels).';
comment on column profiles.notify_sms is 'Reçoit les SMS transactionnels (confirmation de commande, rappels).';
comment on column profiles.notify_promotions is 'Accepte de recevoir des offres et actualités Tikeo (marketing).';

-- ------------------------------------------------------------
-- Dossier "avatars/" dans le bucket "media" (0014_media_storage.sql)
-- ------------------------------------------------------------
-- Jusqu'ici seuls event-covers, seating-plans et organizer-logos étaient
-- acceptés à l'envoi : la photo de profil (page Profil) en a besoin aussi.
-- Chaque compte connecté peut écrire dans avatars/ ; la policy de
-- modification/suppression existante (owner = auth.uid()) fait déjà le
-- nécessaire pour qu'on ne touche qu'à ses propres fichiers.

drop policy if exists "Envoi de médias par les comptes connectés" on storage.objects;

create policy "Envoi de médias par les comptes connectés" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (
      (storage.foldername(name))[1] in ('event-covers', 'seating-plans', 'organizer-logos', 'avatars')
      or ((storage.foldername(name))[1] = 'home-slides' and is_admin())
    )
  );
