---
status: current
owner: platform
last_verified: 2026-08-11
source_of_truth: false
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
  - web/src/components/costbook/materials-catalog.tsx
  - app/prisma/migrations/20260811120000_add_costbook_workspace_foundation/migration.sql
  - app/prisma/migrations/20260811130000_restrict_costbook_material_writes/migration.sql
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

C001 adds the Costbook workspace foundation around those existing catalog primitives. C002 adds the first unified Costbook catalog management surface for organization-scoped materials only. It does not add labor-engine rules, equipment workflows, assembly-builder behavior, pricing calculations, estimate integration, price history, supplier sync automation, Athena recommendations, or autonomous writes.

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

`GET /api/v1/costbook/workspace` is a read-only workspace-foundation summary. It requires `costbook.read`, returns Costbook permission flags for the authenticated role, and returns organization-scoped counts for existing catalog records. It does not expose CRUD or pricing workflows.

C002 material routes under the unified Costbook boundary:

- `GET /api/v1/costbook/materials` requires `costbook.read` and lists material DTOs for the authenticated organization only
- `GET /api/v1/costbook/materials/:id` requires `costbook.read` and returns 404 for missing or cross-organization material IDs
- `POST /api/v1/costbook/materials` requires `costbook.write`; accepted fields are `sku`, `name`, `unitOfMeasure`, `unitCost`, `wasteFactorPct`, and optional same-organization `supplierId`
- `PATCH /api/v1/costbook/materials/:id` requires `costbook.write`; accepted fields are the same subset, and unit-cost changes write a manual material price-audit row

The C002 DTO includes `id`, `organizationId`, `sku`, `name`, `unitOfMeasure`, `unitCost`, `wasteFactorPct`, `supplierId`, `supplierName`, `lastPriceUpdate`, `createdAt`, and `updatedAt`. Request bodies are strict; caller-supplied organization IDs and pricing-engine fields are rejected.

C002 reuses the existing `materials` table rather than adding a duplicate material table. Migration `20260811130000_restrict_costbook_material_writes` keeps material reads organization-scoped and tightens material/material-price-audit writes to the existing owner/admin Costbook boundary.

The legacy `/api/v1/materials/*` route group remains mounted for compatibility and shares the same Costbook permission boundary: read-style operations require `costbook.read`, while create/update/delete/bulk-import operations require `costbook.write`.

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
- material archive/deactivate is not exposed in C002 because the existing `Material` schema has no active/archive column
- Costbook workspace foundation state uses `foundation`, `active`, and `archived`; current UI and API use `foundation` unless a future workflow initializes workspace state

## Frontend surfaces

- estimate builder and AI estimate assist consume the existing catalog modules through project-estimating surfaces
- `/costbook` shows the workspace foundation, permission boundary, org-scoped catalog counts, and empty/error states
- `/costbook/materials` lists real material API data, shows route loading and load-error states, handles empty catalogs, and exposes create/edit controls only when the authenticated Costbook permission summary includes write access

## Tests

- `app/tests/cost-database.service.test.ts`
- `app/tests/costbook.service.test.ts`
- `app/tests/costbook.controller.test.ts`
- `app/tests/costbook.migration.test.ts`
- `app/tests/costbook-materials.migration.test.ts`
- `app/tests/costbook.rls.integration.ts`
- `app/tests/material-price-audit.test.ts`
- `app/tests/assemblies-database.service.test.ts`
- `app/tests/estimate-engine.formulas.test.ts`

## Implementation notes

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

## Last verified date

2026-08-11
