-- Request-scoped row-level security for TradeOS tenant data.
-- The API sets these values with set_config(..., true) inside a transaction.

create or replace function current_app_auth_subject() returns text
language sql stable
as $$
  select nullif(current_setting('app.auth_subject', true), '')
$$;

create or replace function current_app_role() returns text
language sql stable
as $$
  select nullif(current_setting('app.role', true), '')
$$;

create or replace function current_app_can_write() returns boolean
language sql stable
as $$
  select coalesce(current_app_role() in ('owner', 'admin', 'estimator'), false)
$$;

create or replace function current_app_can_administer() returns boolean
language sql stable
as $$
  select coalesce(current_app_role() in ('owner', 'admin'), false)
$$;

create or replace function current_app_is_provisioning() returns boolean
language sql stable
as $$
  select coalesce(current_setting('app.provisioning', true) = 'true', false)
$$;

-- Identity bootstrap: a signed auth subject may read only its own user row.
-- Once resolved, admins may provision users and the current user may read self.
alter table users enable row level security;
alter table users force row level security;

create policy users_select_policy on users
for select using (
  auth_subject = current_app_auth_subject()
  or id = current_app_user_id()
  or current_app_can_administer()
);

create policy users_insert_policy on users
for insert with check (
  (select current_app_can_administer())
  or (select current_app_is_provisioning())
);

create policy users_update_policy on users
for update using (
  id = current_app_user_id() or current_app_can_administer()
) with check (
  id = current_app_user_id() or current_app_can_administer()
);

alter table organization_memberships enable row level security;
alter table organization_memberships force row level security;

create policy memberships_select_policy on organization_memberships
for select using (
  org_id = current_app_org_id()
  and (user_id = current_app_user_id() or current_app_can_administer())
);

create policy memberships_write_policy on organization_memberships
for all using (
  org_id = (select current_app_org_id())
  and ((select current_app_can_administer()) or (select current_app_is_provisioning()))
) with check (
  org_id = (select current_app_org_id())
  and ((select current_app_can_administer()) or (select current_app_is_provisioning()))
);

alter table organizations enable row level security;
alter table organizations force row level security;

create policy organizations_select_policy on organizations
for select using (id = (select current_app_org_id()));

create policy organizations_insert_policy on organizations
for insert with check (
  id = (select current_app_org_id()) and (select current_app_is_provisioning())
);

create policy organizations_update_policy on organizations
for update using (
  id = current_app_org_id() and current_app_can_administer()
) with check (
  id = current_app_org_id() and current_app_can_administer()
);

alter table organization_membership_audits enable row level security;
alter table organization_membership_audits force row level security;

create policy membership_audits_select_policy on organization_membership_audits
for select using (
  org_id = current_app_org_id() and current_app_can_administer()
);

create policy membership_audits_insert_policy on organization_membership_audits
for insert with check (
  org_id = (select current_app_org_id())
  and ((select current_app_can_administer()) or (select current_app_is_provisioning()))
);

alter table material_price_audits enable row level security;
alter table material_price_audits force row level security;

create policy material_price_audits_select_policy on material_price_audits
for select using (
  org_id = (select current_app_org_id()) and (select current_app_can_administer())
);

create policy material_price_audits_insert_policy on material_price_audits
for insert with check (
  org_id = (select current_app_org_id()) and (select current_app_can_write())
);

alter table supplier_price_updates enable row level security;
alter table supplier_price_updates force row level security;

create policy supplier_price_updates_select_policy on supplier_price_updates
for select using (
  org_id = (select current_app_org_id())
);

create policy supplier_price_updates_insert_policy on supplier_price_updates
for insert with check (
  org_id = (select current_app_org_id()) and (select current_app_can_write())
);

-- Reviewing (approving/rejecting) a queued price proposal is an
-- administrative action, not an ordinary write — restricted to admin/owner
-- even though estimators can enqueue proposals via current_app_can_write().
create policy supplier_price_updates_review_policy on supplier_price_updates
for update using (
  org_id = (select current_app_org_id()) and (select current_app_can_administer())
) with check (
  org_id = (select current_app_org_id()) and (select current_app_can_administer())
);

create index if not exists idx_divisions_org on divisions(org_id);
create index if not exists idx_regions_org on regions(org_id);
create index if not exists idx_suppliers_org on suppliers(org_id);
create index if not exists idx_subcontractors_org on subcontractors(org_id);
create index if not exists idx_assemblies_org on assemblies(org_id);
create index if not exists idx_customers_org on customers(org_id);
create index if not exists idx_estimates_org on estimates(org_id);

