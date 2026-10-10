-- ============================================================
-- TIKEO — Audit des permissions Supabase (LECTURE SEULE)
-- À coller dans Supabase > SQL Editor, requête par requête.
-- Chaque requête doit renvoyer 0 ligne, sauf mention contraire.
-- ============================================================

-- A. Tables du schéma public SANS Row Level Security  → attendu : 0 ligne
select c.relname as table_sans_rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- B. Policies d'écriture « ouvertes à tous » (using/with check = true) → attendu : 0 ligne
select schemaname, tablename, policyname, cmd, roles
  from pg_policies
 where schemaname in ('public', 'storage')
   and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
   and (qual = 'true' or with_check = 'true');

-- C. Fonctions SECURITY DEFINER appelables par les VISITEURS (anon)
--    → attendu : seulement waitlist_available, waitlist_count,
--      current_user_is_active, is_admin, can_review_event (usage dans les policies)
select p.proname as fonction, pg_get_function_identity_arguments(p.oid) as arguments
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosecdef
   and has_function_privilege('anon', p.oid, 'EXECUTE')
 order by 1;

-- D. Fonctions SECURITY DEFINER sans search_path figé → attendu : 0 ligne
select p.proname as fonction
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosecdef
   and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'));

-- E. Fonctions « sensibles » : qui peut les appeler ? → attendu : seulement service_role
select p.proname as fonction,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('create_order', 'confirm_order_payment', 'create_ticket_transfer', 'respond_ticket_transfer',
                     'cancel_ticket_transfer', 'join_waitlist', 'process_waitlist', 'validate_promo_code',
                     'has_permission_for', 'is_super_admin_for', 'check_rate_limit', 'log_admin_action',
                     'claim_pending_notifications', 'reply_to_review', 'release_expired_orders');
-- → colonnes anon ET authenticated doivent valoir false sur CHAQUE ligne.

-- F. Vues : lister celles qui contournent la RLS (normal pour les vues publiques agrégées).
--    Vérifier à la main qu'aucune ne contient email, téléphone ou jeton.
select c.relname as vue, c.reloptions
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'v';

-- G. Droits directs de anon sur les tables (hors lecture) → attendu : 0 ligne
select table_name, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public' and grantee = 'anon'
   and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
 order by 1, 2;
-- Remarque : Supabase accorde ces droits à anon par défaut ; ils sont inoffensifs
-- tant que la RLS est active (requête A = 0 ligne) et sans policy ouverte (requête B = 0 ligne).

-- H. Buckets de stockage (public = lisible par tous : normal pour « media », pas pour autre chose)
select id, public, file_size_limit, allowed_mime_types from storage.buckets;

-- I. Policies du stockage
select policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'storage' and tablename = 'objects';

-- J. Triggers de révocation de session installés (migration 0043) → attendu : 2 lignes
select tgname, tgrelid::regclass as table_cible from pg_trigger
 where tgname in ('trg_revoke_sessions_on_lock', 'trg_revoke_sessions_on_password_change');

-- K. Comptes administrateurs actifs sans double authentification enregistrée → attendu : 0 ligne
select p.user_id, p.full_name
  from profiles p
 where p.role = 'admin' and p.status = 'active'
   and not exists (select 1 from auth.mfa_factors f where f.user_id = p.user_id and f.status = 'verified');
