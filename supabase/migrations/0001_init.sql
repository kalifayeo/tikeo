-- ============================================================
-- TIKEO — Schéma initial (voir cahier des charges, section 27)
-- ============================================================

create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- ENUMS
-- ------------------------------------------------------------
create type user_role as enum ('visitor', 'buyer', 'organizer', 'agent', 'admin');
create type event_status as enum ('draft', 'published', 'paused', 'sold_out', 'completed', 'cancelled');
create type ticket_status as enum ('pending', 'valid', 'used', 'cancelled', 'refunded', 'expired');
create type order_status as enum ('pending', 'paid', 'failed', 'cancelled', 'refunded');
create type payment_status as enum ('pending', 'processing', 'success', 'failed', 'cancelled', 'refunded');
create type scan_result as enum ('valid', 'already_used', 'cancelled', 'invalid');

-- ------------------------------------------------------------
-- PROFILES
-- ------------------------------------------------------------
create table profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  email text not null,
  avatar_url text,
  role user_role not null default 'buyer',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- ORGANIZERS
-- ------------------------------------------------------------
create table organizers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  logo_url text,
  description text,
  phone text,
  email text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- CATEGORIES
-- ------------------------------------------------------------
create table categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  icon text,
  status text not null default 'active'
);

-- ------------------------------------------------------------
-- EVENTS
-- ------------------------------------------------------------
create table events (
  id uuid primary key default uuid_generate_v4(),
  organizer_id uuid not null references organizers(id) on delete cascade,
  title text not null,
  slug text not null unique,
  description text,
  cover_image text,
  category_id uuid references categories(id),
  start_date timestamptz not null,
  end_date timestamptz,
  location_name text,
  address text,
  city text,
  country text default 'Côte d''Ivoire',
  status event_status not null default 'draft',
  visibility text not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_status_idx on events(status);
create index events_city_idx on events(city);
create index events_start_date_idx on events(start_date);

-- ------------------------------------------------------------
-- TICKET TYPES
-- ------------------------------------------------------------
create table ticket_types (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  description text,
  price numeric(12,2) not null default 0,
  quantity integer not null default 0,
  sold_quantity integer not null default 0,
  sale_start timestamptz,
  sale_end timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sold_within_quantity check (sold_quantity <= quantity)
);

-- ------------------------------------------------------------
-- ORDERS
-- ------------------------------------------------------------
create table orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references events(id),
  order_number text not null unique,
  subtotal numeric(12,2) not null default 0,
  fees numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  currency text not null default 'XOF',
  status order_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  ticket_type_id uuid not null references ticket_types(id),
  quantity integer not null,
  unit_price numeric(12,2) not null,
  total numeric(12,2) not null
);

