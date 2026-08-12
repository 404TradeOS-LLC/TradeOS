---
status: current
owner: platform
last_verified: 2026-08-12
source_of_truth: true
related_code:
  - app/modules/cost-database
  - app/modules/labor-database
  - app/modules/material-database
  - app/modules/equipment-database
  - app/modules/assemblies-database
  - app/modules/costbook
  - app/backend/routes/costbook.routes.ts
  - web/src/app/(app)/costbook/page.tsx
  - web/src/app/(app)/costbook/materials/page.tsx
  - web/src/app/(app)/costbook/divisions/page.tsx
  - web/src/components/costbook/materials-catalog.tsx
  - web/src/components/costbook/hierarchy-catalog.tsx
  - app/prisma/migrations/20260811120000_add_costbook_workspace_foundation/migration.sql
  - app/prisma/migrations/20260811130000_restrict_costbook_material_writes/migration.sql
  - app/prisma/migrations/20260812120000_add_costbook_hierarchy_foundation/migration.sql
  - app/modules/admin-dashboard
  - app/prisma/migrations/20260703090000_add_search_trgm_indexes/migration.sql
  - app/backend/routes/costDatabase.routes.ts
  - app/backend/routes/laborDatabase.routes.ts
  - app/backend/routes/materialDatabase.routes.ts
  - app/backend/routes/equipmentDatabase.routes.ts
  - app/backend/routes/assembliesDatabase.routes.ts
---

# Cost Book

## Purpose

Provide the tenant-scoped estimating catalog: divisions, categories, subcategories, cost items, labor rates, materials, equipment rates, and assemblies.

C001 adds the Costbook workspace foundation around those existing catalog primitives. C002 adds the first unified Costbook catalog management surface for organization-scoped materials. C003 adds the foundational organization-scoped labor-rates surface. C005 completes Division/Category/Subcategory hierarchy CRUD (the one gap C001-C004 left) under the same Costbook boundary. It does not add labor-engine rules, equipment workflows, assembly-builder behavior, pricing calculations, estimate integration, price history, supplier sync automation, Athena recommendations, or autonomous writes.

## Source code locations

- `app/modules/cost-database/*`
- `app/modules/labor-database/*`
- `app/modules/material-database/*`
- `app/modules/equipment-database/*`
- `app/modules/assemblies-database/*`
- `app/modules/costbook/*`

## Core models

- `Division`
- `Category`
- `Subcategory`
- `CostItem`
- `LaborRate`
- `Material`
- `Equipment`
- `Assembly`
- `AssemblyItem`
- `CostbookWorkspace`
- `CostbookWorkspaceEvent`

## Routes

- `/api/v1/cost-database/*`
- `/api/v1/labor-rates/*`
- `/api/v1/materials/*`
- `/api/v1/equipment/*`
- `/api/v1/assemblies/*`
- `/api/v1/costbook/workspace`
- `/api/v1/costbook/materials`
- `/api/v1/costbook/materials/:id`
- `/api/v1/costbook/labor-rates`
- `/api/v1/costbook/labor-rates/:id`
- `/api/v1/costbook/divisions`
- `/api/v1/costbook/divisions/:id`
- `/api/v1/costbook/categories`
- `/api/v1/costbook/categories/:id`
- `/api/v1/costbook/subcategories`
- `/api/v1/costbook/subcategories/:id`

`GET /api/v1/costbook/workspace` is a read-only workspace-foundation summary. It requires `costbook.read`, returns Costbook permission flags for the authenticated role, and returns organization-scoped counts for existing catalog records. It does not expose CRUD or pricing workflows.

C002 material routes under the unified Costbook boundary:

- `GET /api/v1/costbook/materials` requires `costbook.read` and lists material DTOs for the authenticated organization only
- `GET /api/v1/costbook/materials/:id` requires `costbook.read` and returns 404 for missing or cross-organization material IDs
- `POST /api/v1/costbook/materials` requires `costbook.write`; accepted fields are `sku`, `name`, `unitOfMeasure`, `unitCost`, `wasteFactorPct`, and optional same-organization `supplierId`
- `PATCH /api/v1/costbook/materials/:id` requires `costbook.write`; accepted fields are the same subset, and unit-cost changes write a manual material price-audit row

