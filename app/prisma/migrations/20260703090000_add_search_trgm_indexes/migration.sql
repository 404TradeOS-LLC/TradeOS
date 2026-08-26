-- Trigram-accelerated free-text search for the case-insensitive `contains`
-- (Prisma `mode: "insensitive"`, compiles to `ILIKE '%query%'`) searches
-- already live in the app:
--   - modules/cost-database/service.ts  (cost item search, name + code)
--   - modules/assemblies-database/service.ts (assembly search, name + code)
--   - modules/admin-dashboard/service.ts (material search, name)
--
-- A plain btree index — including the existing unique (org_id, code)
-- indexes on cost_items/assemblies — cannot accelerate a substring match
-- like `ILIKE '%query%'`; only a prefix match (`ILIKE 'query%'`) benefits
-- from btree. Only a trigram (pg_trgm) GIN index accelerates substring
-- search. See docs/DATABASE_MASTER_PLAN.md section 4/10 for the audit
-- finding this closes.
--
-- suppliers.name is included proactively even though no `contains` search
-- exists against it yet, since it's the obvious next search-as-you-type
-- surface (same pattern as materials) and the index is cheap to add now
-- versus as a reactive fix later.
create extension if not exists pg_trgm;

create index if not exists idx_cost_items_name_trgm on cost_items using gin (name gin_trgm_ops);
create index if not exists idx_assemblies_name_trgm on assemblies using gin (name gin_trgm_ops);
create index if not exists idx_materials_name_trgm on materials using gin (name gin_trgm_ops);
create index if not exists idx_suppliers_name_trgm on suppliers using gin (name gin_trgm_ops);
