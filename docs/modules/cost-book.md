---
status: current
owner: platform
last_verified: 2026-08-15
source_of_truth: true
related_code:
  - app/modules/cost-database
  - app/modules/labor-database
  - app/modules/material-database
  - app/modules/equipment-database
  - app/modules/assemblies-database
  - app/modules/costbook
  - app/modules/supplier-integration
  - app/backend/controllers/costDatabase.controller.ts
  - app/backend/controllers/assembliesDatabase.controller.ts
  - app/backend/controllers/costbookPricing.controller.ts
  - app/backend/routes/costbook.routes.ts
  - app/prisma/migrations/20260814221000_restrict_costbook_assembly_writes/migration.sql
  - web/src/app/(app)/costbook
  - web/src/components/costbook
---

# Cost Book

## Purpose

Provide the tenant-scoped estimating catalog and practical pricing workspace for divisions, categories, subcategories, cost items, labor rates, materials, equipment, assemblies, pricing previews, price history, and governed supplier-price review.

The unified Costbook boundary reuses the repository's original catalog models and services. It does not create parallel CostItem, Assembly, Estimate-pricing, price-history, or supplier-integration systems.

## Canonical models and existing systems

- `Division`, `Category`, `Subcategory`, `CostItem`
- `LaborRate`, `Material`, `Equipment`
- `Assembly`, `AssemblyItem`
- `CostbookWorkspace`, `CostbookWorkspaceEvent`
- `MaterialPriceAudit` for actual material-price changes
- `EstimateLineItem` persisted source/pricing values for historical estimate-consumption snapshots
- `SupplierPriceUpdate` plus the existing SupplierIntegrationService queue/review/worker/scheduler for governed supplier updates

## Canonical Costbook routes

The unified namespace is `/api/v1/costbook`. Legacy catalog route groups remain compatibility surfaces over the same underlying models/services.

### Workspace and catalogs

- `GET /workspace` — `costbook.read`
- materials, labor rates, equipment, hierarchy, and CostItem routes retain the established `costbook.read` / `costbook.write` / `costbook.manage` split
- CostItem create/update validates same-organization hierarchy/catalog references and never accepts caller-controlled organization IDs
- an explicit CostItem `regionId` that is missing or belongs to another organization fails closed with 404 rather than falling back to another multiplier

PR #210 (`3c3037faf5c7c3b4f3660b6f43cc6a3b90372e4e`) is the merged canonical CostItem-management slice.

### Assemblies

The first-class Assembly surface promotes the existing `Assembly`/`AssemblyItem` implementation; it does not add another assembly model or costing engine.

- `GET /assemblies` — list active organization-scoped assemblies
- `GET /assemblies/search`
- `GET /assemblies/templates`
- `GET /assemblies/:id`
- `GET /assemblies/:id/unit-cost`
- `GET /assemblies/:id/items`
- `POST /assemblies`
- `PATCH /assemblies/:id`
- `DELETE /assemblies/:id`
- `POST /assemblies/:id/items`
- `DELETE /assemblies/:id/items/:itemId`

Reads require `costbook.read`. Ordinary create/edit/composition mutations require `costbook.write`. Lifecycle/deactivation operations require `costbook.manage`.

Assembly composition accepts either an active same-organization CostItem or an active same-organization child Assembly. Cycle prevention remains enforced. Recursive unit-cost evaluation tracks the current recursion path so real cycles fail while legitimate DAG reuse remains valid.

Migration `20260814221000_restrict_costbook_assembly_writes` tightens Assembly writes to the Costbook management RLS boundary and validates AssemblyItem tenant relationships at the database layer. An AssemblyItem must reference exactly one source: a CostItem or a child Assembly. Cross-organization parent/source relationships are rejected by RLS/constraints even if application validation is bypassed.

Frontend: `/costbook/assemblies` exposes real catalog data, create/edit/deactivate, template state, component composition, current unit-cost display, loading/error/empty states, and permission-aware controls.

### Estimate provenance and historical snapshots

The existing Estimate Engine remains the only Estimate/Costbook integration path.

For a Costbook-backed `EstimateLineItem`:

- `costItemId` or `assemblyId` is the persisted source provenance
- `unitCost` and `lineCost` are the persisted historical pricing snapshot
- recalculation of existing lines uses the persisted line values and does not re-fetch current Costbook pricing
- later changes to a CostItem, Material, or Assembly do not silently reprice an existing Estimate line
- a newly added CostItem/Assembly line resolves current pricing at creation time and persists that snapshot
- duplicate/version operations preserve the source IDs and stored pricing values

