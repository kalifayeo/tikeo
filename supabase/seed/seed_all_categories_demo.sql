-- ============================================================
-- TIKEO — Seed de démonstration : UN événement par catégorie
-- (Concert, Festival, Conférence, Formation, Sport, Spectacle, Théâtre,
-- Networking, Culture, Religion, Autres), pour voir le rendu de chaque
-- catégorie sur le site et pouvoir les modifier ensuite depuis l'espace
-- organisateur.
--
-- À exécuter manuellement, une seule fois, dans le SQL Editor Supabase.
-- Remplace l'email ci-dessous par celui de ton compte avant de lancer :
-- les événements seront rattachés à CET organisateur, donc modifiables
-- depuis /organisateur/evenements avec ce compte.
--
-- Les images sont des photos de démonstration (picsum.photos, libres
-- d'usage) à remplacer par les vraies affiches quand tu voudras.
-- ============================================================
do $$
declare
  v_email text := 'kalifayeo11@gmail.com'; -- <-- adapte si besoin
  v_user_id uuid;
  v_org_id uuid;
  v_event_id uuid;
  v_suffix text;
begin
  select id into v_user_id from auth.users where email = v_email;
  if v_user_id is null then
    raise exception 'Aucun utilisateur trouvé pour %', v_email;
  end if;

  select id into v_org_id from organizers where user_id = v_user_id;
  if v_org_id is null then
    insert into organizers (user_id, name, slug, email, status)
    values (v_user_id, 'Tikeo Events', 'tikeo-events', v_email, 'approved')
    returning id into v_org_id;
  else
    update organizers set status = 'approved' where id = v_org_id;
  end if;

  -- Suffixe court pour garder des slugs uniques si le script est relancé.
  v_suffix := to_char(now(), 'MMDDHH24MISS');

  -- 1) Concert -------------------------------------------------
  insert into events (organizer_id, title, slug, description, cover_image, category_id, start_date, end_date, location_name, address, city, country, status)
  values (
    v_org_id, 'Nuit Zouglou — Concert live', 'nuit-zouglou-concert-' || v_suffix,
    'Une soirée live avec les grandes voix du zouglou ivoirien. Ambiance garantie, scène ouverte et invités surprises.',
    'https://picsum.photos/seed/tikeo-concert/1200/800',
    (select id from categories where slug = 'concert'),
    now() + interval '25 days', now() + interval '25 days' + interval '4 hours',
    'Palais de la Culture', 'Treichville', 'Abidjan', 'Côte d''Ivoire', 'published'
  ) returning id into v_event_id;
  insert into ticket_types (event_id, name, description, price, quantity) values
    (v_event_id, 'Standard', 'Accès général, places debout.', 10000, 500),
    (v_event_id, 'VIP', 'Places assises + accès backstage.', 30000, 80);

  -- 2) Festival --------------------------------------------------
  insert into events (organizer_id, title, slug, description, cover_image, category_id, start_date, end_date, location_name, address, city, country, status)
  values (
    v_org_id, 'Festival des Arts d''Abidjan', 'festival-arts-abidjan-' || v_suffix,
    'Trois jours de musique, arts visuels et gastronomie locale, réunissant artistes ivoiriens et internationaux.',
    'https://picsum.photos/seed/tikeo-festival/1200/800',
    (select id from categories where slug = 'festival'),
    now() + interval '40 days', now() + interval '43 days',
    'Parc des Expositions', 'Zone 4', 'Abidjan', 'Côte d''Ivoire', 'published'
  ) returning id into v_event_id;
  insert into ticket_types (event_id, name, description, price, quantity) values
    (v_event_id, 'Pass 1 jour', 'Accès à toutes les scènes pour une journée.', 7500, 1000),
    (v_event_id, 'Pass 3 jours', 'Accès complet aux 3 jours du festival.', 18000, 400);

  -- 3) Conférence --------------------------------------------------
  insert into events (organizer_id, title, slug, description, cover_image, category_id, start_date, end_date, location_name, address, city, country, status)
  values (
    v_org_id, 'Conférence Tech Abidjan 2026', 'conference-tech-abidjan-' || v_suffix,
    'La conférence de référence sur l''innovation technologique en Côte d''Ivoire : IA, fintech, startups.',
    'https://picsum.photos/seed/tikeo-conference/1200/800',
    (select id from categories where slug = 'conference'),
    now() + interval '18 days', now() + interval '18 days' + interval '8 hours',
    'Sofitel Hôtel Ivoire', 'Cocody', 'Abidjan', 'Côte d''Ivoire', 'published'
  ) returning id into v_event_id;
  insert into ticket_types (event_id, name, description, price, quantity) values
    (v_event_id, 'Standard', 'Accès aux conférences et ateliers.', 15000, 300),
    (v_event_id, 'Étudiant', 'Tarif réduit sur présentation de la carte étudiante.', 5000, 100);

  -- 4) Formation --------------------------------------------------
  insert into events (organizer_id, title, slug, description, cover_image, category_id, start_date, end_date, location_name, address, city, country, status)
  values (
    v_org_id, 'Formation : Réussir son business en ligne', 'formation-business-en-ligne-' || v_suffix,
    'Une journée intensive pour apprendre à lancer et développer une activité en ligne rentable.',
    'https://picsum.photos/seed/tikeo-formation/1200/800',
    (select id from categories where slug = 'formation'),
    now() + interval '12 days', now() + interval '12 days' + interval '6 hours',
    'Espace Latrille Business Center', 'Cocody', 'Abidjan', 'Côte d''Ivoire', 'published'
  ) returning id into v_event_id;
  insert into ticket_types (event_id, name, description, price, quantity) values
    (v_event_id, 'Standard', 'Accès à la formation + support de cours.', 12000, 60);

  -- 5) Sport --------------------------------------------------
  insert into events (organizer_id, title, slug, description, cover_image, category_id, start_date, end_date, location_name, address, city, country, status)
  values (
    v_org_id, 'Marathon Solidaire d''Abidjan', 'marathon-solidaire-abidjan-' || v_suffix,
    'Course de 5, 10 et 21 km au profit d''associations locales. Ouvert à tous les niveaux.',
    'https://picsum.photos/seed/tikeo-sport/1200/800',
    (select id from categories where slug = 'sport'),
    now() + interval '35 days', now() + interval '35 days' + interval '5 hours',
    'Boulevard de la Corniche', 'Cocody', 'Abidjan', 'Côte d''Ivoire', 'published'
  ) returning id into v_event_id;
  insert into ticket_types (event_id, name, description, price, quantity) values
    (v_event_id, 'Inscription 5 km', 'Dossard + t-shirt + ravitaillement.', 5000, 800),
    (v_event_id, 'Inscription 21 km', 'Dossard + t-shirt + ravitaillement + médaille finisher.', 10000, 300);

  -- 6) Spectacle --------------------------------------------------
  insert into events (organizer_id, title, slug, description, cover_image, category_id, start_date, end_date, location_name, address, city, country, status)
  values (
    v_org_id, 'Gala d''Humour — Spécial Fin d''Année', 'gala-humour-fin-annee-' || v_suffix,
    'Une soirée 100% rire avec les meilleurs humoristes ivoiriens et invités de la sous-région.',
    'https://picsum.photos/seed/tikeo-spectacle/1200/800',
    (select id from categories where slug = 'spectacle'),
    now() + interval '50 days', now() + interval '50 days' + interval '3 hours',
    'Canal Olympia', 'Vridi', 'Abidjan', 'Côte d''Ivoire', 'published'
  ) returning id into v_event_id;
  insert into ticket_types (event_id, name, description, price, quantity) values
    (v_event_id, 'Standard', 'Placement libre.', 8000, 400),
    (v_event_id, 'VIP', 'Premiers rangs + cocktail.', 20000, 60);

  -- 7) Théâtre --------------------------------------------------
  insert into events (organizer_id, title, slug, description, cover_image, category_id, start_date, end_date, location_name, address, city, country, status)
  values (
    v_org_id, 'Pièce de théâtre : « Le Procès du Silence »', 'piece-theatre-proces-du-silence-' || v_suffix,
    'Une pièce engagée sur la mémoire et la justice, mise en scène par une troupe ivoirienne primée.',
    'https://picsum.photos/seed/tikeo-theatre/1200/800',
    (select id from categories where slug = 'theatre'),
    now() + interval '22 days', now() + interval '22 days' + interval '2 hours',
    'Institut Français de Côte d''Ivoire', 'Plateau', 'Abidjan', 'Côte d''Ivoire', 'published'
  ) returning id into v_event_id;
  insert into ticket_types (event_id, name, description, price, quantity) values
    (v_event_id, 'Standard', 'Placement libre.', 5000, 200);

  -- 8) Networking --------------------------------------------------
  insert into events (organizer_id, title, slug, description, cover_image, category_id, start_date, end_date, location_name, address, city, country, status)
  values (
    v_org_id, 'Afterwork Entrepreneurs d''Abidjan', 'afterwork-entrepreneurs-abidjan-' || v_suffix,
    'Rencontre mensuelle entre entrepreneurs, investisseurs et porteurs de projets, dans une ambiance décontractée.',
    'https://picsum.photos/seed/tikeo-networking/1200/800',
    (select id from categories where slug = 'networking'),
    now() + interval '9 days', now() + interval '9 days' + interval '3 hours',
    'Rooftop La Kora', 'Plateau', 'Abidjan', 'Côte d''Ivoire', 'published'
  ) returning id into v_event_id;
  insert into ticket_types (event_id, name, description, price, quantity) values
    (v_event_id, 'Entrée', 'Accès + un cocktail offert.', 3000, 150);

  -- 9) Culture --------------------------------------------------
  insert into events (organizer_id, title, slug, description, cover_image, category_id, start_date, end_date, location_name, address, city, country, status)
  values (
    v_org_id, 'Exposition : Trésors du Patrimoine Ivoirien', 'exposition-tresors-patrimoine-ivoirien-' || v_suffix,
    'Une exposition itinérante retraçant l''histoire et l''artisanat des peuples de Côte d''Ivoire.',
    'https://picsum.photos/seed/tikeo-culture/1200/800',
    (select id from categories where slug = 'culture'),
    now() + interval '15 days', now() + interval '30 days',
    'Musée des Civilisations', 'Plateau', 'Abidjan', 'Côte d''Ivoire', 'published'
  ) returning id into v_event_id;
  insert into ticket_types (event_id, name, description, price, quantity) values
    (v_event_id, 'Entrée', 'Accès à l''exposition (valable toute la durée).', 2000, 1000);

  -- 10) Religion --------------------------------------------------
  insert into events (organizer_id, title, slug, description, cover_image, category_id, start_date, end_date, location_name, address, city, country, status)
  values (
    v_org_id, 'Nuit de Louange et d''Action de Grâce', 'nuit-de-louange-' || v_suffix,
    'Une soirée de louange, de prière et de témoignages ouverte à tous, avec plusieurs chorales invitées.',
    'https://picsum.photos/seed/tikeo-religion/1200/800',
    (select id from categories where slug = 'religion'),
    now() + interval '20 days', now() + interval '20 days' + interval '4 hours',
    'Basilique Notre-Dame de la Paix', 'Yamoussoukro', 'Yamoussoukro', 'Côte d''Ivoire', 'published'
  ) returning id into v_event_id;
  insert into ticket_types (event_id, name, description, price, quantity) values
    (v_event_id, 'Entrée libre', 'Participation gratuite, dons libres sur place.', 0, 2000);

  -- 11) Autres --------------------------------------------------
  insert into events (organizer_id, title, slug, description, cover_image, category_id, start_date, end_date, location_name, address, city, country, status)
  values (
    v_org_id, 'Salon de l''Auto-Entrepreneuriat', 'salon-auto-entrepreneuriat-' || v_suffix,
    'Salon dédié aux petites entreprises et auto-entrepreneurs : stands, conférences et rencontres B2B.',
    'https://picsum.photos/seed/tikeo-autres/1200/800',
    (select id from categories where slug = 'autres'),
    now() + interval '28 days', now() + interval '29 days',
    'Palais des Congrès', 'Plateau', 'Abidjan', 'Côte d''Ivoire', 'published'
  ) returning id into v_event_id;
  insert into ticket_types (event_id, name, description, price, quantity) values
    (v_event_id, 'Visiteur', 'Accès au salon.', 1000, 1500),
    (v_event_id, 'Exposant', 'Stand + badge exposant + accès conférences.', 25000, 100);

  raise notice 'Terminé : 11 événements créés (un par catégorie) pour l''organisateur %', v_org_id;
end $$;
