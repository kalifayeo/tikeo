-- ============================================================
-- TIKEO — Stockage : refuser les SVG
-- ============================================================
-- Un fichier SVG peut embarquer du JavaScript. Le bucket « media » étant
-- public, un SVG malveillant envoyé par un compte connecté serait servi tel
-- quel. Les affiches, logos et bannières n'ont pas besoin de SVG : on retire ce
-- type MIME (l'interface d'envoi l'a déjà retiré, voir composables/useMediaUpload.ts).
-- ============================================================
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'application/pdf']
 where id = 'media';
