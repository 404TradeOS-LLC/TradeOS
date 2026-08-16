---
status: current
owner: platform
last_verified: 2026-08-15
source_of_truth: true
related_code:
  - app/modules/costbook
  - app/modules/cost-database
  - app/modules/assemblies-database
  - app/modules/estimate-engine
  - app/modules/supplier-integration
  - app/backend/controllers/costbook.controller.ts
  - app/backend/controllers/costDatabase.controller.ts
  - app/backend/controllers/costbookPricing.controller.ts
  - app/backend/controllers/assembliesDatabase.controller.ts
  - app/backend/controllers/supplierIntegration.controller.ts
  - app/backend/routes/costbook.routes.ts
  - app/backend/routes/assembliesDatabase.routes.ts
  - app/prisma/schema.prisma
  - app/prisma/migrations/20260811120000_add_costbook_workspace_foundation/migration.sql
  - app/prisma/migrations/20260811130000_restrict_costbook_material_writes/migration.sql
  - app/prisma/migrations/20260811140000_add_costbook_labor_rates_foundation/migration.sql
  - app/prisma/migrations/20260811150000_restrict_costbook_equipment_writes/migration.sql
  - app/prisma/migrations/20260812120000_add_costbook_hierarchy_foundation/migration.sql
  - app/prisma/migrations/20260812173000_harden_costbook_hierarchy_rls/migration.sql
  - app/prisma/migrations/20260814221000_restrict_costbook_assembly_writes/migration.sql
  - web/src/app/(app)/costbook
  - web/src/components/costbook
---

# Costbook Domain Architecture

## Purpose

Costbook is the authenticated, organization-scoped catalog and pricing-intelligence surface for TradeOS estimating data. The current implementation extends and coordinates the existing catalog, Assembly, Estimate, material-price-audit, and supplier-review systems rather than introducing parallel models or a second pricing engine.

Current implementation truth remains in [CURRENT_STATE.md](../CURRENT_STATE.md), [API_REFERENCE.md](../API_REFERENCE.md), and [modules/cost-book.md](../modules/cost-book.md).

## Layering

Most Costbook workspace paths follow the standard TradeOS flow:

```text
Route / Controller
  -> domain service
    -> repository or existing domain service
      -> Prisma / PostgreSQL with forced RLS
```

The canonical `/api/v1/costbook/*` namespace is intentionally an integration boundary over existing domain implementations. It does not require every catalog type to be reimplemented under `app/modules/costbook`.

Examples:

- workspace, materials, labor rates, equipment, and hierarchy use `costbook.controller.ts` and `app/modules/costbook/*`
- Cost Items reuse `costDatabaseController` and `app/modules/cost-database/*`
- Assemblies reuse `assembliesDatabase.controller.ts` and `app/modules/assemblies-database/*`
- pricing preview uses `costbookPricing.controller.ts` and shared Estimate pricing formulas
- supplier-feed ingestion reuses `app/modules/supplier-integration/*` and the existing proposal/review/audit flow

This reuse is deliberate RC1 architecture, not a temporary duplicate subsystem.

## Authorization and tenancy

Every Costbook request depends on:

1. bearer-token authentication
2. organization-membership resolution
3. request-scoped PostgreSQL session variables
4. forced row-level security in PostgreSQL

The route/controller layer applies the Costbook-specific permission boundary:

- `costbook.read` for list/detail reads and calculation-only pricing preview
- `costbook.write` for ordinary create/update/component edits
- `costbook.manage` for lifecycle activation/deactivation, destructive/admin operations, and price-history access

The database layer reinforces organization and write boundaries with forced RLS and `public.current_app_can_manage_costbook()` where applicable. Parent-derived hierarchy policies and Assembly write policies independently validate tenant relationships instead of trusting route filtering alone.

## Current workspace scope

The authenticated Costbook workspace under `/api/v1/costbook/*` and `/costbook/*` includes:

- workspace summary and permission surface
- materials catalog management
- labor-rate management
- equipment catalog management
- Division/Category/Subcategory hierarchy management
- Cost Item catalog management
- Assembly management and component composition
- calculation-only pricing preview
- price-history reads that separate catalog price changes from Estimate snapshots

### Materials

Materials reuse the existing organization-scoped `Material` model. Reads require `costbook.read`; ordinary writes require `costbook.write`. Unit-cost changes continue to create the existing material price-audit records. No duplicate material table is introduced.

### Labor rates

Labor rates reuse the shared `labor_rates` table and compatibility fields required by legacy pricing code. Reads require `costbook.read`, ordinary writes require `costbook.write`, and delete is a `costbook.manage` soft-deactivation through `active=false`.

