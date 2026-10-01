-- ============================================================
-- TIKEO — Suppression de compte réelle (et non plus un simple message)
-- ============================================================
-- Avant cette migration, "Supprimer mon compte" (pages/mon-espace/parametres)
-- insérait un contact_messages ordinaire : l'administration ne pouvait que
-- répondre par email ou archiver, le compte n'était jamais réellement
-- supprimé. On corrige ça en deux temps :
--   1. contact_messages distingue désormais un vrai "type" de demande, et
--      porte le user_id (posé par le serveur depuis le jeton de session,
--      jamais par le client — cf. server/api/account/request-deletion.post.ts)
--      pour que l'admin puisse agir sur LE bon compte.
--   2. profiles.status peut désormais valoir 'deleted', avec les mêmes
--      effets de bord qu'un compte 'suspended' partout où c'est pertinent
--      (déconnexion forcée, blocage RLS en écriture).
-- La suppression elle-même reste une ANONYMISATION + un blocage de connexion
-- (jamais un DELETE des lignes), car profiles/orders/events sont liés par
-- des ON DELETE CASCADE qui détruiraient l'historique de commandes/paiements
-- (et, pour un organisateur, les événements et billets d'autres acheteurs).
-- Voir server/api/admin/users/[userId]/delete.post.ts pour le détail.

-- ------------------------------------------------------------
-- 1. contact_messages : type de demande + compte concerné
-- ------------------------------------------------------------
alter table contact_messages
  add column if not exists request_type text not null default 'contact'
    check (request_type in ('contact', 'account_deletion'));

alter table contact_messages
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists contact_messages_request_type_idx on contact_messages(request_type);
create index if not exists contact_messages_user_id_idx on contact_messages(user_id);

comment on column contact_messages.request_type is
  'contact = message du formulaire public. account_deletion = demande de suppression de compte (voir user_id) — posé uniquement côté serveur, jamais par le client.';
comment on column contact_messages.user_id is
  'Compte concerné par une demande account_deletion. Renseigné par le serveur depuis le jeton de session (requireUser), jamais fourni par le client, pour empêcher qu''on fasse supprimer le compte de quelqu''un d''autre.';

-- ------------------------------------------------------------
-- 2. Un compte 'deleted' doit être bloqué exactement comme 'suspended'
--    partout où la RLS le vérifie explicitement (current_user_is_active(),
--    utilisée par la quasi-totalité des policies d'auto-service, se base
--    déjà sur status = 'active' et couvre donc 'deleted' sans rien changer ;
--    seule la policy ci-dessous comparait explicitement à 'suspended').
-- ------------------------------------------------------------
drop policy if exists "Profil modifiable par son propriétaire" on profiles;
create policy "Profil modifiable par son propriétaire" on profiles
  for update using (auth.uid() = user_id and status not in ('suspended', 'deleted'))
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3. Permission users.delete (déjà créée en 0021, jamais utilisée jusqu'ici) :
--    on l'assigne au rôle "users_admin" par défaut, comme les autres actions
--    de gestion des comptes. Le Super Admin l'a déjà via le bypass global.
-- ------------------------------------------------------------
insert into admin_role_permissions (role_id, permission_id)
select r.id, p.id from admin_roles r join permissions p on p.key = 'users.delete'
where r.key = 'users_admin'
on conflict do nothing;
