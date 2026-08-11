-- C002 Materials Catalog Foundation:
-- Material reads remain organization-scoped for Costbook read roles through
-- materials_select_policy. Writes now align with the Costbook write/manage
-- permission boundary (owner/admin) instead of the broader app-wide write
-- helper used by CRM and field-work tables.

drop policy if exists materials_write_policy on materials;

create policy materials_write_policy on materials
for all using (
  org_id = (select public.current_app_org_id())
  and (select public.current_app_can_manage_costbook())
) with check (
  org_id = (select public.current_app_org_id())
  and (select public.current_app_can_manage_costbook())
);

drop policy if exists material_price_audits_insert_policy on material_price_audits;

create policy material_price_audits_insert_policy on material_price_audits
for insert with check (
  org_id = (select public.current_app_org_id())
  and (select public.current_app_can_manage_costbook())
);
