-- ============================================================
-- TIKEO — Limite de débit (anti-spam/anti-abus) partagée
-- ============================================================
-- Jusqu'ici, server/utils/rateLimit.ts comptait les tentatives dans une
-- simple Map en mémoire du processus Node. Ça fonctionne pour UNE seule
-- instance, mais dès que l'hébergement fait tourner plusieurs instances en
-- parallèle (ce qui arrive justement pendant un pic de trafic), chaque
-- instance a son propre compteur : la limite réelle devient (limite ×
-- nombre d'instances) au lieu d'être globale. On corrige en stockant le
-- compteur dans Postgres (déjà là, déjà partagé par toutes les instances),
-- avec un upsert atomique pour éviter toute concurrence entre requêtes
-- simultanées.
--
-- IMPORTANT : ceci ne change AUCUN comportement visible pour les
-- utilisateurs légitimes. Les mêmes limites (nombre de tentatives / fenêtre
-- de temps) qu'avant s'appliquent, juste calculées correctement.

create table if not exists rate_limit_buckets (
  bucket_key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null
);

comment on table rate_limit_buckets is
  'Compteurs anti-abus partagés entre toutes les instances du serveur (voir server/utils/rateLimit.ts). Une ligne par (route, IP). Purgée automatiquement au fil de l''eau par check_rate_limit().';

-- Function "service_role only" : la table n'a pas besoin d'être exposée via
-- l'API PostgREST publique, seule cette fonction (appelée avec la clé
-- service_role côté serveur) doit pouvoir la manipuler.
alter table rate_limit_buckets enable row level security;

create or replace function check_rate_limit(p_key text, p_window_seconds integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  -- Purge opportuniste (à chaque appel, avec une faible probabilité) pour
  -- empêcher la table de grossir indéfiniment, sans job planifié à gérer.
  if random() < 0.01 then
    delete from rate_limit_buckets where reset_at < now() - interval '1 day';
  end if;

  insert into rate_limit_buckets (bucket_key, count, reset_at)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (bucket_key) do update
    set count = case
          when rate_limit_buckets.reset_at < now() then 1
          else rate_limit_buckets.count + 1
        end,
        reset_at = case
          when rate_limit_buckets.reset_at < now() then now() + make_interval(secs => p_window_seconds)
          else rate_limit_buckets.reset_at
        end
  returning count into v_count;

  return v_count;
end;
$$;

comment on function check_rate_limit is
  'Incrémente atomiquement le compteur de la clé donnée et le remet à 1 si la fenêtre précédente est expirée. Retourne le nombre de tentatives dans la fenêtre en cours (à comparer à la limite côté appelant). Utilisée par server/utils/rateLimit.ts.';

revoke all on function check_rate_limit(text, integer) from public, anon, authenticated;
grant execute on function check_rate_limit(text, integer) to service_role;
