-- ============================================================
-- TIKEO — Vidéo de présentation gérée depuis /admin/accueil
-- ============================================================
-- Ajoute à la ligne unique `home_hero_content` le lien de la vidéo affichée par
-- le bouton « Voir la vidéo » (accueil + barre du haut). Lien YouTube, Vimeo
-- ou fichier .mp4 / .webm. Vide = valeur par défaut du site (variable
-- NUXT_PUBLIC_PRESENTATION_VIDEO_URL, sinon /videos/presentation.mp4).
-- Les policies existantes suffisent : lecture publique, modification admin.
-- À exécuter dans Supabase > SQL Editor.
-- ============================================================

alter table home_hero_content
  add column if not exists presentation_video_url text;
