-- C005 Costbook Hierarchy Management Foundation:
-- Division/Category/Subcategory gain an is_active flag so the authenticated
-- Costbook workspace can soft-deactivate hierarchy rows, matching the
-- CostItem/LaborRate soft-delete pattern. Writes to all three tables move
-- from the generic app-wide write boundary (current_app_can_write(), which
-- also grants the legacy estimator role) to the Costbook-specific manage
-- boundary, matching the C002 materials and C003 labor-rates precedent.

alter table divisions
  add column if not exists is_active boolean not null default true;

alter table categories
  add column if not exists is_active boolean not null default true;

alter table subcategories
  add column if not exists is_active boolean not null default true;

create index if not exists idx_divisions_org_active on divisions(org_id, is_active);
create index if not exists idx_categories_division_active on categories(division_id, is_active);
create index if not exists idx_subcategories_category_active on subcategories(category_id, is_active);

drop policy if exists divisions_write_policy on divisions;

create policy divisions_write_policy on divisions
for all using (
  org_id = (select public.current_app_org_id())
  and (select public.current_app_can_manage_costbook())
) with check (
  org_id = (select public.current_app_org_id())
  and (select public.current_app_can_manage_costbook())
);

drop policy if exists categories_write_policy on categories;

create policy categories_write_policy on categories for all using (
  (select public.current_app_can_manage_costbook())
  and exists (select 1 from divisions where divisions.id = categories.division_id)
) with check (
  (select public.current_app_can_manage_costbook())
  and exists (select 1 from divisions where divisions.id = categories.division_id)
);

drop policy if exists subcategories_write_policy on subcategories;

create policy subcategories_write_policy on subcategories for all using (
  (select public.current_app_can_manage_costbook())
  and exists (
    select 1 from categories
    join divisions on divisions.id = categories.division_id
    where categories.id = subcategories.category_id
  )
) with check (
  (select public.current_app_can_manage_costbook())
  and exists (
    select 1 from categories
    join divisions on divisions.id = categories.division_id
    where categories.id = subcategories.category_id
  )
);
