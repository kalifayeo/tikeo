-- ============================================================
-- TIKEO — Introduction : des icônes à la place des emojis
-- ============================================================
-- Les pages d'introduction affichent désormais une icône SVG (nom du
-- dictionnaire AppIcon.vue) au lieu d'un emoji. La colonne `emoji` est
-- conservée (anciennes données) mais n'est plus utilisée par l'interface.

alter table onboarding_slides
  add column if not exists icon text check (icon is null or char_length(icon) <= 32);

-- Contenu de départ de la migration 0027 : on retire les emojis.
update onboarding_slides set icon = 'ticket',   title = 'Bienvenue sur Tikeo'                         where icon is null and title = 'Bienvenue sur Tikeo 🎉';
update onboarding_slides set icon = 'search'                                                          where icon is null and title = 'Trouvez votre prochaine sortie';
update onboarding_slides set icon = 'phone'                                                           where icon is null and title = 'Payez simplement, entrez sans stress';
update onboarding_slides set icon = 'megaphone'                                                       where icon is null and title = 'Organisez vos propres événements';

-- Toute autre page existante reçoit l'icône par défaut ; l'emoji est vidé.
update onboarding_slides set icon = 'ticket' where icon is null;
update onboarding_slides set emoji = null    where emoji is not null;
