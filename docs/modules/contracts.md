---
status: current
owner: platform
last_verified: 2026-08-23
source_of_truth: false
related_code:
  - app/modules/contracts
  - app/backend/routes/contracts.routes.ts
  - web/src/app/(app)/projects/[id]/contracts
  - web/src/app/(app)/portal/contracts
---

# Contracts

## Purpose

Own contract creation from accepted proposals, signature capture, voiding rules, document generation, and event history.

## Source code locations

- `app/modules/contracts/*`
- `app/backend/routes/contracts.routes.ts`
- `web/src/app/(app)/projects/[id]/contracts/**`
- `web/src/app/(app)/portal/contracts/**`

## Core models

- `Contract`
- `ContractEvent`

## Routes

- `/api/v1/contracts/*`

## Permissions

See [RBAC_MATRIX.md](../RBAC_MATRIX.md).

## Lifecycle and statuses

See [WORKFLOW_LIFECYCLES.md](../WORKFLOW_LIFECYCLES.md).

## Emitted activity events

- contract creation, signing, and voiding write contract event history
- signing and voiding use organization-scoped status-conditional writes so
  competing stale mutations fail closed; repeated voiding is rejected

## Frontend surfaces

- `/projects/[id]/contracts/[contractId]`
- `/portal/contracts/[contractId]`

## Branded document generation

Contract PDFs resolve company identity, contact details, accent colors, and
optional license/insurance/bonding footer signals from the authenticated
organization's canonical Brand Studio data. Missing optional profile values
use deterministic defaults. Contract route shape, signature semantics,
permissions, organization scoping, and forced RLS remain unchanged.

## Tests

- `app/tests/contracts.service.test.ts`
- `app/tests/invoice-contract-history.migration.test.ts`
- `app/tests/documents.branding.test.ts` — canonical organization-brand resolution and safe fallback/color behavior

## Known limitations

- the database still stores `pending_signature` as the pre-signature status; the check constraint has never accepted canonical `draft`/`sent`/`viewed`. PR #276 (S010, merged 2026-08-23 as `fcbf1fff342053d854ad73667c54a5e44c1bbfb6`) normalizes the API surface (`toDTO()` returns canonical `sent`) without a schema migration — see `docs/architecture/S010_CONTRACT_LIFECYCLE_PLAN.md`.
- sign/void status writes now use expected-status predicates and fail closed on
  stale concurrent requests. The status update and event write are still not
  wrapped in one transaction; a future hardening slice may make that boundary
  atomic. `pending_signature` remains the compatibility storage value.

## Deferred work

- any third-party e-sign integration beyond the current in-app signature capture

## Last verified date

2026-08-24
