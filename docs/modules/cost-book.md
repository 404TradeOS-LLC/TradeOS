---
status: current
owner: platform
last_verified: 2026-08-14
source_of_truth: true
related_code:
  - app/modules/cost-database
  - app/modules/labor-database
  - app/modules/material-database
  - app/modules/equipment-database
  - app/modules/assemblies-database
  - app/modules/costbook
  - app/backend/controllers/costDatabase.controller.ts
  - app/backend/routes/costbook.routes.ts
  - web/src/app/(app)/costbook/page.tsx
  - web/src/app/(app)/costbook/materials/page.tsx
  - web/src/app/(app)/costbook/equipment/page.tsx
  - web/src/app/(app)/costbook/divisions/page.tsx
  - web/src/app/(app)/costbook/cost-items/page.tsx
  - web/src/components/costbook/materials-catalog.tsx
  - web/src/components/costbook/equipment-catalog.tsx
  - web/src/components/costbook/hierarchy-catalog.tsx
  - web/src/components/costbook/cost-item-catalog.tsx
  - app/prisma/migrations/20260811120000_add_costbook_workspace_foundation/migration.sql
  - app/prisma/migrations/20260811130000_restrict_costbook_material_writes/migration.sql
  - app/prisma/migrations/20260811150000_restrict_costbook_equipment_writes/migration.sql
  - app/prisma/migrations/20260812120000_add_costbook_hierarchy_foundation/migration.sql
  - app/prisma/migrations/20260812173000_harden_costbook_hierarchy_rls/migration.sql
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

The unified Costbook boundary now covers the workspace summary, materials, labor rates, equipment, hierarchy management, and first-class CostItem management while reusing the original catalog tables and services. Division/Category/Subcategory management is complete under the unified boundary, and CostItems can be listed, read, created, edited, soft-deactivated, and priced there without introducing a second CostItem model or pricing engine. Assembly CRUD/composition still exists only through the legacy assemblies route group; a first-class Costbook assembly-management surface remains the next catalog-management gap. Existing Estimate and structured AI-estimator paths already consume organization-scoped CostItems/Assemblies and write reviewed lines through the Estimate Engine, but a dedicated historical-pricing/provenance verification slice remains after assembly management.

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

Compatibility route groups remain mounted:

- `/api/v1/cost-database/*`
- `/api/v1/labor-rates/*`
- `/api/v1/materials/*`
- `/api/v1/equipment/*`
- `/api/v1/assemblies/*`

Unified Costbook routes include:

- `/api/v1/costbook/workspace`
- `/api/v1/costbook/materials`
- `/api/v1/costbook/materials/:id`
- `/api/v1/costbook/labor-rates`
- `/api/v1/costbook/labor-rates/:id`
- `/api/v1/costbook/equipment`
- `/api/v1/costbook/equipment/:id`
- `/api/v1/costbook/divisions`
- `/api/v1/costbook/divisions/:id`
- `/api/v1/costbook/categories`
- `/api/v1/costbook/categories/:id`
- `/api/v1/costbook/subcategories`
- `/api/v1/costbook/subcategories/:id`
- `/api/v1/costbook/cost-items`
- `/api/v1/costbook/cost-items/search`
- `/api/v1/costbook/cost-items/:id`
- `/api/v1/costbook/cost-items/:id/unit-cost`

`GET /api/v1/costbook/workspace` is a read-only workspace summary. It requires `costbook.read`, returns Costbook permission flags for the authenticated role, and returns organization-scoped counts for existing catalog records.

### Materials

- `GET /api/v1/costbook/materials` and `GET /api/v1/costbook/materials/:id` require `costbook.read`.
- `POST /api/v1/costbook/materials` and `PATCH /api/v1/costbook/materials/:id` require `costbook.write`.
- Material request bodies are strict and do not accept caller-supplied organization IDs.
- Unit-cost changes use the existing material price-audit behavior.

The material DTO includes `id`, `organizationId`, `sku`, `name`, `unitOfMeasure`, `unitCost`, `wasteFactorPct`, `supplierId`, `supplierName`, `lastPriceUpdate`, `createdAt`, and `updatedAt`. The existing `materials` table is reused; no duplicate table exists.

### Labor rates

- `GET /api/v1/costbook/labor-rates` and `GET /api/v1/costbook/labor-rates/:id` require `costbook.read`.
- `POST` and `PATCH` require `costbook.write`.
- `DELETE /api/v1/costbook/labor-rates/:id` requires `costbook.manage` and soft-deactivates by setting `active=false`.

The unified labor-rate shape uses `role`, optional `description`, `hourlyCost`, `billRate`, and `active` while retaining compatibility fields required by legacy pricing code.

### Equipment

- `GET /api/v1/costbook/equipment` and `GET /api/v1/costbook/equipment/:id` require `costbook.read`.
- `POST` and `PATCH` require `costbook.write`.
- `DELETE` requires `costbook.manage`.
- The existing organization-scoped `equipment` table is reused; hourly cost remains derived from ownership plus operating cost.

### Hierarchy

- `GET /api/v1/costbook/divisions`, `GET /api/v1/costbook/categories?divisionId=`, and `GET /api/v1/costbook/subcategories?categoryId=` require `costbook.read` and list organization-scoped DTOs.
- `GET .../:id` requires `costbook.read` and returns 404 for missing or cross-organization IDs.
- `POST` requires `costbook.write`; category/subcategory parent IDs are validated against the authenticated organization.
- Ordinary `PATCH .../:id` fields require `costbook.write`; any PATCH carrying `isActive` additionally requires `costbook.manage`.
- `DELETE .../:id` requires `costbook.manage` and soft-deactivates the row.
- Parent-derived RLS and active-parent/active-child integrity remain enforced by the merged hierarchy hardening migration.

