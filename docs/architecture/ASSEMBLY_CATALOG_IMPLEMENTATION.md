---
status: current
owner: costbook
last_verified: 2026-09-19
source_of_truth: true
related_code:
  - app/modules/assemblies-database/catalog.ts
  - app/modules/assemblies-database/service.ts
  - app/backend/controllers/assembliesDatabase.controller.ts
  - app/backend/routes/costbook.routes.ts
  - web/src/components/costbook/assembly-catalog.tsx
---

# Assembly Catalog Implementation

## Outcome

TradeOS exposes a contractor-facing residential starter catalog organized by
familiar NAHB work groups while retaining CSI MasterFormat division and section
codes. Installing a starter creates a real, tenant-scoped `Assembly` and its
`AssemblyItem` rows. It does not create a parallel assembly table or pricing
engine.

The starter library contains 14 review-first recipes covering site work,
concrete, framing, roofing, siding, openings, drywall, painting, flooring,
finish carpentry, electrical, plumbing, HVAC, and decks.

## Safety and pricing contract

- The shared starter catalog contains quantities and classification, not prices.
- The estimator must map every recipe slot to an active Cost Item owned by the
  authenticated organization before installation.
- The server rejects duplicate, missing, or unknown recipe slots.
- Every component declares compatible construction units and Cost Item kinds;
  both the mapping picker and install service reject mismatches.
- The server reloads every mapped Cost Item with `orgId` and `isActive: true`;
  an inactive or cross-organization identifier fails closed.
- Installation explicitly joins an active request transaction or opens a new
  Prisma transaction, so Assembly and AssemblyItem writes are atomic in HTTP,
  background, and direct-service execution. Forced RLS remains the database
  boundary.
- Installed assemblies reuse current Costbook unit-cost resolution and Estimate
  pricing snapshots. Starter installation never rewrites historical estimates.
- Recipe quantities are estimating defaults. The UI requires review of waste,
  production, code, permit, access, and local-condition assumptions.

## API

- `GET /api/v1/costbook/assemblies/starter-catalog` requires `costbook.read`.
- `POST /api/v1/costbook/assemblies/starter-catalog/install` requires
  `costbook.write` and accepts `templateId` plus one Cost Item mapping per
  required component key.
- Compatibility aliases exist under `/api/v1/assemblies`.

## Implementation checklist

- [x] Reconcile the existing Assembly model, Costbook pricing path, permissions,
  tenant isolation, and Estimate snapshot behavior.
- [x] Define the NAHB residential work-group navigation and CSI-coded recipes.
- [x] Add transparent measurement bases, component quantities, waste guidance,
  and review language.
- [x] Add authenticated read and install endpoints without a schema migration.
- [x] Require complete component mapping to existing organization Cost Items.
- [x] Reject duplicate codes and inactive/cross-organization component IDs.
- [x] Create real reusable Assembly and AssemblyItem records.
- [x] Add responsive browse, search, filter, mapping, installed-state, and error
  handling to `/costbook/assemblies`.
- [x] Preserve manual assembly creation, editing, nesting, costing, lifecycle,
  permissions, and current Estimate consumption.
- [x] Add catalog-integrity and service-level installation regression tests.
- [x] Pin catalog and recipe versions, review metadata, component quantities,
  compatible units, and compatible Cost Item kinds in regression snapshots.
- [x] Publish a machine-readable NAHB/CSI coverage matrix from the catalog.
- [x] Make installation explicitly transactional and cover the active tenant
  session with live RLS integration tests.
- [x] Replace bounded dropdown-only mapping with server-backed Cost Item search
  and prevent duplicate or incompatible selections in the UI.
- [ ] Add authenticated rendered browser evidence for owner/admin and read-only
  roles against a disposable tenant.
- [ ] Expand the reviewed recipe library trade by trade after qualified-estimator
  review; do not silently promote Knowledge Engine legacy assemblies.
- [ ] Add a mapping-quality review queue and version history before supporting
  organization-wide recipe upgrades.
- [ ] Connect future plan takeoff quantities only after the installed assembly
  workflow has production evidence.

## Current catalog coverage

The API derives this matrix from the recipes rather than maintaining a second
hand-counted registry.

| Residential work group | Recipes | CSI divisions | Output units |
| --- | ---: | --- | --- |
| Site work | 1 | 31 | CY |
| Foundation | 1 | 03 | SF |
| Framing | 1 | 06 | SF |
| Exterior shell | 2 | 07 | SF, SQ |
| Interior finishes | 4 | 08, 09 | EA, SF |
| Cabinets and trim | 1 | 06 | LF |
| Electrical | 1 | 26 | EA |
| Plumbing | 1 | 22 | EA |
| Mechanical | 1 | 23 | EA |
| Outdoor living | 1 | 06 | SF |

This is a deliberately small baseline, not a claim of comprehensive residential
scope. Catalog expansion remains qualified-estimator work with versioned recipe
review.

## Classification note

NAHB is used as a residential browsing/workflow vocabulary, not as a claim that
these recipes are an official NAHB publication. CSI labels organize the catalog
by MasterFormat division/section. TradeOS-authored recipe codes carry the
`-TOS-###` suffix so they cannot be mistaken for a licensed cost database or an
official pricing source.
