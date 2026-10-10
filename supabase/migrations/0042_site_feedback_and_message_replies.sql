-- ============================================================
-- TIKEO — Avis des visiteurs sur la plateforme + réponses aux messages de contact
-- ============================================================
-- 1. site_feedback : avis (note 1-5 + commentaire) laissés par n'importe quel
--    visiteur depuis la page publique /avis. L'insertion passe UNIQUEMENT par
--    le serveur (server/api/feedback.post.ts : CSRF, limite de débit,
--    honeypot, Turnstile) : aucune policy d'insertion côté client.
--    L'administration lit, publie, archive et répond. Seuls les avis publiés
--    (is_public) et consentis (allow_public) sont visibles du public, via la
--    vue site_feedback_public (qui n'expose NI l'email NI l'identifiant).
-- 2. contact_messages : réponse envoyée par l'administration depuis le pop-up
--    de /admin/messages (texte, date, auteur).
-- ============================================================

alter table contact_messages
  add column if not exists admin_reply text check (admin_reply is null or char_length(admin_reply) <= 5000),
  add column if not exists replied_at timestamptz,
  add column if not exists replied_by uuid references auth.users(id) on delete set null;

create table if not exists site_feedback (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 60),
  email text check (email is null or char_length(email) <= 254),
  rating smallint not null check (rating between 1 and 5),
  category text not null default 'praise' check (category in ('praise', 'idea', 'bug', 'other')),
  message text not null check (char_length(message) between 5 and 1000),
  allow_public boolean not null default false,
  status text not null default 'new' check (status in ('new', 'read', 'archived')),
  is_public boolean not null default false,
  admin_reply text check (admin_reply is null or char_length(admin_reply) <= 2000),
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists site_feedback_status_idx on site_feedback (status, created_at desc);
create index if not exists site_feedback_public_idx on site_feedback (is_public, created_at desc);

alter table site_feedback enable row level security;

create policy "Admin lit les avis du site" on site_feedback
  for select using (is_admin());
create policy "Admin met à jour les avis du site" on site_feedback
  for update using (is_admin());
create policy "Admin supprime les avis du site" on site_feedback
  for delete using (is_admin());

-- Vue publique : uniquement les avis publiés par l'administration et consentis.
-- (Une vue s'exécute avec les droits de son propriétaire : elle contourne la RLS
--  de la table, mais ne laisse sortir que ces colonnes et ces lignes.)
create or replace view site_feedback_public as
  select id, display_name, rating, category, message, admin_reply, replied_at, created_at
    from site_feedback
   where is_public = true and allow_public = true and status <> 'archived';

-- Statistiques agrégées (aucune donnée personnelle).
create or replace view site_feedback_stats as
  select count(*)::int as total,
         coalesce(round(avg(rating)::numeric, 1), 0) as average,
         count(*) filter (where rating = 1)::int as c1,
         count(*) filter (where rating = 2)::int as c2,
         count(*) filter (where rating = 3)::int as c3,
         count(*) filter (where rating = 4)::int as c4,
         count(*) filter (where rating = 5)::int as c5
    from site_feedback
   where status <> 'archived';

grant select on site_feedback_public to anon, authenticated;
grant select on site_feedback_stats to anon, authenticated;