The C002 DTO includes `id`, `organizationId`, `sku`, `name`, `unitOfMeasure`, `unitCost`, `wasteFactorPct`, `supplierId`, `supplierName`, `lastPriceUpdate`, `createdAt`, and `updatedAt`. Request bodies are strict; caller-supplied organization IDs, pricing-engine fields, blank/null unit costs, and unit costs outside the existing database precision are rejected.

C003 labor-rate routes under the unified Costbook boundary:

- `GET /api/v1/costbook/labor-rates` requires `costbook.read` and lists labor-rate DTOs for the authenticated organization only
- `GET /api/v1/costbook/labor-rates/:id` requires `costbook.read` and returns 404 for missing or cross-organization labor-rate IDs
- `POST /api/v1/costbook/labor-rates` requires `costbook.write`; accepted strict fields are `role`, optional `description`, `hourlyCost`, optional `active`, and `billRate`
- `PATCH /api/v1/costbook/labor-rates/:id` requires `costbook.write`; accepted fields are the same subset
- `DELETE /api/v1/costbook/labor-rates/:id` requires `costbook.manage` and soft-deactivates the row by setting `active` to `false`

The C003 DTO includes `id`, `organizationId`, `role`, `description`, `hourlyCost`, `billRate`, `active`, `createdAt`, and `updatedAt`. Request bodies are strict; caller-supplied organization IDs, blank roles, blank/null numeric values, negative numeric values, and values outside the database precision are rejected before writes reach the database.

C002 reuses the existing `materials` table rather than adding a duplicate material table. Migration `20260811130000_restrict_costbook_material_writes` keeps material reads organization-scoped and tightens material/material-price-audit writes to the existing owner/admin Costbook boundary.

The legacy `/api/v1/materials/*` and `/api/v1/labor-rates/*` route groups remain mounted for compatibility and share the same Costbook permission boundary: read-style operations require `costbook.read`; labor and material create/update operations require `costbook.write`; and labor-rate deletes require `costbook.manage`.

C005 hierarchy routes under the unified Costbook boundary:

- `GET /api/v1/costbook/divisions`, `GET /api/v1/costbook/categories?divisionId=`, and `GET /api/v1/costbook/subcategories?categoryId=` require `costbook.read` and list DTOs for the authenticated organization only, with an optional parent-scoped filter for categories/subcategories
- `GET .../:id` requires `costbook.read` and returns 404 for missing or cross-organization IDs
- `POST` requires `costbook.write`; accepted strict fields are `code`, `name`, optional `sortOrder`, plus the parent id (`divisionId` for categories, `categoryId` for subcategories)
- `PATCH .../:id` requires `costbook.write`; accepted fields are the same subset (parent id is not re-parentable through update)
- `DELETE .../:id` requires `costbook.manage` and soft-deactivates the row by setting `isActive` to `false`

The C005 DTOs add `isActive` and `createdAt` to the existing Division/Category/Subcategory shape (`id`, `code`, `name`, `sortOrder`, plus `organizationId` on Division and the parent id + derived `organizationId` on Category/Subcategory). Category and Subcategory creates/updates validate that the supplied parent id belongs to the authenticated organization before writing, mirroring the existing `assertSupplierBelongsToOrganization` pattern from C002. The legacy `/api/v1/cost-database/{divisions,categories,subcategories}` list+create routes remain mounted at the same paths; C005 adds the missing get/update/deactivate operations under the Costbook boundary, and — because the underlying RLS write policy tightened to owner/admin-only — also adds a `costbook.write` permission check to the legacy `createDivision`/`createCategory`/`createSubcategory` handlers (previously unguarded at the controller layer) so a role that lost write access there gets a clean 403 instead of a raw RLS failure. The legacy list/get paths for `CostItem`, and the cost-database `listDivisions`/`listSubcategoryCostItems` reads, are unaffected by this change and do not filter on the new `isActive` hierarchy flag; only the Costbook workspace boundary's reads currently observe hierarchy soft-deactivation.

