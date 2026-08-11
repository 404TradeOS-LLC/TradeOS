---
status: current
owner: platform
last_verified: 2026-08-10
source_of_truth: false
related_code:
  - app/modules/proposals
  - app/modules/proposal-generator
  - app/backend/routes/proposals.routes.ts
  - app/backend/routes/proposalGenerator.routes.ts
  - web/src/app/(app)/projects/[id]/proposals
---

# Proposals

## Purpose

Own proposal drafting, sending, viewing, acceptance or decline handling, PDF generation, and delivery history.

## Source code locations

- `app/modules/proposals/*`
- `app/modules/proposal-generator/*`
- `app/backend/routes/proposals.routes.ts`
- `app/backend/routes/proposalGenerator.routes.ts`

## Core models

- `Proposal`
- `ProposalDelivery`

## Routes

- `/api/v1/proposals/*`

## Permissions

See [RBAC_MATRIX.md](../RBAC_MATRIX.md).

## Lifecycle and statuses

See [WORKFLOW_LIFECYCLES.md](../WORKFLOW_LIFECYCLES.md).

## Emitted activity events

- proposal send, view, accept, reject, and resend actions write delivery history and activity-oriented metadata
- `ProposalsService.send()` additionally publishes a canonical Athena `ProposalSent` event (C008, Project Athena A8 — see [athena/10-events/README.md](../athena/10-events/README.md)) after the status mutation commits, via `app/modules/athena-events`. Dark infrastructure: publish failures are caught and logged, never block or roll back the send, and no subscriber consumes the event in this milestone. No other proposal transition publishes an event yet.

## Frontend surfaces

- `/projects/[id]/proposals/new`
- `/projects/[id]/proposals/[proposalId]`
- `/projects/[id]/proposals/[proposalId]/preview`
- `/portal/proposals/[proposalId]`

## Tests

- `app/tests/proposals.service.test.ts`
- `app/tests/proposalsInvoicesContractsMigration.test.ts`
- `app/tests/proposal-delivery.migration.test.ts`
- `app/tests/proposals.athena-events-integration.test.ts`

## Known limitations

- canonical decline language still maps to stored `rejected` values in service logic

## Deferred work

- further delivery-channel expansion beyond the current timeline and portal-aware surfaces

## Last verified date

2026-07-14
