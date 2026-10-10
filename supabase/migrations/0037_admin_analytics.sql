-- ============================================================
-- TIKEO — Séries temporelles pour les graphiques admin
-- ============================================================
-- Fonctions en SECURITY INVOKER (pas DEFINER) : la RLS existante (migration
-- 0004, "Admin ... accès global") s'applique normalement à l'appelant — un
-- compte non-admin obtient simplement des séries à zéro, sans risque de fuite.
-- ============================================================

create or replace function public.admin_revenue_timeseries(p_days integer default 30)
returns table (day date, orders_count integer, revenue numeric)
language sql
stable
as $$
  select d::date as day,
         count(o.id)::integer as orders_count,
         coalesce(sum(o.total), 0) as revenue
    from generate_series(current_date - (greatest(1, least(coalesce(p_days, 30), 365)) - 1), current_date, interval '1 day') d
    left join orders o on o.status = 'paid' and o.created_at::date = d::date
   group by d
   order by d;
$$;

create or replace function public.admin_signups_timeseries(p_days integer default 30)
returns table (day date, buyers integer, organizers integer)
language sql
stable
as $$
  select d::date as day,
         count(p.id) filter (where p.role in ('buyer', 'organizer', 'agent'))::integer as buyers,
         count(distinct org.id)::integer as organizers
    from generate_series(current_date - (greatest(1, least(coalesce(p_days, 30), 365)) - 1), current_date, interval '1 day') d
    left join profiles p on p.created_at::date = d::date
    left join organizers org on org.created_at::date = d::date
   group by d
   order by d;
$$;

create or replace function public.admin_top_events(p_limit integer default 5)
returns table (event_id uuid, title text, revenue numeric, tickets_sold integer)
language sql
stable
as $$
  select e.id, e.title,
         coalesce(sum(oi.total), 0) as revenue,
         coalesce(sum(oi.quantity), 0)::integer as tickets_sold
    from events e
    join orders o on o.event_id = e.id and o.status = 'paid'
    join order_items oi on oi.order_id = o.id
   group by e.id, e.title
   order by revenue desc
   limit greatest(1, least(coalesce(p_limit, 5), 50));
$$;

grant execute on function public.admin_revenue_timeseries(integer) to authenticated;
grant execute on function public.admin_signups_timeseries(integer) to authenticated;
grant execute on function public.admin_top_events(integer) to authenticated;