Supplier price update approve/reject routes that review material price proposals require `costbook.write`, matching the material and material-price-audit forced-RLS write boundary.

Representative search behavior:

- `GET /api/v1/cost-database/cost-items/search` performs case-insensitive substring matching against both `name` and `code`
- assembly search uses the same name-or-code substring pattern in the service layer
- material name filtering currently appears in the admin pricing-audit history query through a case-insensitive `contains` filter
- supplier name trigram indexing is present for the expected next search-as-you-type surface, but there is no dedicated supplier substring-search route yet

## Permissions

See [RBAC_MATRIX.md](../RBAC_MATRIX.md).

Costbook-specific permission keys:

- `costbook.read`
- `costbook.write`
- `costbook.manage`

Current C001 behavior:

- owner/admin: full Costbook permissions
- dispatcher, technician, and legacy estimator: read-only Costbook access
- legacy viewer: no Costbook access

## Lifecycle and statuses

- assemblies may be marked `isTemplate` for reusable quick-add behavior
- materials participate in supplier review queue history through related audit records
- labor rates participate in the authenticated Costbook workspace through an `active` flag; the current delete behavior is soft deactivate, not hard delete
- material archive/deactivate is not exposed in C002 because the existing `Material` schema has no active/archive column
- Costbook workspace foundation state uses `foundation`, `active`, and `archived`; current UI and API use `foundation` unless a future workflow initializes workspace state
- Division/Category/Subcategory gained an `isActive` flag in C005 (migration `20260812120000_add_costbook_hierarchy_foundation`; previously only `CostItem` had one in this hierarchy). Delete is soft-deactivate only, matching CostItem/LaborRate; child rows are never cascade-deleted through the API

## Frontend surfaces

- estimate builder and AI estimate assist consume the existing catalog modules through project-estimating surfaces
- `/costbook` shows the workspace foundation, permission boundary, org-scoped catalog counts, and empty/error states
- `/costbook/materials` lists real material API data, shows route loading and load-error states, handles empty catalogs, and exposes create/edit controls only when the authenticated Costbook permission summary includes write access
- `/costbook/labor-rates` lists real labor-rate API data, shows route loading and load-error states, handles empty catalogs, and exposes create/edit controls only when the authenticated Costbook permission summary includes write access
- `/costbook/divisions` renders the Division → Category → Subcategory hierarchy as an expandable tree (loaded in one server pass, not per-level client fetches), with inline create/edit forms and deactivate controls at each level gated on the same Costbook permission summary

## Tests

- `app/tests/cost-database.service.test.ts`
- `app/tests/costbook.service.test.ts`
- `app/tests/costbook.controller.test.ts`
- `app/tests/costbook.migration.test.ts`
- `app/tests/costbook-materials.migration.test.ts`
- `app/tests/costbook-labor-rates.migration.test.ts`
- `app/tests/costbook-hierarchy.migration.test.ts`
- `app/tests/costbook.rls.integration.ts`
- `app/tests/material-price-audit.test.ts`
- `app/tests/assemblies-database.service.test.ts`
- `app/tests/estimate-engine.formulas.test.ts`

## Implementation notes

- C003 extends the existing `labor_rates` table in place with foundational `role`, `description`, `hourlyCost`, `billRate`, and `active` fields rather than creating a second labor catalog table.
- The authenticated Costbook workspace (`app/modules/costbook/*`) is the current first-party UI/API surface for workspace summary, materials catalog, labor-rates foundation, and Division/Category/Subcategory hierarchy management.
- C005 tightens `divisions_write_policy`/`categories_write_policy`/`subcategories_write_policy` from the generic app-wide `current_app_can_write()` (owner/admin/legacy-estimator) to the Costbook-specific `current_app_can_manage_costbook()` (owner/admin only), matching the C002/C003 precedent; legacy estimator loses direct database write access to these three tables as a result.
- `cost-database` and `assemblies-database` services import the shared `round2()` rounding helper from `estimate-engine/formulas.ts` rather than each defining their own private copy (cleanup only; rounding behavior unchanged)