-- Direct tenant tables share the same read/write policy shape. FORCE ensures
-- the policy also applies when the application connects as the table owner.
do $$
declare
  tenant_table text;
begin
  foreach tenant_table in array array[
    'divisions', 'regions', 'suppliers', 'materials', 'labor_rates',
    'equipment', 'subcontractors', 'cost_items', 'assemblies', 'customers',
    'projects', 'estimates'
  ]
  loop
    execute format('alter table %I enable row level security', tenant_table);
    execute format('alter table %I force row level security', tenant_table);
    execute format(
      'create policy %I on %I for select using (org_id = (select current_app_org_id()))',
      tenant_table || '_select_policy', tenant_table
    );
    execute format(
      'create policy %I on %I for all using (org_id = (select current_app_org_id()) and (select current_app_can_write())) with check (org_id = (select current_app_org_id()) and (select current_app_can_write()))',
      tenant_table || '_write_policy', tenant_table
    );
  end loop;
end
$$;

-- Child records inherit tenant scope through a protected parent row.
alter table categories enable row level security;
alter table categories force row level security;
create policy categories_select_policy on categories for select using (
  exists (select 1 from divisions where divisions.id = categories.division_id)
);
create policy categories_write_policy on categories for all using (
  current_app_can_write() and exists (select 1 from divisions where divisions.id = categories.division_id)
) with check (
  current_app_can_write() and exists (select 1 from divisions where divisions.id = categories.division_id)
);

alter table subcategories enable row level security;
alter table subcategories force row level security;
create policy subcategories_select_policy on subcategories for select using (
  exists (
    select 1 from categories
    join divisions on divisions.id = categories.division_id
    where categories.id = subcategories.category_id
  )
);
create policy subcategories_write_policy on subcategories for all using (
  current_app_can_write() and exists (
    select 1 from categories
    join divisions on divisions.id = categories.division_id
    where categories.id = subcategories.category_id
  )
) with check (
  current_app_can_write() and exists (
    select 1 from categories
    join divisions on divisions.id = categories.division_id
    where categories.id = subcategories.category_id
  )
);

alter table assembly_items enable row level security;
alter table assembly_items force row level security;
create policy assembly_items_select_policy on assembly_items for select using (
  exists (select 1 from assemblies where assemblies.id = assembly_items.assembly_id)
);
create policy assembly_items_write_policy on assembly_items for all using (
  current_app_can_write() and exists (select 1 from assemblies where assemblies.id = assembly_items.assembly_id)
) with check (
  current_app_can_write() and exists (select 1 from assemblies where assemblies.id = assembly_items.assembly_id)
);

alter table estimate_line_items enable row level security;
alter table estimate_line_items force row level security;
create policy estimate_line_items_select_policy on estimate_line_items for select using (
  exists (select 1 from estimates where estimates.id = estimate_line_items.estimate_id)
);
create policy estimate_line_items_write_policy on estimate_line_items for all using (
  current_app_can_write() and exists (select 1 from estimates where estimates.id = estimate_line_items.estimate_id)
) with check (
  current_app_can_write() and exists (select 1 from estimates where estimates.id = estimate_line_items.estimate_id)
);

alter table change_orders enable row level security;
alter table change_orders force row level security;
create policy change_orders_select_policy on change_orders for select using (
  exists (select 1 from projects where projects.id = change_orders.project_id)
);
create policy change_orders_write_policy on change_orders for all using (
  current_app_can_write() and exists (select 1 from projects where projects.id = change_orders.project_id)
) with check (
  current_app_can_write() and exists (select 1 from projects where projects.id = change_orders.project_id)
);

alter table change_order_line_items enable row level security;
alter table change_order_line_items force row level security;
create policy change_order_line_items_select_policy on change_order_line_items for select using (
  exists (
    select 1 from change_orders
    join projects on projects.id = change_orders.project_id
    where change_orders.id = change_order_line_items.change_order_id
  )
);
create policy change_order_line_items_write_policy on change_order_line_items for all using (
  current_app_can_write() and exists (
    select 1 from change_orders
    join projects on projects.id = change_orders.project_id
    where change_orders.id = change_order_line_items.change_order_id
  )
) with check (
  current_app_can_write() and exists (
    select 1 from change_orders
    join projects on projects.id = change_orders.project_id
    where change_orders.id = change_order_line_items.change_order_id
  )
);
