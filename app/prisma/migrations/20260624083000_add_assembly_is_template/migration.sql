-- Marks a reusable starting-point assembly (e.g. "Standard Bathroom Remodel")
-- that an org's estimators browse for quick adds, as distinct from one-off
-- assemblies built for a specific job. Org-scoped, not a cross-tenant
-- catalog: forced RLS would hide a NULL-org_id row from every tenant anyway
-- (org_id = current_app_org_id() is never true when org_id is NULL).
alter table assemblies add column is_template boolean not null default false;
create index idx_assemblies_org_template on assemblies(org_id, is_template);
