-- ============================================================
-- TIKEO — Commission réellement appliquée selon la formule de l'organisateur
-- ============================================================
-- Jusqu'ici la formule (organizers.plan, migration 0024) n'était qu'une
-- information : aucune commission n'était calculée (orders.fees restait à 0).
-- On fige maintenant, À LA CRÉATION de chaque commande, le taux de la
-- formule de l'organisateur de l'événement et le montant correspondant.
-- Ainsi un changement de formule ultérieur ne réécrit jamais l'historique.
--
-- La commission est prélevée sur la part de l'organisateur (l'acheteur ne
-- paie rien en plus : orders.fees reste inchangé). Les commandes gratuites
-- (total = 0) donnent une commission de 0.
-- Les commandes existantes gardent 0 : elles datent d'avant les formules.

alter table orders
  add column if not exists commission_rate numeric(5,2) not null default 0,
  add column if not exists commission_amount numeric(12,2) not null default 0;

alter table organizers
  add column if not exists plan_changed_at timestamptz;

create or replace function plan_commission_rate(p_plan text)
returns numeric
language sql
immutable
as $$
  select case p_plan
    when 'decouverte' then 6.0
    when 'essentiel' then 5.0
    when 'pro' then 3.5
    when 'business' then 2.5
    else 6.0
  end;
$$;

create or replace function set_order_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
begin
  select o.plan into v_plan
    from events e
    join organizers o on o.id = e.organizer_id
   where e.id = new.event_id;

  new.commission_rate := plan_commission_rate(coalesce(v_plan, 'decouverte'));
  new.commission_amount := round(greatest(coalesce(new.total, 0), 0) * new.commission_rate / 100);
  return new;
end;
$$;

drop trigger if exists trg_set_order_commission on orders;
create trigger trg_set_order_commission
  before insert on orders
  for each row execute function set_order_commission();
