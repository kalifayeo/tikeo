-- ============================================================
-- TIKEO — Attribuer une image distincte aux événements qui n'en ont pas
-- ============================================================
-- Quand `events.cover_image` est vide, le front retombe sur
-- /sample-event.jpg : TOUS les événements concernés affichent donc la
-- même photo (c'est ce qu'on voyait sur la page d'accueil et sur
-- « Mes favoris »).
--
-- Ce script ne touche QUE les événements sans image (cover_image null ou
-- vide) et leur attribue une photo de démonstration unique, dérivée de
-- leur id : deux événements ne peuvent pas tomber sur la même image, et
-- relancer le script ne change pas les images déjà attribuées.
--
-- Les événements qui ont déjà une vraie affiche ne sont pas modifiés.
-- ============================================================
update events
set cover_image = 'https://picsum.photos/seed/tikeo-' || replace(id::text, '-', '') || '/1200/800'
where cover_image is null
   or trim(cover_image) = '';

-- Vérification : liste ce qui reste sans image (devrait être vide).
select count(*) as evenements_sans_image
from events
where cover_image is null or trim(cover_image) = '';
