---
status: current
owner: platform
last_verified: 2026-08-11
source_of_truth: true
related_code:
  - app/modules/costbook
  - app/backend/controllers/costbook.controller.ts
  - app/backend/routes/costbook.routes.ts
  - app/prisma/schema.prisma
  - app/prisma/migrations/20260811120000_add_costbook_workspace_foundation/migration.sql
  - app/prisma/migrations/20260811130000_restrict_costbook_material_writes/migration.sql
  - app/prisma/migrations/20260811140000_add_costbook_labor_rates_foundation/migration.sql
  - web/src/app/(app)/costbook
  - web/src/components/costbook
---

# Costbook Domain Architecture

## Purpose

Costbook is the authenticated, organization-scoped catalog surface for TradeOS
estimating data. The current implementation extends the existing catalog tables
through the Costbook workspace layer rather than introducing a parallel pricing
subsystem.

Current implementation truth remains in [CURRENT_STATE.md](../CURRENT_STATE.md),
[API_REFERENCE.md](../API_REFERENCE.md), and [modules/cost-book.md](../modules/cost-book.md).

## Layering

The Costbook workspace follows the standard TradeOS flow:

```text
Route / Controller
  -> CostbookService
    -> CostbookRepository
      -> Prisma / PostgreSQL with forced RLS
```

Current files:

- `app/backend/routes/costbook.routes.ts`
- `app/backend/controllers/costbook.controller.ts`
- `app/modules/costbook/service.ts`
- `app/modules/costbook/repository.ts`
- `app/modules/costbook/types.ts`

## Authorization and tenancy

Every Costbook request still depends on:

1. bearer-token authentication
2. organization-membership resolution
3. request-scoped PostgreSQL session variables
4. forced row-level security in PostgreSQL

The route layer then applies the Costbook-specific permission boundary:

- `costbook.read` for list/detail reads
- `costbook.write` for create/update
- `costbook.manage` for destructive or administrative changes such as labor-rate deactivation

The database layer reinforces this boundary for Costbook-owned writes through
`public.current_app_can_manage_costbook()`.

## Current workspace scope

The current authenticated Costbook workspace under `/api/v1/costbook/*` and
`/costbook/*` includes:

- workspace summary and permission surface
- materials catalog foundation
- labor-rates foundation

Implemented labor-rate fields:

- `id`
- `organizationId`
- `role`
- `description`
- `hourlyCost`
- `billRate`
- `active`
- `createdAt`
- `updatedAt`

Labor rates are organization-scoped and remain foundational only. No labor
burden calculations, labor rollups, pricing-engine logic, estimate
integration, equipment-rate workflows, assembly-builder behavior, supplier
automation, or Athena recommendations are part of this slice.

## Legacy compatibility

The repository still contains the older `app/modules/labor-database/*` module
and `/api/v1/labor-rates/*` route group. C003 does not remove that surface.
Instead, the shared `labor_rates` table now carries both the newer Costbook
foundation fields and the older compatibility fields so current code paths can
coexist while the authenticated Costbook workspace becomes the authoritative
UI/API surface for labor-rate management.

## Web surface

The current authenticated Costbook web surface is:

- `/costbook`
- `/costbook/materials`
- `/costbook/labor-rates`

Each route follows the existing page-shell pattern: thin route files, server
loading of authenticated backend data, reusable Costbook components, and
honest loading, error, and empty states.