No separate labor-burden or labor-rollup subsystem is introduced by the Costbook workspace.

### Equipment

Equipment management reuses the existing organization-scoped `Equipment` model. Reads require `costbook.read`, ordinary writes require `costbook.write`, and removal requires `costbook.manage`. Hourly cost remains derived from ownership plus operating cost; Costbook does not create a parallel equipment-rate database.

### Hierarchy

Division, Category, and Subcategory management uses the existing hierarchy models. Division scopes directly by organization; Category and Subcategory inherit organization scope through parent relationships. Ordinary edits require `costbook.write`; `isActive` transitions and delete require `costbook.manage` and remain soft-deactivation behavior.

Parent-derived RLS plus active-parent/active-child integrity prevent cross-organization hierarchy writes and active descendants beneath inactive ancestors.

### Cost Items

The canonical Costbook Cost Item surface deliberately reuses `CostDatabaseService` and the existing `CostItem` model. `/api/v1/costbook/cost-items/*` is the primary Costbook namespace, while `/api/v1/cost-database/cost-items/*` remains a compatibility surface over the same implementation.

Cost Item pricing remains derived from linked labor/material/equipment relationships rather than stored as a second flat price. The shared Estimate formulas remain authoritative for cost calculation. Cost Item delete is soft-deactivation so historical Estimate references remain valid.

### Assemblies

The canonical Assembly surface reuses the existing `Assembly` and `AssemblyItem` models and `AssembliesDatabaseService`; it does not add a second Assembly model. Reads require `costbook.read`, ordinary Assembly/component edits require `costbook.write`, and lifecycle deactivation requires `costbook.manage`.

Assembly composition validates active, same-organization CostItem/child-Assembly references, retains cycle prevention, and is reinforced by database tenant checks. Template state remains part of the existing Assembly model.

### Estimate integration and pricing snapshots

Costbook does not replace the Estimate Engine. Estimates remain the consumption boundary for Cost Items and Assemblies.

Persisted Estimate lines retain source CostItem/Assembly provenance while captured `unitCost` and `lineCost` values preserve historical pricing snapshots. Later Costbook catalog changes do not retroactively rewrite those saved Estimate prices.

### Pricing preview

`POST /api/v1/costbook/pricing/preview` is calculation-only. It reuses the shared Estimate overhead, markup, and target-margin formulas and does not persist organization-wide pricing policy or pricing-rule state.

Persisted organization-wide pricing governance remains outside the landed architecture.

### Price history

`GET /api/v1/costbook/price-history` requires `costbook.manage` and presents two intentionally distinct histories:

- true catalog price changes from `MaterialPriceAudit`
- persisted Estimate pricing snapshots

These histories are not collapsed into a synthetic single ledger because they represent different business facts.

### Supplier feeds

Trusted supplier-feed transport reuses the existing supplier integration proposal/review/audit workflow. Feed endpoints are server-side configuration, restricted to trusted HTTPS transport, and payloads are validated before proposals are queued.

Supplier feeds do not directly mutate Material prices. Feed results become pending review proposals; Material price changes occur only through the existing approval path, which preserves Material price-audit behavior.

Provider-specific connectors, supplier-SKU matching, and autonomous price application are not part of the landed architecture.

## Legacy compatibility

Older catalog route groups remain mounted during RC1, including:

- `/api/v1/cost-database/*`
- `/api/v1/labor-rates/*`
- `/api/v1/materials/*`
- `/api/v1/equipment/*`
- `/api/v1/assemblies/*`

The authenticated Costbook namespace is the unified product-facing boundary, but compatibility routes continue to reuse the same underlying models/services. They are not separate sources of truth.

## Web surface

The current authenticated Costbook web surface on `main` is:

- `/costbook`
- `/costbook/materials`
- `/costbook/labor-rates`
- `/costbook/equipment`
- `/costbook/divisions`
- `/costbook/cost-items`
- `/costbook/assemblies`
- `/costbook/pricing`
- `/costbook/price-history`

The workspace uses authenticated backend data, reusable Costbook components, permission-aware controls, and explicit loading, empty, error, read-only, and mutation states.

## Boundaries that remain intentionally unimplemented

Current merged architecture does **not** imply:

- persisted organization-wide pricing policies or pricing-rule governance
- supplier-SKU matching or provider-specific supplier connectors
- automatic supplier price application
- Athena Costbook writes or autonomous Costbook mutation
- regional pricing policy
- a second Costbook-specific Estimate engine

Those remain future work unless and until separately implemented, reviewed, and merged.
