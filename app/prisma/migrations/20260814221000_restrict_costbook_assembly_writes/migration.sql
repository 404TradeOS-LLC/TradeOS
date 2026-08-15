-- Promote existing assemblies into the unified Costbook write boundary.
-- Reads remain organization-scoped for all Costbook readers; direct writes are
-- restricted to owner/admin through the already-shared Costbook helper.

drop policy if exists assemblies_write_policy on public.assemblies;
create policy assemblies_write_policy on public.assemblies
for all using (
  org_id = (select public.current_app_org_id())
  and (select public.current_app_can_manage_costbook())
) with check (
  org_id = (select public.current_app_org_id())
  and (select public.current_app_can_manage_costbook())
);

alter table public.assembly_items
  drop constraint if exists assembly_items_exactly_one_component_check;
alter table public.assembly_items
  add constraint assembly_items_exactly_one_component_check
  check ((cost_item_id is null) <> (child_assembly_id is null));

drop policy if exists assembly_items_write_policy on public.assembly_items;
create policy assembly_items_write_policy on public.assembly_items
for all using (
  (select public.current_app_can_manage_costbook())
  and exists (
    select 1
      from public.assemblies parent
     where parent.id = assembly_items.assembly_id
       and parent.org_id = (select public.current_app_org_id())
  )
) with check (
  (select public.current_app_can_manage_costbook())
  and exists (
    select 1
      from public.assemblies parent
     where parent.id = assembly_items.assembly_id
       and parent.org_id = (select public.current_app_org_id())
  )
  and (
    (
      assembly_items.cost_item_id is not null
      and assembly_items.child_assembly_id is null
      and exists (
        select 1
          from public.cost_items component
         where component.id = assembly_items.cost_item_id
           and component.org_id = (select public.current_app_org_id())
      )
    )
    or
    (
      assembly_items.child_assembly_id is not null
      and assembly_items.cost_item_id is null
      and exists (
        select 1
          from public.assemblies child
         where child.id = assembly_items.child_assembly_id
           and child.org_id = (select public.current_app_org_id())
      )
    )
  )
);
