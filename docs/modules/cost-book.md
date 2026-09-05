---
status: current
owner: platform
last_verified: 2026-08-29
source_of_truth: true
related_code:
  - app/modules/cost-database
  - app/modules/labor-database
  - app/modules/material-database
  - app/modules/equipment-database
  - app/modules/assemblies-database
  - app/modules/costbook
  - app/modules/athena-tools/costbook
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

The unified Costbook boundary covers the workspace summary, materials, labor rates, equipment, hierarchy management, CostItem management, and Assembly management while reusing the original catalog tables and services. Assemblies can be managed and composed through the canonical Costbook namespace without introducing a second Assembly model or pricing engine. The existing Estimate Engine remains the Costbook consumption path: persisted CostItem/Assembly IDs provide provenance and persisted `unitCost`/`lineCost` values are historical pricing snapshots. Practical pricing preview reuses the shared Estimate formulas, and the price-history read model keeps `MaterialPriceAudit` catalog changes distinct from Estimate snapshots. Supplier synchronization reuses the existing proposal/review/audit workflow and never auto-applies feed prices.

Athena A12 also exposes three read-only Costbook Intelligence tools under `app/modules/athena-tools/costbook`: catalog lookup, margin analysis, and price recommendation. They are thin wrappers over `CostDatabaseService`, `AssembliesDatabaseService`, and the shared Estimate formula helpers. They do not reach Prisma directly, do not expose write-capable Costbook service methods, and do not mutate CostItem, Material, Assembly, pricing-policy, or supplier data. Athena Costbook mutation remains outside the landed architecture.

## Source code locations

- `app/modules/cost-database/*`
- `app/modules/labor-database/*`
- `app/modules/material-database/*`
- `app/modules/equipment-database/*`
- `app/modules/assemblies-database/*`
- `app/modules/costbook/*`
- `app/modules/athena-tools/costbook/*` for read-only Athena Costbook Intelligence adapters

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
- `/api/v1/costbook/assemblies`
- `/api/v1/costbook/assemblies/search`
- `/api/v1/costbook/assemblies/templates`
- `/api/v1/costbook/assemblies/:id`
- `/api/v1/costbook/assemblies/:id/unit-cost`
- `/api/v1/costbook/assemblies/:id/items`
- `/api/v1/costbook/pricing/preview`
- `/api/v1/costbook/price-history`

`GET /api/v1/costbook/workspace` is a read-only workspace summary. It requires `costbook.read`, returns Costbook permission flags for the authenticated role, and returns organization-scoped counts for existing catalog records.

All canonical Costbook collection reads use `{ items, total, nextCursor }`.
`limit` defaults to 25 and is capped at 100; `cursor`, `q`, an allowlisted
`sort`, and `order` are shared query fields. Cursors are opaque, deterministic
keyset tokens bound to organization, filters, search, and ordering. Totals are
computed before the cursor predicate. Resource-specific filters are validated
by each controller and remain organization-scoped; caller-supplied `orgId` is
never accepted. Typeahead compatibility routes under CostItem and Assembly
`/search` intentionally retain bounded plain arrays for existing AI/estimate
consumers.

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

- `GET /api/v1/costbook/cost-items` requires `costbook.read` and returns a paginated organization-scoped CostItem catalog; `q`, `active`, `subcategoryId`, and supported component-type filters execute server-side, with safe `code`, `name`, `createdAt`, and `updatedAt` sorting.
- `GET /api/v1/costbook/cost-items/search` requires `costbook.read` and uses the same active organization-scoped search.
- `GET /api/v1/costbook/cost-items/:id` requires `costbook.read` and returns 404 for missing/cross-organization IDs.
- `GET /api/v1/costbook/cost-items/:id/unit-cost` requires `costbook.read`; optional `quantity` and same-organization `regionId` feed the existing relationship-derived labor/material/equipment calculation.
- `POST /api/v1/costbook/cost-items` requires `costbook.write`.
- `PATCH /api/v1/costbook/cost-items/:id` requires `costbook.write`; a PATCH that includes `isActive` additionally requires `costbook.manage`.
- `DELETE /api/v1/costbook/cost-items/:id` requires `costbook.manage` and soft-deactivates the row so historical Estimate references are preserved.

Create requests accept strict `subcategoryId`, `code`, `name`, and `unitOfMeasure` fields plus optional `productionRate`, `laborRateId`, `materialId`, `equipmentId`, `subcontractorId`, and `notes`. The organization is always derived from the authenticated session. Service-level validation rejects a subcategory or linked pricing record that is outside the authenticated organization before the write reaches Prisma/RLS. Update does not re-parent a CostItem; nullable pricing inputs can be explicitly cleared so an edit does not silently retain stale labor/material/equipment/production-rate inputs.

