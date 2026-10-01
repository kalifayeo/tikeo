-- ============================================================
-- TIKEO — Demandes de modification d'événements publiés
-- ============================================================
-- Besoin : un organisateur doit pouvoir modifier un événement déjà publié,
-- mais uniquement avec l'accord d'un administrateur (aucune page du cahier
-- des charges ne le permettait jusqu'ici : soit l'événement était en
-- brouillon et 100% libre, soit publié et alors totalement gelé côté
-- organisateur, sauf pause/republication).
--
-- Principe (cf. §64 du cahier des charges : "le frontend ne doit jamais
-- avoir la responsabilité de décider") :
--   - Événement en brouillon  -> l'organisateur modifie librement (comme
--     avant).
--   - Événement publié / en pause / complet / terminé / annulé -> toute
--     modification de contenu (titre, description, image, dates, lieu...)
--     passe par une ligne dans `event_edit_requests`, à l'état "pending".
--     Rien n'est appliqué à `events` tant qu'un admin n'a pas approuvé.
--   - L'admin (ou une future Edge Function avec la clé service_role) reste
--     libre de tout modifier directement : c'est lui qui applique le
--     contenu approuvé sur `events` / `ticket_types`.
-- Cette règle est appliquée par des triggers (pas seulement par l'UI), pour
-- qu'un appel direct à l'API Supabase ne puisse pas la contourner.

-- ------------------------------------------------------------
-- TABLE : event_edit_requests
-- ------------------------------------------------------------
create type event_edit_request_status as enum ('pending', 'approved', 'rejected', 'cancelled');

create table event_edit_requests (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events(id) on delete cascade,
  organizer_id uuid not null references organizers(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  status event_edit_request_status not null default 'pending',
  -- Snapshot des valeurs AVANT modification (pour affichage du "diff" côté admin)
  previous_snapshot jsonb not null default '{}'::jsonb,
  -- Valeurs proposées : { event: {...champs...}, ticket_types: [{ id, ...champs }] }
  changes jsonb not null default '{}'::jsonb,
  organizer_note text,
  admin_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index event_edit_requests_event_id_idx on event_edit_requests(event_id);
create index event_edit_requests_status_idx on event_edit_requests(status);
create index event_edit_requests_organizer_id_idx on event_edit_requests(organizer_id);

alter table event_edit_requests enable row level security;

-- L'organisateur voit ses propres demandes, l'admin les voit toutes
create policy "Organisateur voit ses demandes de modification" on event_edit_requests
  for select using (
    organizer_id in (select id from organizers where user_id = auth.uid())
    or is_admin()
  );

-- L'organisateur crée une demande pour un de ses propres événements
create policy "Organisateur crée une demande de modification" on event_edit_requests
  for insert with check (
    organizer_id in (select id from organizers where user_id = auth.uid())
    and requested_by = auth.uid()
  );

-- L'organisateur peut annuler sa propre demande tant qu'elle est en attente
create policy "Organisateur annule sa demande en attente" on event_edit_requests
  for update using (
    status = 'pending'
    and organizer_id in (select id from organizers where user_id = auth.uid())
  ) with check (
    status = 'cancelled'
    and organizer_id in (select id from organizers where user_id = auth.uid())
  );

-- L'admin approuve / rejette (et peut modifier librement)
create policy "Admin traite les demandes de modification" on event_edit_requests
  for update using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------
-- Notifications : élargir les policies pour permettre le va-et-vient
-- organisateur -> admin (nouvelle demande) et admin -> organisateur
-- (décision), sans quoi seule la policy "auth.uid() = user_id" existait
-- et personne ne pouvait notifier quelqu'un d'autre que soi-même.
-- ------------------------------------------------------------
create policy "Admin notifie n'importe quel utilisateur" on notifications
  for insert with check (is_admin());

create policy "Organisateur notifie les administrateurs" on notifications
  for insert with check (
    exists (select 1 from profiles p where p.user_id = notifications.user_id and p.role = 'admin')
  );

-- ------------------------------------------------------------
-- Journal d'audit : il n'existait jusqu'ici AUCUNE policy d'insertion
-- (uniquement une policy de lecture) — la table était donc inutilisable
-- en pratique. On l'ouvre à l'admin.
-- ------------------------------------------------------------
create policy "Admin écrit dans le journal d'audit" on audit_logs
  for insert with check (is_admin());

-- ============================================================
-- TRIGGERS : verrouiller la modification directe d'un événement publié
-- ============================================================

create or replace function enforce_event_content_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Toujours autorisé : admin, ou opération faite avec la clé service_role
  -- (utilisée par les futures Edge Functions, cf. §6 du cahier des charges).
  if auth.role() = 'service_role' or is_admin() then
    return new;
  end if;

  -- Événement encore en brouillon : l'organisateur garde une liberté totale.
  if old.status = 'draft' then
    return new;
  end if;

  -- Événement déjà publié (ou en pause / complet / terminé / annulé) :
  -- seul le champ "status" (mise en pause, republication, annulation...)
  -- peut encore être changé directement. Tout le reste doit passer par
  -- une demande de modification validée par un administrateur.
  if new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.cover_image is distinct from old.cover_image
     or new.seating_plan_url is distinct from old.seating_plan_url
     or new.category_id is distinct from old.category_id
     or new.start_date is distinct from old.start_date
     or new.end_date is distinct from old.end_date
     or new.location_name is distinct from old.location_name
     or new.address is distinct from old.address
     or new.city is distinct from old.city
     or new.country is distinct from old.country
     or new.slug is distinct from old.slug
  then
    raise exception 'MODIFICATION_REQUIRES_ADMIN_APPROVAL: cet événement est déjà publié — soumettez une demande de modification depuis l''espace organisateur.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_event_content_lock on events;
create trigger trg_enforce_event_content_lock
  before update on events
  for each row execute function enforce_event_content_lock();

-- Même principe pour les types de billets (prix, quantité, nom...) : une
-- fois l'événement publié, on ne bloque QUE la modification/suppression
-- d'un type existant (la création d'un nouveau type de billet reste libre,
-- c'est une opération additive qui ne trompe aucun acheteur déjà informé).
create or replace function enforce_ticket_type_content_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_status event_status;
begin
  if auth.role() = 'service_role' or is_admin() then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select status into parent_status from events where id = coalesce(new.event_id, old.event_id);

  if parent_status = 'draft' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'MODIFICATION_REQUIRES_ADMIN_APPROVAL: impossible de supprimer un type de billet d''un événement déjà publié.';
  end if;

  -- tg_op = 'UPDATE' : seule sold_quantity (mise à jour lors des ventes) et
  -- status peuvent encore bouger sans validation admin.
  if new.name is distinct from old.name
     or new.description is distinct from old.description
     or new.price is distinct from old.price
     or new.quantity is distinct from old.quantity
     or new.sale_start is distinct from old.sale_start
     or new.sale_end is distinct from old.sale_end
  then
    raise exception 'MODIFICATION_REQUIRES_ADMIN_APPROVAL: ce type de billet appartient à un événement déjà publié — soumettez une demande de modification.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_ticket_type_content_lock on ticket_types;
create trigger trg_enforce_ticket_type_content_lock
  before update or delete on ticket_types
  for each row execute function enforce_ticket_type_content_lock();

-- ------------------------------------------------------------
-- Policies events / ticket_types : remplacer les policies "for all" trop
-- larges par des policies dédiées par opération (le trigger ci-dessus gère
-- désormais la granularité fine ; on garde ici uniquement la propriété).
-- ------------------------------------------------------------
drop policy if exists "Organisateur gère ses événements" on events;

create policy "Organisateur crée ses événements" on events
  for insert with check (organizer_id in (select id from organizers where user_id = auth.uid()));

create policy "Organisateur met à jour ses événements" on events
  for update using (organizer_id in (select id from organizers where user_id = auth.uid()))
  with check (organizer_id in (select id from organizers where user_id = auth.uid()));

create policy "Organisateur supprime ses événements brouillons" on events
  for delete using (
    organizer_id in (select id from organizers where user_id = auth.uid())
    and status = 'draft'
  );

drop policy if exists "Organisateur gère les types de billets" on ticket_types;

create policy "Organisateur crée des types de billets" on ticket_types
  for insert with check (
    event_id in (select id from events where organizer_id in (
      select id from organizers where user_id = auth.uid()
    ))
  );

create policy "Organisateur met à jour ses types de billets" on ticket_types
  for update using (
    event_id in (select id from events where organizer_id in (
      select id from organizers where user_id = auth.uid()
    ))
  ) with check (
    event_id in (select id from events where organizer_id in (
      select id from organizers where user_id = auth.uid()
    ))
  );

create policy "Organisateur supprime ses types de billets" on ticket_types
  for delete using (
    event_id in (select id from events where organizer_id in (
      select id from organizers where user_id = auth.uid()
    ))
  );
