drop policy if exists equipment_write_policy on equipment;

create policy equipment_write_policy on equipment
for all
using (
  org_id = (select public.current_app_org_id())
  and (select public.current_app_can_manage_costbook())
)
with check (
  org_id = (select public.current_app_org_id())
  and (select public.current_app_can_manage_costbook())
);
