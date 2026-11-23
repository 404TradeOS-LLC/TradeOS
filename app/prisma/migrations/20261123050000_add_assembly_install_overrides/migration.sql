-- DEV-17 S10 install overrides (issue #518): configurable waste/production
-- assumptions at install, stored per installed assembly.
--
--   waste_override_pct — absolute waste percentage (0-100) that replaces
--     each mapped Material's own wasteFactorPct for this assembly's material
--     legs. NULL means the recipe/mapped-item defaults apply.
--   production_rate_factor — dimensionless multiplier on each mapped
--     CostItem's productionRate for this assembly's labor/equipment legs
--     (1.0 = recipe default). An absolute rate is not expressible across
--     mixed component units (SF vs CY vs EA), so the override is a factor.
--     NULL means no override.
--
-- Additive only: two nullable columns on the tenant-scoped assemblies table.
-- No backfill: existing rows get NULL (recipe defaults), which is the only
-- honest value — a default cannot be inferred from the stored quantities,
-- whose baked-in waste is not recorded separately. No RLS change: the new
-- columns ride the existing assembly row, which is already org-scoped with
-- forced RLS; no new role or permission. No price is stored or embedded:
-- the overrides are assumptions applied at pricing time by
-- getAssemblyUnitCost through the existing CostDatabaseService.getUnitCost
-- path. Rollback: drop the two columns (no data depends on them beyond the
-- install-time assumption record).

alter table assemblies
  add column if not exists waste_override_pct numeric(5, 2),
  add column if not exists production_rate_factor numeric(6, 4);

alter table assemblies
  add constraint assemblies_waste_override_pct_check
    check (waste_override_pct is null or (waste_override_pct >= 0 and waste_override_pct <= 100)),
  add constraint assemblies_production_rate_factor_check
    check (production_rate_factor is null or (production_rate_factor > 0 and production_rate_factor <= 10));
