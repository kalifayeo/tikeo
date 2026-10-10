-- ============================================================
-- TIKEO — La double authentification ne concerne que les administrateurs
-- ============================================================
-- Jusqu'ici, n'importe quel client pouvait activer un facteur TOTP depuis
-- « Mon espace > Paramètres » et « exiger la 2FA à la connexion ». La 2FA est
-- désormais réservée à l'accès au panneau d'administration (middleware
-- admin + routes serveur exigeant aal2) ; l'interface client correspondante
-- a été retirée.
--
-- Cette migration nettoie les données héritées de l'ancien comportement :
--   1. la préférence « mfa_required » est remise à false pour tout compte
--      qui n'est pas administrateur ;
--   2. les facteurs TOTP éventuellement enregistrés par des comptes non
--      administrateurs sont supprimés (sans quoi leur session resterait
--      bloquée en « niveau suivant aal2 ») ;
--   3. un compte non administrateur ne peut plus activer « mfa_required ».
-- Aucune donnée de commande, billet ou paiement n'est touchée.

update profiles set mfa_required = false where role <> 'admin' and mfa_required;

delete from auth.mfa_factors
 where user_id in (select user_id from profiles where role <> 'admin');

create or replace function public.profiles_guard_mfa_required()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.mfa_required and not coalesce(old.mfa_required, false) and auth.role() <> 'service_role' then
    -- Réservé aux administrateurs.
    if new.role <> 'admin' then
      raise exception 'MFA_ADMIN_ONLY: la double authentification est réservée aux administrateurs.';
    end if;
    if not public.is_admin() and not exists (
      select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified'
    ) then
      raise exception 'MFA_NOT_ENROLLED: activez un facteur de double authentification avant de l''exiger.';
    end if;
  end if;
  return new;
end;
$$;

-- Quand un compte quitte le rôle admin, sa préférence 2FA n'a plus lieu d'être.
create or replace function public.profiles_clear_mfa_on_demotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'admin' and new.role <> 'admin' then
    new.mfa_required := false;
    delete from auth.mfa_factors where user_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_clear_mfa_on_demotion on profiles;
create trigger trg_profiles_clear_mfa_on_demotion
  before update of role on profiles
  for each row execute function public.profiles_clear_mfa_on_demotion();