## Known limitations

- system-wide shared template catalogs are not the current model; assemblies are tenant-scoped
- only `name` columns are trigram-indexed today, so combined name-or-code substring search may still scan when the planner has to satisfy the `code` branch
- the current migration uses standard `CREATE INDEX`; future low-lock rollout work would need a separate `CREATE INDEX CONCURRENTLY` strategy if production table size makes that necessary
- RLS impact is none; these indexes change planner choices, not authorization boundaries

## Deferred work

- labor engine
- equipment workflows
- assembly builder
- pricing calculations and pricing rules
- price history beyond current material price audits
- estimate integration snapshots beyond existing estimate line-item references/cost snapshots
- Athena Costbook advisor
- broader supplier ingestion once real feed connectors exist
- evaluate trigram indexing for `code` search paths if substring code lookup becomes a measurable bottleneck

## Follow-up risks (C005)

- **Migration sequencing with pending C004**: as of this merge, PR #128 (C004 equipment catalog) had not yet landed on `main`, so its migration is not present in `app/prisma/migrations`. This PR's migration timestamp (`20260812120000`) sorts after C004's stated timestamp (`20260811150000`), but that ordering has not been verified against the real migration once #128 merges. Reverify apply order and check whether C004 touches `divisions`/`categories`/`subcategories`, `current_app_can_write()`, or `current_app_can_manage_costbook()` in a way that could conflict with the `drop policy` / `create policy` statements in `20260812120000_add_costbook_hierarchy_foundation`.
- **`PATCH .../:id` can set `isActive` under `costbook.write`, while `DELETE` requires the stricter `costbook.manage`**: `updateDivision`/`updateCategory`/`updateSubcategory` (`app/modules/costbook/repository.ts`) write `input.isActive` unconditionally, and the `costbook.write`-gated PATCH schemas (`divisionUpdateSchema`/`categoryUpdateSchema`/`subcategoryUpdateSchema` in `app/backend/controllers/costbook.controller.ts`) accept it. Today `costbook.write` and `costbook.manage` are granted to the same roles (owner/admin only, per `app/domain/contracts.ts`), so this is not currently exploitable, but it is a latent authorization gap: if a future role is ever granted `costbook.write` without `costbook.manage`, it could deactivate or silently reactivate hierarchy rows through PATCH, bypassing the `costbook.manage` boundary the DELETE route enforces. No test currently locks in that PATCH-based `isActive` changes should require the same permission as DELETE.
- **No parent-active check on hierarchy create**: `assertDivisionBelongsToOrganization`/`assertCategoryBelongsToOrganization` (`app/modules/costbook/repository.ts`) validate organization ownership of the parent only, not `isActive`. A caller can create a new active Category under a deactivated Division, or a new active Subcategory under a deactivated Category. Combined with deactivation not cascading (by design, per the PR description), this produces an active-child-of-inactive-parent state that no application layer currently guards against; downstream consumers (estimate builder, assembly builder) must independently defend against it once they start reading this hierarchy.
- **`categories_write_policy`/`subcategories_write_policy` have no explicit `org_id` predicate**: unlike `divisions_write_policy`, which checks `org_id = (select public.current_app_org_id())` directly, the category/subcategory write policies added in `20260812120000_add_costbook_hierarchy_foundation` gate only on `current_app_can_manage_costbook()` plus an `EXISTS` join to the parent row. Cross-organization isolation for these two tables' writes therefore depends entirely on RLS being enforced inside that nested `EXISTS` subquery rather than on an explicit predicate in the policy itself. `app/tests/costbook.rls.integration.ts` currently only exercises the cross-org rejection path through an `UPDATE ... WHERE id = <cross-org id>` (zero-row match) and app-layer parent-ownership checks; there is no RLS-only test that inserts a category/subcategory with a cross-org parent id while bypassing the app-layer `assertDivisionBelongsToOrganization`/`assertCategoryBelongsToOrganization` guard to confirm the database enforces isolation independently.

## Last verified date

2026-08-12
