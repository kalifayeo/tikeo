-- ============================================================
-- TIKEO — Messages du formulaire de contact public (page /contact)
-- ============================================================
-- N'importe quel visiteur (connecté ou non) peut envoyer un message depuis
-- le formulaire public. Personne côté client ne doit pouvoir relire les
-- messages (ni les siens, ni ceux des autres) : seule l'administration y a
-- accès, via is_admin() défini dans 0004_admin_policies.sql.

create table contact_messages (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  email text not null,
  subject text not null,
  message text not null,
  status text not null default 'new' check (status in ('new', 'read', 'archived')),
  created_at timestamptz not null default now()
);

alter table contact_messages enable row level security;

create policy "Tout le monde peut envoyer un message" on contact_messages
  for insert with check (true);

create policy "Admin voit tous les messages de contact" on contact_messages
  for select using (is_admin());

create policy "Admin met à jour les messages de contact" on contact_messages
  for update using (is_admin());