### Cost items

The first-class Costbook CostItem surface reuses `CostDatabaseService` and the existing `CostItem` model; the legacy `/api/v1/cost-database/cost-items/*` endpoints remain compatibility aliases over the same implementation.

- `GET /api/v1/costbook/cost-items` requires `costbook.read` and returns active organization-scoped CostItems; optional `q` uses the existing name-or-code search behavior.
- `GET /api/v1/costbook/cost-items/search` requires `costbook.read` and uses the same active organization-scoped search.
- `GET /api/v1/costbook/cost-items/:id` requires `costbook.read` and returns 404 for missing/cross-organization IDs.
- `GET /api/v1/costbook/cost-items/:id/unit-cost` requires `costbook.read`; optional `quantity` and same-organization `regionId` feed the existing relationship-derived labor/material/equipment calculation.
- `POST /api/v1/costbook/cost-items` requires `costbook.write`.
- `PATCH /api/v1/costbook/cost-items/:id` requires `costbook.write`; a PATCH that includes `isActive` additionally requires `costbook.manage`.
- `DELETE /api/v1/costbook/cost-items/:id` requires `costbook.manage` and soft-deactivates the row so historical Estimate references are preserved.

Create requests accept strict `subcategoryId`, `code`, `name`, and `unitOfMeasure` fields plus optional `productionRate`, `laborRateId`, `materialId`, `equipmentId`, `subcontractorId`, and `notes`. The organization is always derived from the authenticated session. Service-level validation rejects a subcategory or linked pricing record that is outside the authenticated organization before the write reaches Prisma/RLS. Update does not re-parent a CostItem; nullable pricing inputs can be explicitly cleared so an edit does not silently retain stale labor/material/equipment/production-rate inputs.

Cost remains derived rather than stored as a flat CostItem price. `UnitCostBreakdown` continues to compose labor, material, and equipment costs using the shared Estimate Engine formulas.

## Permissions

See [RBAC_MATRIX.md](../RBAC_MATRIX.md).

Costbook-specific permission keys:

- `costbook.read`
- `costbook.write`
- `costbook.manage`

Current behavior:

- owner/admin: full Costbook permissions
- dispatcher, technician, and legacy estimator: read-only Costbook access
- legacy viewer: no Costbook access
- lifecycle activation/deactivation requires `costbook.manage`; ordinary editable fields remain under `costbook.write`

## Lifecycle and statuses

- assemblies may be marked `isTemplate` for reusable quick-add behavior
- materials participate in supplier review queue history through related audit records
- labor rates use `active`; delete is soft deactivate
- material archive/deactivate is not exposed because the existing `Material` schema has no active/archive column
- Costbook workspace foundation state uses `foundation`, `active`, and `archived`
- Division/Category/Subcategory use `isActive`; API delete is soft deactivate and active descendants cannot be stranded beneath inactive parents
- CostItem uses `isActive`; API delete is soft deactivate so historical Estimate/Change Order references remain valid

## Frontend surfaces

- Estimate Builder and AI Estimate Assist already consume existing organization-scoped CostItems/Assemblies through estimating services; this is not proof that every historical-pricing/provenance edge case is complete
- `/costbook` shows the workspace summary, permissions, organization-scoped catalog counts, and links to implemented management surfaces
- `/costbook/materials` provides real-data material management
- `/costbook/labor-rates` provides real-data labor-rate management
- `/costbook/equipment` provides real-data equipment management
- `/costbook/divisions` renders Division → Category → Subcategory management
- `/costbook/cost-items` provides real-data CostItem create/edit/deactivate management, read-only behavior for actors without writes, responsive desktop/mobile presentation, and honest empty/load/error/mutation states
- no first-class `/costbook/assemblies` management page exists yet; assemblies remain available through the legacy API and estimating consumers

## Tests

- `app/tests/cost-database.service.test.ts`
- `app/tests/cost-database.tenant-references.test.ts`
- `app/tests/costbook-cost-items.rls.integration.ts`
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

- The authenticated Costbook workspace is a compatibility-preserving boundary around existing catalog tables/services, not a parallel pricing domain.
- `cost-database` and `assemblies-database` services import the shared `round2()` helper from `estimate-engine/formulas.ts` rather than defining private rounding behavior.
- CostItem write validation is defense in depth over existing RLS: application checks give deterministic client errors while RLS remains the database-level tenant boundary.
- Existing Estimate line records remain historical records; changing/deactivating a CostItem does not mutate already-created Estimate lines in this CostItem-management slice.

## Known limitations

- system-wide shared template catalogs are not the current model; assemblies are tenant-scoped
- only `name` columns are trigram-indexed today, so combined name-or-code substring search may still scan when the planner has to satisfy the `code` branch
- supplier feed connectors are not live
- assembly management has not yet been promoted into the first-class Costbook workspace
- Estimate-to-Costbook historical pricing/provenance needs a dedicated verification slice after assembly management; this task does not change Estimate mutation semantics

## Deferred work

- first-class Costbook assembly management
- pricing calculations and markup/rules foundation beyond the existing component-cost formulas
- Estimate ↔ Costbook provenance/snapshot verification after assembly management
- price history beyond current material price audits
- supplier synchronization once real feed connectors exist
- Athena Costbook recommendations/writes only after non-Athena Costbook dependencies are complete and governed
- evaluate trigram indexing for `code` search paths if substring code lookup becomes a measurable bottleneck

## Last verified date

2026-08-14