Cost remains derived rather than stored as a flat CostItem price. `UnitCostBreakdown` continues to compose labor, material, and equipment costs using the shared Estimate Engine formulas.

### Assemblies, pricing, history, and supplier feeds

The unified Assembly surface reuses `AssembliesDatabaseService` and the existing `Assembly`/`AssemblyItem` models. Reads require `costbook.read`; ordinary Assembly/component edits require `costbook.write`; lifecycle deactivation requires `costbook.manage`. New components must be active and belong to the authenticated organization, cycle prevention remains enforced, and the database independently validates the parent Assembly plus referenced CostItem/child Assembly tenant scope.

`POST /api/v1/costbook/pricing/preview` requires `costbook.read` and is calculation-only. It reuses shared Estimate overhead/markup/target-margin formulas and persists no pricing policy. `GET /api/v1/costbook/price-history` requires `costbook.manage` and returns independent paginated `materialChanges` and `estimateSnapshots` streams, each with its own total and cursor. Supplier feed transport accepts only trusted server-side HTTPS endpoint configuration, validates feed payloads, and enqueues pending proposals into the existing review flow; Material prices are changed only through approval, which remains transactional with `MaterialPriceAudit`. The supplier review queue uses the same page contract with status/supplier/material filters.

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

- Estimate Builder and AI Estimate Assist consume existing organization-scoped CostItems/Assemblies through estimating services; Estimate lines preserve the source IDs and pricing values captured at line creation
- `/costbook` shows the workspace summary, permissions, organization-scoped catalog counts, and links to implemented management surfaces
- `/costbook/materials` provides real-data material management
- `/costbook/labor-rates` provides real-data labor-rate management
- `/costbook/equipment` provides real-data equipment management
- `/costbook/divisions` renders Division → Category → Subcategory management
- `/costbook/cost-items` provides real-data CostItem create/edit/deactivate management, read-only behavior for actors without writes, responsive desktop/mobile presentation, and honest empty/load/error/mutation states
- `/costbook/assemblies` provides Assembly create/edit/deactivate, component composition, template state, current unit-cost display, and permission-aware states
- `/costbook/pricing` provides a calculation-only pricing preview
- `/costbook/price-history` separates audited Material price changes from Estimate pricing snapshots

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
- `app/tests/costbook-assemblies.rls.integration.ts`
- `app/tests/costbook-pricing.test.ts`
- `app/tests/estimate-costbook-snapshot.test.ts`
- `app/tests/supplier-integration.feed.test.ts`

## Implementation notes

- The authenticated Costbook workspace is a compatibility-preserving boundary around existing catalog tables/services, not a parallel pricing domain.
- `cost-database` and `assemblies-database` services import the shared `round2()` helper from `estimate-engine/formulas.ts` rather than defining private rounding behavior.
- CostItem and Assembly write validation are defense in depth over RLS: application checks give deterministic client errors while RLS remains the database-level tenant boundary.
- Existing Estimate line records are historical pricing snapshots; recalculation does not re-fetch current Costbook unit cost for existing lines, while newly added lines capture current Costbook/Assembly pricing.
- Athena Costbook Intelligence is currently read-only/recommendation-only: `lookup` uses CostItem/Assembly search services, while `analyzeMargin` and `recommendPrice` use `CostDatabaseService.getUnitCost()` plus the shared Estimate formula helpers. These tools do not define new pricing math or write through Costbook services.

## Known limitations

- system-wide shared template catalogs are not the current model; assemblies are tenant-scoped
- only `name` columns are trigram-indexed today, so combined name-or-code substring search may still scan when the planner has to satisfy the `code` branch
- supplier feed transport requires explicit operator configuration per Supplier; no supplier-SKU matching layer is implemented
- pricing preview is not a persisted organization-wide pricing-policy/rules system
- Material price-audit events and Estimate snapshots remain intentionally distinct history concepts

## Deferred work

- persisted organization pricing-policy/rule governance if repository evidence justifies it
- richer supplier-specific connectors and matching beyond the generic trusted-feed transport
- expanded historical pricing analytics/filters beyond the current read model
- Athena Costbook writes or autonomous Costbook mutation only after the existing approval/risk/governance boundaries explicitly authorize such behavior; the current Athena Costbook tools are read-only/recommendation-only
- evaluate trigram indexing for `code` search paths if substring code lookup becomes a measurable bottleneck

## Last verified date

2026-08-29
