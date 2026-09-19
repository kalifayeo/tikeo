-- ============================================================
-- TIKEO — Authentification maison (remplace Supabase Auth)
-- ============================================================
-- On ne dépend plus de auth.users : l'app gère elle-même les comptes,
-- les mots de passe et les codes OTP (envoyés via Brevo).
-- Les écritures se font uniquement côté serveur avec la clé service_role
-- (RLS activé, aucune policy publique sur users/otp_codes).

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- USERS
-- ------------------------------------------------------------
create table users (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  phone text,
  password_hash text,                 -- null si le compte n'utilise que l'OTP
  email_verified boolean not null default false,
  status text not null default 'active', -- active | suspended
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_email_idx on users (lower(email));

alter table users enable row level security;
-- Aucune policy : accès exclusivement via la clé service_role côté serveur.

-- ------------------------------------------------------------
-- OTP CODES
-- ------------------------------------------------------------
create type otp_purpose as enum ('signup', 'login', 'reset_password');

create table otp_codes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  email text not null,
  purpose otp_purpose not null,
  code_hash text not null,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index otp_codes_email_purpose_idx on otp_codes (lower(email), purpose, consumed_at);

alter table otp_codes enable row level security;
-- Aucune policy : accès exclusivement via la clé service_role côté serveur.

-- ------------------------------------------------------------
-- BASCULE DES CLÉS ÉTRANGÈRES : auth.users -> public.users
-- ------------------------------------------------------------
alter table profiles drop constraint if exists profiles_user_id_fkey;
alter table profiles add constraint profiles_user_id_fkey
  foreign key (user_id) references users(id) on delete cascade;

alter table organizers drop constraint if exists organizers_user_id_fkey;
alter table organizers add constraint organizers_user_id_fkey
  foreign key (user_id) references users(id) on delete cascade;

alter table orders drop constraint if exists orders_user_id_fkey;
alter table orders add constraint orders_user_id_fkey
  foreign key (user_id) references users(id) on delete cascade;

alter table tickets drop constraint if exists tickets_user_id_fkey;
alter table tickets add constraint tickets_user_id_fkey
  foreign key (user_id) references users(id);

alter table tickets drop constraint if exists tickets_used_by_fkey;
alter table tickets add constraint tickets_used_by_fkey
  foreign key (used_by) references users(id);
