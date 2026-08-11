-- C003 Labor Rates Foundation:
-- Extend the existing labor_rates table with the foundational Costbook fields
-- used by the authenticated Costbook workspace while preserving the legacy
-- trade/base-hourly-rate compatibility columns already consumed elsewhere.

alter table labor_rates
  add column if not exists role text,
  add column if not exists description text,
  add column if not exists hourly_cost numeric(10,2),
  add column if not exists bill_rate numeric(10,2),
  add column if not exists active boolean not null default true;

update labor_rates
   set role = coalesce(nullif(btrim(role), ''), trade),
       hourly_cost = coalesce(hourly_cost, base_hourly_rate),
       bill_rate = coalesce(bill_rate, base_hourly_rate),
       active = coalesce(active, true)
 where role is null
    or hourly_cost is null
    or bill_rate is null;

-- Legacy null-org labor rates are unreachable under forced RLS and cannot be
-- assigned safely to a tenant during migration.
delete from labor_rates
 where org_id is null;

alter table labor_rates
  alter column org_id set not null,
  alter column role set not null,
  alter column hourly_cost set not null,
  alter column bill_rate set not null;

create index if not exists idx_labor_rates_org_active_role
  on labor_rates(org_id, active, role);

drop policy if exists labor_rates_write_policy on labor_rates;

create policy labor_rates_write_policy on labor_rates
for all using (
  org_id = (select public.current_app_org_id())
  and (select public.current_app_can_manage_costbook())
) with check (
  org_id = (select public.current_app_org_id())
  and (select public.current_app_can_manage_costbook())
);