See `app/tests/estimate-costbook-snapshot.test.ts` and [estimating.md](estimating.md).

### Practical pricing preview

`POST /pricing/preview` is a calculation-only Costbook surface requiring `costbook.read`.

It reuses `app/modules/estimate-engine/formulas.ts` for overhead, markup, target margin, margin/markup conversion, sell price, and rounding. It accepts finite nonnegative cost inputs, supports either markup or target-margin mode, and returns calculated total cost, sell price, gross profit, and effective markup/margin values.

No pricing-policy or pricing-rule row is persisted. `/costbook/pricing` is therefore labeled as a calculator/preview, not organization-wide saved pricing policy.

### Price history

`GET /price-history` requires `costbook.manage` and provides one read model with two explicitly different result classes:

1. **Material price changes** — actual catalog changes from `MaterialPriceAudit`, including old/new cost, source, actor, and timestamp where available.
2. **Estimate snapshots** — historical Estimate consumption observations from persisted CostItem/Assembly-backed `EstimateLineItem` rows, including source, quantity, unit cost, line cost, and estimate context.

An Estimate snapshot is not described as a catalog price-change event. The route supports bounded tenant-scoped filters for material, estimate, source type, date range, and limit. Frontend: `/costbook/price-history`.

### Supplier synchronization

The existing SupplierIntegrationService queue/review/audit/worker/scheduler remains canonical. The continuation adds only the missing generic feed transport.

Trusted endpoints come from server-side `SUPPLIER_PRICE_FEED_ENDPOINTS`, keyed by Supplier ID. Request callers cannot provide arbitrary URLs, and `Supplier.website` is never used as an API endpoint. Configured feeds must use HTTPS, redirects are rejected, credentials remain server-side, payloads are strictly validated and bounded, and requests have timeout/response-size limits.

The feed contract is deliberately minimal: each quote identifies a TradeOS `materialId` and a proposed unit cost. There is no supplier-SKU matching layer in this slice.

Feed synchronization only enqueues pending `SupplierPriceUpdate` proposals. It never mutates `Material.unitCost` directly. Owner/admin review remains required for approval, and approved changes continue through the existing transactional Material update plus `MaterialPriceAudit` write. Missing feed configuration is an honest unconfigured/no-op state.

## Permissions

See [RBAC_MATRIX.md](../RBAC_MATRIX.md).

Costbook permission keys:

- `costbook.read`
- `costbook.write`
- `costbook.manage`

Current canonical roles map owner/admin to full Costbook access and dispatcher/technician to read-only Costbook access. Sensitive audit/history and lifecycle/governance operations use `costbook.manage`.

## Frontend workspace

Implemented Costbook routes are reachable from `/costbook`:

- `/costbook/materials`
- `/costbook/labor-rates`
- `/costbook/equipment`
- `/costbook/divisions`
- `/costbook/cost-items`
- `/costbook/assemblies`
- `/costbook/pricing`
- `/costbook/price-history`

Pricing and price history are not labeled “Future” once their foundation/read-model surfaces are implemented. Supplier synchronization is not presented as configured for every Supplier merely because the adapter exists.

## Tests

Relevant coverage includes:

- `app/tests/cost-database.service.test.ts`
- `app/tests/cost-database.tenant-references.test.ts`
- `app/tests/costbook-cost-items.rls.integration.ts`
- `app/tests/costbook-assemblies.rls.integration.ts`
- `app/tests/assemblies-database.service.test.ts`
- `app/tests/costbook-pricing.test.ts`
- `app/tests/estimate-costbook-snapshot.test.ts`
- `app/tests/material-price-audit.test.ts`
- `app/tests/supplier-integration.service.test.ts`
- `app/tests/supplier-integration.feed.test.ts`
- existing Costbook migration/RLS/controller/service suites

## Known limitations / intentionally deferred

- practical pricing is calculation-only; persisted organization pricing policies/rules are not implemented
- the price-history surface is a read model over real audit/snapshot data, not a new generic history event table
- supplier feeds require trusted operator configuration and already-resolved `materialId` values; supplier SKU matching is not implemented
- supplier feeds never auto-apply catalog prices
- system-wide shared template catalogs are not the current model; assemblies remain tenant-scoped
- name-or-code substring searches may need additional `code` indexes if measured query plans justify them
- no Athena Costbook write/recommendation expansion is introduced by this cohort

## Last verified date

2026-08-15
