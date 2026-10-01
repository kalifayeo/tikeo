-- ============================================================
-- TIKEO — Seed de démonstration : événements réels pour un compte
-- admin/organisateur existant (à exécuter une seule fois, manuellement,
-- dans le SQL Editor Supabase).
--
-- Remplace l'email ci-dessous par celui de ton compte avant de lancer.
-- ============================================================
do $$
declare
  v_email text := 'kalifayeo11@gmail.com'; -- <-- adapte si besoin
  v_user_id uuid;
  v_org_id uuid;
  v_cat_concert uuid;
  v_cat_festival uuid;
  v_cat_conference uuid;
  v_event_id uuid;
begin
  select id into v_user_id from auth.users where email = v_email;
  if v_user_id is null then
    raise exception 'Aucun utilisateur trouvé pour %', v_email;
  end if;

  -- Espace organisateur : on réutilise l'existant, ou on le crée, et on
  -- l'approuve directement (sinon les événements ne pourraient pas être
  -- publiés, cf. contrôle ajouté dans pages/organisateur/evenements/nouveau.vue).
  select id into v_org_id from organizers where user_id = v_user_id;
  if v_org_id is null then
    insert into organizers (user_id, name, slug, email, status)
    values (v_user_id, 'Tikeo Events', 'tikeo-events', v_email, 'approved')
    returning id into v_org_id;
  else
    update organizers set status = 'approved' where id = v_org_id;
  end if;

  select id into v_cat_concert from categories where slug = 'concert';
  select id into v_cat_festival from categories where slug = 'festival';
  select id into v_cat_conference from categories where slug = 'conference';

  -- 1) Concert HIMRA
  insert into events (organizer_id, title, slug, description, cover_image, category_id, start_date, city, country, status)
  values (v_org_id, 'Concert HIMRA — Stade Ebimpé', 'concert-himra-stade-ebimpe-' || substr(v_org_id::text, 1, 6),
          'Le concert événement de l''année à Abidjan.', '/sample-event.jpg', v_cat_concert, '2026-09-20 20:00:00+00', 'Abidjan', 'Côte d''Ivoire', 'published')
  returning id into v_event_id;
  insert into ticket_types (event_id, name, price, quantity) values
    (v_event_id, 'Standard', 20000, 500),
    (v_event_id, 'VIP', 50000, 100);

  -- 2) Singuila en concert
  insert into events (organizer_id, title, slug, description, cover_image, category_id, start_date, city, country, status)
  values (v_org_id, 'Singuila en concert', 'singuila-en-concert-' || substr(v_org_id::text, 1, 6),
          'Une soirée acoustique et RnB avec Singuila.', '/sample-event.jpg', v_cat_concert, '2026-11-08 20:00:00+00', 'Abidjan', 'Côte d''Ivoire', 'published')
  returning id into v_event_id;
  insert into ticket_types (event_id, name, price, quantity) values (v_event_id, 'Standard', 25000, 300);

  -- 3) Kiff No Beat en concert
  insert into events (organizer_id, title, slug, description, cover_image, category_id, start_date, city, country, status)
  values (v_org_id, 'Kiff No Beat en concert', 'kiff-no-beat-en-concert-' || substr(v_org_id::text, 1, 6),
          'Le groupe ivoirien en showcase live.', '/sample-event.jpg', v_cat_concert, '2026-11-28 20:00:00+00', 'Abidjan', 'Côte d''Ivoire', 'published')
  returning id into v_event_id;
  insert into ticket_types (event_id, name, price, quantity) values (v_event_id, 'Standard', 10000, 800);

  -- 4) Tayc en concert
  insert into events (organizer_id, title, slug, description, cover_image, category_id, start_date, city, country, status)
  values (v_org_id, 'Tayc en concert', 'tayc-en-concert-' || substr(v_org_id::text, 1, 6),
          'Tayc en showcase à Abidjan.', '/sample-event.jpg', v_cat_concert, '2026-10-11 20:00:00+00', 'Abidjan', 'Côte d''Ivoire', 'published')
  returning id into v_event_id;
  insert into ticket_types (event_id, name, price, quantity) values (v_event_id, 'Standard', 10000, 600);

  -- 5) Festival des Arts d'Abidjan
  insert into events (organizer_id, title, slug, description, cover_image, category_id, start_date, city, country, status)
  values (v_org_id, 'Festival des Arts d''Abidjan', 'festival-des-arts-abidjan-' || substr(v_org_id::text, 1, 6),
          'Trois jours de culture, musique et arts visuels.', '/sample-event.jpg', v_cat_festival, '2026-09-20 10:00:00+00', 'Abidjan', 'Côte d''Ivoire', 'published')
  returning id into v_event_id;
  insert into ticket_types (event_id, name, price, quantity) values (v_event_id, 'Pass 1 jour', 7500, 1000);

  -- 6) Conférence Tech Abidjan
  insert into events (organizer_id, title, slug, description, cover_image, category_id, start_date, city, country, status)
  values (v_org_id, 'Conférence Tech Abidjan', 'conference-tech-abidjan-' || substr(v_org_id::text, 1, 6),
          'La conférence tech de référence en Côte d''Ivoire.', '/sample-event.jpg', v_cat_conference, '2026-09-25 09:00:00+00', 'Abidjan', 'Côte d''Ivoire', 'published')
  returning id into v_event_id;
  insert into ticket_types (event_id, name, price, quantity) values (v_event_id, 'Standard', 7750, 400);

  raise notice 'Terminé : événements créés pour l''organisateur %', v_org_id;
end $$;
