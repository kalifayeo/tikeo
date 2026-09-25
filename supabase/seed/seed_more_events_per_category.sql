-- ============================================================
-- TIKEO — Seed de démonstration : PLUSIEURS événements par catégorie
-- ============================================================
-- La page d'accueil affiche une section par catégorie. Avec un seul
-- événement par catégorie (seed_all_categories_demo.sql), chaque section
-- ne contenait qu'une carte et le carrousel n'avait pas de sens.
--
-- Ce script ajoute 3 événements supplémentaires par catégorie (33 au
-- total), répartis sur plusieurs villes et plusieurs dates, CHACUN AVEC
-- SA PROPRE IMAGE (seed picsum unique) — contrairement à l'existant où
-- tous les événements retombaient sur /sample-event.jpg.
--
-- À exécuter dans le SQL Editor Supabase. Remplace l'email ci-dessous par
-- celui de ton compte : les événements seront rattachés à CET
-- organisateur, donc modifiables depuis /organisateur/evenements.
--
-- Le script est REJOUABLE : les slugs sont suffixés par un horodatage.
-- ============================================================
do $$
declare
  v_email text := 'kalifayeo11@gmail.com'; -- <-- adapte si besoin
  v_user_id uuid;
  v_org_id uuid;
  v_event_id uuid;
  v_suffix text;
  v_count int := 0;
  rec record;
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

  v_suffix := to_char(now(), 'MMDDHH24MISS');

  for rec in
    select * from (values
      -- cat_slug, titre, slug_base, description, img_seed, jours, lieu, quartier, ville, prix_std, prix_vip
      ('concert','Coupé-Décalé All Stars','coupe-decale-all-stars','Les figures majeures du coupé-décalé réunies sur une même scène pour une nuit non-stop.','concert-cd',12,'Parc des Sports','Treichville','Abidjan',12000,35000),
      ('concert','Soirée Acoustique Ivoire','soiree-acoustique-ivoire','Un format intimiste : voix, guitare et percussions, dans une salle à jauge réduite.','concert-acoustic',33,'Institut Français','Plateau','Abidjan',8000,20000),
      ('concert','Afrobeat Night Bouaké','afrobeat-night-bouake','La nouvelle scène afrobeat ouest-africaine débarque à Bouaké pour une soirée dansante.','concert-afrobeat',47,'Salle des Fêtes','Centre','Bouaké',7000,18000),

      ('festival','Festival Zouglou de Yopougon','festival-zouglou-yopougon','Deux jours de zouglou, de danse et de cuisine de rue au cœur de Yopougon.','festival-zouglou',18,'Place Ficgayo','Yopougon','Abidjan',5000,15000),
      ('festival','Festival des Masques de Man','festival-masques-man','Le grand rendez-vous des masques et danses traditionnelles de l''Ouest ivoirien.','festival-masques',54,'Place Centrale','Centre','Man',3000,10000),
      ('festival','San-Pédro Beach Festival','san-pedro-beach-festival','Trois jours de musique en bord de mer : DJ sets, concerts live et marché d''artisans.','festival-beach',68,'Plage de Monogaga','Monogaga','San-Pédro',15000,40000),

      ('conference','Sommet du Numérique Ivoirien','sommet-numerique-ivoirien','Décideurs, startups et investisseurs se réunissent autour de la transformation digitale.','conf-numerique',22,'Sofitel Hôtel Ivoire','Cocody','Abidjan',25000,75000),
      ('conference','Forum Agro-Business CI','forum-agro-business','Rencontres et tables rondes sur la modernisation des filières agricoles ivoiriennes.','conf-agro',40,'Palais des Congrès','Plateau','Abidjan',20000,60000),
      ('conference','Rencontres Santé Publique','rencontres-sante-publique','Professionnels de santé et chercheurs échangent sur les priorités sanitaires régionales.','conf-sante',59,'CHU de Treichville','Treichville','Abidjan',10000,30000),

      ('formation','Bootcamp Développement Web','bootcamp-dev-web','Cinq jours intensifs pour apprendre les bases du développement web moderne.','form-web',15,'Orange Digital Center','Marcory','Abidjan',50000,120000),
      ('formation','Atelier Marketing Digital','atelier-marketing-digital','Une journée pratique pour construire et mesurer une stratégie digitale efficace.','form-marketing',29,'Espace Coworking Jokkolabs','Cocody','Abidjan',30000,70000),
      ('formation','Formation Gestion Financière','formation-gestion-financiere','Piloter la trésorerie et la rentabilité d''une PME : outils et cas pratiques.','form-finance',44,'Chambre de Commerce','Plateau','Abidjan',40000,90000),

      ('sport','Marathon International d''Abidjan','marathon-abidjan','42 km à travers la ville, ouvert aux amateurs comme aux coureurs confirmés.','sport-marathon',26,'Boulevard Lagunaire','Plateau','Abidjan',5000,15000),
      ('sport','Tournoi de Maracana','tournoi-maracana','Le tournoi de quartier devenu incontournable, avec 32 équipes engagées.','sport-maracana',37,'Terrain Municipal','Abobo','Abidjan',2000,6000),
      ('sport','Open de Tennis de Korhogo','open-tennis-korhogo','Tournoi régional réunissant les meilleures raquettes du nord du pays.','sport-tennis',62,'Complexe Sportif','Centre','Korhogo',3000,9000),

      ('spectacle','Gala d''Humour Abidjanais','gala-humour-abidjanais','Une soirée avec les humoristes les plus en vue de la scène ivoirienne.','spec-humour',20,'Palais de la Culture','Treichville','Abidjan',10000,25000),
      ('spectacle','Cabaret Danse & Lumière','cabaret-danse-lumiere','Chorégraphies contemporaines et création lumière dans un décor immersif.','spec-cabaret',35,'Espace Latrille','Cocody','Abidjan',12000,30000),
      ('spectacle','Nuit du Conte Africain','nuit-du-conte-africain','Conteurs et musiciens revisitent les grands récits du patrimoine oral.','spec-conte',51,'Centre Culturel','Centre','Yamoussoukro',4000,12000),

      ('theatre','Les Sofas — Pièce Historique','les-sofas-piece','Une fresque théâtrale inspirée de l''histoire précoloniale ouest-africaine.','theatre-sofas',24,'Théâtre National','Plateau','Abidjan',6000,18000),
      ('theatre','Comédie : Voisins Voisines','comedie-voisins-voisines','Une comédie moderne sur la vie de cour, entre quiproquos et éclats de rire.','theatre-comedie',41,'Institut Français','Plateau','Abidjan',5000,15000),
      ('theatre','Monologue : La Traversée','monologue-la-traversee','Un seul-en-scène puissant sur l''exil et le retour au pays.','theatre-monologue',57,'Petit Théâtre','Cocody','Abidjan',7000,20000),

      ('networking','Afterwork des Entrepreneurs','afterwork-entrepreneurs','Rencontres informelles entre porteurs de projets, mentors et investisseurs.','netw-afterwork',10,'Rooftop Azalaï','Plateau','Abidjan',5000,15000),
      ('networking','Meetup Tech Abidjan','meetup-tech-abidjan','Talks courts et démos par la communauté tech locale, suivis d''un cocktail.','netw-tech',31,'Orange Digital Center','Marcory','Abidjan',0,10000),
      ('networking','Déjeuner Business Bouaké','dejeuner-business-bouake','Un déjeuner de mise en relation entre entreprises du centre du pays.','netw-dejeuner',49,'Hôtel Mon Afrik','Centre','Bouaké',15000,35000),

      ('culture','Exposition Art Contemporain','expo-art-contemporain','Une sélection d''artistes ivoiriens émergents, peinture et installations.','cult-expo',17,'Galerie Cécile Fakhoury','Cocody','Abidjan',2000,8000),
      ('culture','Journées du Patrimoine','journees-patrimoine','Visites guidées et ateliers autour des sites historiques de Grand-Bassam.','cult-patrimoine',38,'Quartier France','Grand-Bassam','Abidjan',1000,5000),
      ('culture','Semaine du Livre Ivoirien','semaine-livre-ivoirien','Rencontres d''auteurs, dédicaces et tables rondes littéraires.','cult-livre',64,'Bibliothèque Nationale','Plateau','Abidjan',1000,6000),

      ('religion','Convention Biblique Annuelle','convention-biblique','Trois jours d''enseignements, de prière et de communion fraternelle.','relig-convention',27,'Stade Félix Houphouët-Boigny','Plateau','Abidjan',0,5000),
      ('religion','Concert de Gospel','concert-gospel','Les grandes chorales gospel du pays réunies pour une soirée de louange.','relig-gospel',43,'Palais de la Culture','Treichville','Abidjan',3000,12000),
      ('religion','Pèlerinage de Yamoussoukro','pelerinage-yamoussoukro','Journée de recueillement et de célébration à la Basilique.','relig-pelerinage',66,'Basilique Notre-Dame de la Paix','Centre','Yamoussoukro',0,3000),

      ('autres','Foire Artisanale d''Abidjan','foire-artisanale','Artisans et créateurs présentent leurs pièces : textile, bois, bijoux.','autre-foire',14,'Parc des Expositions','Port-Bouët','Abidjan',1000,5000),
      ('autres','Salon du Mariage','salon-du-mariage','Prestataires, défilés et conseils pour organiser son mariage de A à Z.','autre-mariage',36,'Hôtel Tiama','Plateau','Abidjan',2000,10000),
      ('autres','Village Gastronomique','village-gastronomique','Cuisine de rue et chefs invités : un parcours de dégustation sur deux jours.','autre-gastro',55,'Parc de Bingerville','Bingerville','Abidjan',3000,12000)
    ) as s(cat_slug, titre, slug_base, descr, img_seed, jours, lieu, quartier, ville, prix_std, prix_vip)
  loop
    -- Si la catégorie n'existe pas (seed.sql non exécuté), on ignore la ligne
    -- plutôt que de faire échouer tout le script.
    if not exists (select 1 from categories where slug = rec.cat_slug) then
      raise notice 'Catégorie % absente, événement "%" ignoré', rec.cat_slug, rec.titre;
      continue;
    end if;

    insert into events (
      organizer_id, title, slug, description, cover_image, category_id,
      start_date, end_date, location_name, address, city, country, status
    )
    values (
      v_org_id,
      rec.titre,
      rec.slug_base || '-' || v_suffix,
      rec.descr,
      -- Image unique par événement (seed picsum distinct) : c'est ce qui
      -- évite d'avoir la même photo sur toutes les cartes du site.
      'https://picsum.photos/seed/tikeo-' || rec.img_seed || '/1200/800',
      (select id from categories where slug = rec.cat_slug),
      now() + (rec.jours || ' days')::interval,
      now() + (rec.jours || ' days')::interval + interval '5 hours',
      rec.lieu, rec.quartier, rec.ville, 'Côte d''Ivoire', 'published'
    )
    returning id into v_event_id;

    -- Billet standard (gratuit si prix_std = 0, ce qui permet de tester
    -- l'affichage des événements à entrée libre).
    insert into ticket_types (event_id, name, description, price, quantity)
    values (v_event_id, 'Standard', 'Accès général à l''événement.', rec.prix_std, 400);

    -- Billet VIP uniquement si son prix est supérieur au standard.
    if rec.prix_vip > rec.prix_std then
      insert into ticket_types (event_id, name, description, price, quantity)
      values (v_event_id, 'VIP', 'Accès privilégié, placement prioritaire.', rec.prix_vip, 60);
    end if;

    v_count := v_count + 1;
  end loop;

  raise notice 'Terminé : % événements créés pour l''organisateur %', v_count, v_org_id;
end $$;