-- ------------------------------------------------------------
-- TICKETS
-- ------------------------------------------------------------
create table tickets (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  event_id uuid not null references events(id),
  ticket_type_id uuid not null references ticket_types(id),
  user_id uuid not null references auth.users(id),
  ticket_number text not null unique,
  qr_token text not null unique,
  status ticket_status not null default 'pending',
  used_at timestamptz,
  used_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index tickets_qr_token_idx on tickets(qr_token);

-- ------------------------------------------------------------
-- PAYMENTS
-- ------------------------------------------------------------
create table payments (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  provider text not null,
  transaction_reference text,
  amount numeric(12,2) not null,
  currency text not null default 'XOF',
  status payment_status not null default 'pending',
  metadata jsonb default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- EVENT AGENTS (contrôle d'accès)
-- ------------------------------------------------------------
create table event_agents (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- ------------------------------------------------------------
-- TICKET SCANS
-- ------------------------------------------------------------
create table ticket_scans (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid not null references tickets(id),
  event_id uuid not null references events(id),
  agent_id uuid not null references auth.users(id),
  result scan_result not null,
  scanned_at timestamptz not null default now(),
  device_id text
);

-- ------------------------------------------------------------
-- FAVORITES
-- ------------------------------------------------------------
create table favorites (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);

-- ------------------------------------------------------------
-- NOTIFICATIONS
-- ------------------------------------------------------------
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'info',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- AUDIT LOGS
-- ------------------------------------------------------------
create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  ip_address text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (section 29 du cahier des charges)
-- ============================================================

alter table profiles enable row level security;
alter table organizers enable row level security;
alter table events enable row level security;
alter table ticket_types enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table tickets enable row level security;
alter table payments enable row level security;
alter table event_agents enable row level security;
alter table ticket_scans enable row level security;
alter table favorites enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;

-- Profiles : chacun voit et modifie son propre profil
create policy "Profil visible par son propriétaire" on profiles
  for select using (auth.uid() = user_id);
create policy "Profil modifiable par son propriétaire" on profiles
  for update using (auth.uid() = user_id);
create policy "Création de son propre profil" on profiles
  for insert with check (auth.uid() = user_id);

-- Events : lecture publique des événements publiés, gestion réservée à l'organisateur propriétaire
create policy "Evénements publiés visibles de tous" on events
  for select using (status = 'published' or organizer_id in (
    select id from organizers where user_id = auth.uid()
  ));
create policy "Organisateur gère ses événements" on events
  for all using (organizer_id in (
    select id from organizers where user_id = auth.uid()
  ));

-- Organizers : visibles publiquement (profil public), modifiables par leur propriétaire
create policy "Organisateurs visibles de tous" on organizers
  for select using (true);
create policy "Organisateur modifie son propre espace" on organizers
  for update using (auth.uid() = user_id);
create policy "Création de son espace organisateur" on organizers
  for insert with check (auth.uid() = user_id);

-- Ticket types : lecture publique si événement publié, gestion par l'organisateur
create policy "Types de billets visibles si événement publié" on ticket_types
  for select using (event_id in (select id from events where status = 'published')
    or event_id in (select id from events where organizer_id in (
      select id from organizers where user_id = auth.uid()
    )));
create policy "Organisateur gère les types de billets" on ticket_types
  for all using (event_id in (select id from events where organizer_id in (
    select id from organizers where user_id = auth.uid()
  )));

-- Orders : un acheteur ne voit que ses propres commandes
create policy "Acheteur voit ses commandes" on orders
  for select using (auth.uid() = user_id);
create policy "Acheteur crée ses commandes" on orders
  for insert with check (auth.uid() = user_id);

-- Order items : visibles via la commande parente
create policy "Acheteur voit ses lignes de commande" on order_items
  for select using (order_id in (select id from orders where user_id = auth.uid()));

-- Tickets : l'acheteur voit ses billets ; un agent d'un événement peut consulter les billets liés
create policy "Acheteur voit ses billets" on tickets
  for select using (
    auth.uid() = user_id
    or event_id in (select event_id from event_agents where user_id = auth.uid())
    or event_id in (select id from events where organizer_id in (
      select id from organizers where user_id = auth.uid()
    ))
  );

-- Payments : visibles uniquement par le propriétaire de la commande (jamais par les agents)
create policy "Acheteur voit ses paiements" on payments
  for select using (order_id in (select id from orders where user_id = auth.uid()));

-- Event agents : organisateur gère ses agents ; l'agent voit ses propres accès
create policy "Organisateur gère ses agents" on event_agents
  for all using (event_id in (select id from events where organizer_id in (
    select id from organizers where user_id = auth.uid()
  )));
create policy "Agent voit ses propres accès" on event_agents
  for select using (auth.uid() = user_id);

-- Ticket scans : un agent peut valider les tickets de ses événements (jamais les paiements)
create policy "Agent scanne les tickets de ses événements" on ticket_scans
  for insert with check (event_id in (select event_id from event_agents where user_id = auth.uid()));
create policy "Organisateur consulte l'historique des scans" on ticket_scans
  for select using (event_id in (select id from events where organizer_id in (
    select id from organizers where user_id = auth.uid()
  )));

-- Favorites : strictement personnels
create policy "Favoris personnels" on favorites
  for all using (auth.uid() = user_id);

-- Notifications : strictement personnelles
create policy "Notifications personnelles" on notifications
  for all using (auth.uid() = user_id);

-- Audit logs : lecture réservée à l'administration (à affiner avec un rôle admin dédié)
create policy "Journal d'audit réservé à l'utilisateur concerné" on audit_logs
  for select using (auth.uid() = user_id);
