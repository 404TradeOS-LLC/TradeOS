---
status: current
owner: platform
last_verified: 2026-08-29
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
- authenticated staff contract requests execute inside the shared
  `databaseSession` transaction, and customer-portal contract requests execute
  inside `customerPortalDatabaseSession`; the Prisma proxy therefore routes
  the status mutation, `ContractEvent`, and activity-timeline writes through
  the same request-scoped transaction

## Frontend surfaces

- `/projects/[id]/contracts/[contractId]`
- `/portal/contracts/[contractId]`
- `/customer-portal/contracts/[contractId]`

## Branded document generation

Contract PDFs resolve company identity, contact details, accent colors, and
optional license/insurance/bonding footer signals from the authenticated
organization's canonical Brand Studio data. Missing optional profile values
use deterministic defaults. Contract route shape, permissions, organization
scoping, and forced RLS remain unchanged; the pre-beta repair adds an
agreed-value snapshot and retains signature metadata as explicitly reported
in-app acceptance evidence.

## Executed-agreement integrity

Contract creation requires an accepted proposal with a non-null final price.
The contract stores that agreed amount and a JSON snapshot of the proposal
scope, assumptions, exclusions, timeline, payment schedule, and terms. The
snapshot is the document source for contract PDF scope rendering; later
proposal edits are rejected once the proposal is accepted or has a contract.
Scope changes use the existing change-order path rather than mutating the
executed proposal. This remains bounded in-app acceptance under ADR-007; it is
not certificate-backed or certified e-signature.

Signature records include the browser-reported network value and user-agent
when the web action can provide them. The values are retained as reported
metadata and do not constitute identity verification.

The public customer route may sign only a pending contract whose project is
owned by the redeemed portal session's customer. The backend re-derives the
signer email from that customer record, records `actorType: customer_portal`,
customer id, and portal session id in the contract event, and uses a dedicated
RLS policy rather than a staff role. Replay, cross-customer, and cross-tenant
requests fail closed.

## Tests

- `app/tests/contracts.service.test.ts`
- `app/tests/invoice-contract-history.migration.test.ts`
- `app/tests/documents.branding.test.ts` — canonical organization-brand resolution and safe fallback/color behavior
- `app/tests/customer-portal.service.test.ts`
- `app/tests/customer-portal.migration.test.ts`

## Known limitations

- the database still stores `pending_signature` as the pre-signature status; the check constraint has never accepted canonical `draft`/`sent`/`viewed`. PR #276 (S010, merged 2026-08-23 as `fcbf1fff342053d854ad73667c54a5e44c1bbfb6`) normalizes the API surface (`toDTO()` returns canonical `sent`) without a schema migration — see `docs/architecture/S010_CONTRACT_LIFECYCLE_PLAN.md`.
- historical contracts may have a null agreed amount and snapshot; the additive contract-integrity migration backfills no invented legal or commercial value
- `ContractsService` relies on the repository's request-scoped database-session
  boundary for transaction atomicity rather than opening a nested service-local
  transaction. Direct service calls outside an authenticated/request database
  session do not gain that request-level transaction automatically; production
  HTTP and customer-portal routes do.

## Deferred work

- any third-party e-sign integration beyond the current in-app signature capture

## Last verified date

2026-08-29

## S022 rendering boundary

Contract PDF rendering preserves the existing authenticated organization-scoped route and signature semantics. The S022 slice uses deterministic UTC dates, renders an explicit fallback when terms are empty, and leaves contract lifecycle state and in-app signature policy unchanged.
