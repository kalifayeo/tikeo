-- ============================================================
-- TIKEO — Liste d'attente pour les événements complets
-- ============================================================
-- Quand un événement affiche complet, un visiteur peut laisser son email
-- pour être prévenu si des billets se libèrent (annulation, réservation
-- expirée, capacité augmentée par l'organisateur). L'inscription se fait
-- uniquement via le serveur (server/api/waitlist/join.post.ts), avec les
-- mêmes protections anti-abus que le formulaire de contact (CSRF, limite de
-- débit, honeypot, Turnstile) : aucune policy d'insertion cliente n'est
-- donc nécessaire ici, à l'image de contact_messages (migration 0011).
--
-- La notification elle-même est déclenchée à la main par l'organisateur
-- (bouton "Prévenir la liste d'attente" une fois des places libérées),
-- plutôt qu'automatiquement à chaque billet libéré : cela évite de
-- bombarder d'emails la liste d'attente à chaque commande expirée, et
-- laisse l'organisateur décider du bon moment (ex. après avoir ajouté des
-- places). Voir server/api/events/[id]/notify-waitlist.post.ts.

create table waitlist_entries (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  quantity_wanted integer not null default 1 check (quantity_wanted between 1 and 10),
  status text not null default 'waiting' check (status in ('waiting', 'notified')),
  notified_at timestamptz,
  notified_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (event_id, email)
);
create index waitlist_entries_event_idx on waitlist_entries (event_id, status);

comment on table waitlist_entries is 'Liste d''attente par événement : un visiteur laisse son email pour être prévenu si des billets se libèrent. Écriture réservée au serveur (service_role) ; lecture réservée à l''organisateur de l''événement et à l''admin.';

alter table waitlist_entries enable row level security;

create policy "Organisateur voit la liste d'attente de ses événements" on waitlist_entries
  for select using (
    event_id in (select id from events where organizer_id in (select id from organizers where user_id = auth.uid()))
  );

create policy "Admin voit toutes les listes d'attente" on waitlist_entries
  for select using (is_admin());
