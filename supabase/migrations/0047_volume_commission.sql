-- ============================================================
-- TIKEO — Commission par paliers de volume + choix de qui la paie
-- ============================================================
-- Remplace le modèle « forfaits à choisir » (0024/0046) : choisir un forfait
-- gratuit moins cher n'avait aucun sens (tout le monde aurait pris le taux le
-- plus bas). Désormais :
--   * aucun forfait à choisir : le taux dépend des ventes CUMULÉES payées de
--     l'organisateur (table commission_tiers, modifiable par l'admin) ;
--   * un organisateur « sur mesure » peut avoir un taux négocié
--     (organizers.custom_commission_rate) qui prime sur les paliers ;
--   * chaque événement choisit QUI paie la commission (events.fees_payer) :
--       'organizer' : déduite de ce que touche l'organisateur ;
--       'buyer'     : ajoutée au prix en « frais de service » payés par l'acheteur.
-- Le taux et le montant sont figés sur chaque commande à sa création.
-- La colonne organizers.plan reste en base (historique) mais n'est plus utilisée.

create table if not exists commission_tiers (
  min_sales numeric(14,2) primary key check (min_sales >= 0),
  rate numeric(5,2) not null check (rate >= 0 and rate <= 50)
);
alter table commission_tiers enable row level security;
drop policy if exists commission_tiers_read on commission_tiers;
create policy commission_tiers_read on commission_tiers for select using (true);

-- Paliers par défaut (FCFA de ventes cumulées) — à ajuster librement :
--   update commission_tiers set rate = 5 where min_sales = 1000000;
insert into commission_tiers (min_sales, rate) values
  (0, 6.0),
  (1000000, 5.0),
  (5000000, 3.5),
  (20000000, 2.5)
on conflict (min_sales) do nothing;

alter table organizers
  add column if not exists custom_commission_rate numeric(5,2)
  check (custom_commission_rate is null or (custom_commission_rate >= 0 and custom_commission_rate <= 50));
comment on column organizers.custom_commission_rate is 'Taux négocié (offre sur mesure) ; prime sur les paliers de commission_tiers.';

alter table events
  add column if not exists fees_payer text not null default 'organizer'
  check (fees_payer in ('organizer', 'buyer'));
comment on column events.fees_payer is 'Qui paie la commission Tikeo : organizer (déduite) ou buyer (frais de service ajoutés).';

alter table orders
  add column if not exists commission_payer text not null default 'organizer';

-- Ventes cumulées payées (hors frais) d'un organisateur.
create or replace function organizer_paid_sales(p_organizer_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(greatest(o.subtotal - coalesce(o.discount, 0), 0)), 0)
    from orders o
    join events e on e.id = o.event_id
   where e.organizer_id = p_organizer_id
     and o.status = 'paid';
$$;

create or replace function commission_rate_for(p_organizer_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select custom_commission_rate from organizers where id = p_organizer_id),
    (select t.rate from commission_tiers t
      where t.min_sales <= organizer_paid_sales(p_organizer_id)
      order by t.min_sales desc limit 1),
    6.0
  );
$$;

create or replace function set_order_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_payer text;
  v_base numeric;
  v_rate numeric;
  v_commission numeric;
begin
  select e.organizer_id, e.fees_payer into v_org, v_payer
    from events e where e.id = new.event_id;

  v_base := greatest(coalesce(new.subtotal, 0) - coalesce(new.discount, 0), 0);
  v_rate := commission_rate_for(v_org);
  v_commission := round(v_base * v_rate / 100);

  new.commission_rate := v_rate;
  new.commission_amount := v_commission;
  new.commission_payer := coalesce(v_payer, 'organizer');

  -- Commission à la charge de l'acheteur : ajoutée au total en « frais de service ».
  if new.commission_payer = 'buyer' and v_commission > 0 then
    new.fees := v_commission;
    new.total := greatest(coalesce(new.subtotal, 0) + v_commission - coalesce(new.discount, 0), 0);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_order_commission on orders;
create trigger trg_set_order_commission
  before insert on orders
  for each row execute function set_order_commission();

-- État de commission de l'organisateur connecté (pour l'espace organisateur).
create or replace function my_commission_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org organizers%rowtype;
  v_sales numeric;
  v_rate numeric;
  v_next record;
begin
  select * into v_org from organizers where user_id = auth.uid();
  if not found then
    return null;
  end if;
  v_sales := organizer_paid_sales(v_org.id);
  v_rate := commission_rate_for(v_org.id);
  select min_sales, rate into v_next
    from commission_tiers
   where min_sales > v_sales and v_org.custom_commission_rate is null
   order by min_sales asc limit 1;
  return jsonb_build_object(
    'sales', v_sales,
    'rate', v_rate,
    'custom', v_org.custom_commission_rate is not null,
    'next_min_sales', v_next.min_sales,
    'next_rate', v_next.rate
  );
end;
$$;
grant execute on function my_commission_status() to authenticated;
