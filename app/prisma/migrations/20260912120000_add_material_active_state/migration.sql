-- Adds an is_active flag to materials so the authenticated Costbook
-- workspace can soft-deactivate/archive material catalog rows, matching
-- the Division/Category/Subcategory/CostItem/LaborRate soft-delete
-- pattern (see 20260812120000_add_costbook_hierarchy_foundation).
-- materials_write_policy already restricts every material write (this
-- deactivation included) to the costbook.manage boundary
-- (current_app_can_manage_costbook()), so no RLS policy change is
-- required here.

alter table materials
  add column if not exists is_active boolean not null default true;

create index if not exists idx_materials_org_active on materials(org_id, is_active);
