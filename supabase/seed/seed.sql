-- Catégories de base (cahier des charges, section 34)
insert into categories (name, slug, icon) values
  ('Concert', 'concert', 'music'),
  ('Festival', 'festival', 'sparkles'),
  ('Conférence', 'conference', 'presentation'),
  ('Formation', 'formation', 'graduation-cap'),
  ('Sport', 'sport', 'trophy'),
  ('Spectacle', 'spectacle', 'theater-masks'),
  ('Théâtre', 'theatre', 'drama'),
  ('Networking', 'networking', 'users'),
  ('Culture', 'culture', 'landmark'),
  ('Religion', 'religion', 'church'),
  ('Autres', 'autres', 'grid')
on conflict (slug) do nothing;
