---
status: current
owner: platform
last_verified: 2026-08-21
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
- `GET /api/v1/proposals` — organization-scoped work-queue read (see below)

## Organization work-queue read

`GET /api/v1/proposals` (`ProposalsService.listOrganizationQueue`) returns every proposal in the caller's organization, newest-activity-first, for dashboard/reporting/future-Athena-tool consumers that need a company-wide view rather than a single project's proposals.

- **Scope:** organization-wide (scoped through the proposal's project, since `Proposal` has no direct `orgId` column); every authenticated organization member with `billing.read` may call it (every canonical/legacy role has that permission). Organization scope is derived from the authenticated request context, never a caller-supplied id, and is enforced both in the query and by forced RLS on the `proposals` table.
- **Filters:** `status` (comma-separated, multiple statuses, legacy-synonym-aware), `sent` (`sentAt` non-null), `viewed` (`viewedAt` non-null), `unsigned` (no `Contract` row references the proposal yet — conversion is independent of that contract's own signature state), `staleBefore` (matches `sentAt <= staleBefore`; there is no hard-coded staleness age), `updatedAfter`, `updatedBefore`.
- **Pagination:** opaque cursor, default 25 / max 50, `updatedAt desc, id desc` with a stable id tie-breaker, invalid cursor -> `400`. Response is `{ items, total, nextCursor }` with an exact filtered `total`.
- **Response fields:** `id`, `projectId`, `projectName`, `customerName`, `status`, `amount` (`finalPrice`, nullable — a proposal only has a single canonical amount once finalized; `priceLow`/`priceHigh` remain range fields, not folded into this figure), `contractId` (nullable, the most recently created linked `Contract`'s id), `sentAt`, `viewedAt`, `updatedAt`. No `orgId` on individual items.
- The product spec's "canceled/voided proposals must not satisfy unsigned/stale" rule has no canonical status to apply to in the current domain (see Known limitations below and `docs/WORKFLOW_LIFECYCLES.md`).

## Permissions

See [RBAC_MATRIX.md](../RBAC_MATRIX.md).

## Lifecycle and statuses

See [WORKFLOW_LIFECYCLES.md](../WORKFLOW_LIFECYCLES.md). Proposal actions update the related Project with canonical project lifecycle values: draft creation/duplication/decline, send, and resend use `estimating`; acceptance uses `awarded`. Historical project values such as `proposal_draft`, `proposal_sent`, and `accepted` remain readable through project compatibility normalization but are no longer written by this service.

Viewed, accepted, and declined transitions use organization-scoped conditional
writes within the existing request-scoped transaction. If a competing request
changes the proposal first, the stale mutation fails closed and does not record
duplicate delivery/activity history or overwrite the winning project side
effect. The current `billing.read` read boundary and `documents.manage`
mutation boundary remain unchanged.

## Emitted activity events

- proposal send, view, accept, decline, and resend actions write delivery history and activity-oriented metadata
- the compatibility route remains `/reject`, but new proposal declines persist canonical `declined` and emit `proposal.declined`; historical `rejected` rows remain readable and normalize to `declined`
- `ProposalsService.send()` additionally publishes a canonical Athena `ProposalSent` event (C008, Project Athena A8 — see [athena/10-events/README.md](../athena/10-events/README.md)) after the status mutation commits, via `app/modules/athena-events`. Dark infrastructure: publish failures are caught and logged, never block or roll back the send, and no subscriber consumes the event in this milestone. No other proposal transition publishes an event yet.

## Frontend surfaces

- `/projects/[id]/proposals/new`
- `/projects/[id]/proposals/[proposalId]`
- `/projects/[id]/proposals/[proposalId]/preview`
- `/portal/proposals/[proposalId]`

## Branded document generation

Proposal PDF generation resolves branding from the authenticated organization
through the canonical Brand Studio profile and document settings. The PDF
header, contact rail, accent palette, and optional trust signals use that
server-derived branding. The existing proposal route shape, pricing, terms,
lifecycle, and organization/RLS checks are unchanged; a caller-supplied
company name is only a fallback when authenticated organization context is
absent.

## Tests

- `app/tests/proposals.service.test.ts`
- `app/tests/proposalsInvoicesContractsMigration.test.ts`
- `app/tests/proposal-delivery.migration.test.ts`
- `app/tests/proposals.athena-events-integration.test.ts`
- `app/tests/proposals.queue.test.ts`, `app/tests/proposals.controller.queue.test.ts` — organization work-queue filters (sent/viewed/unsigned/stale), pagination, and authorization
- `app/tests/rls.integration.ts` (`organization work-queue reads` describe block) — live tenant isolation and unsigned/contractId resolution for the queue read
- `app/tests/rls.integration.ts` — live same-org/cross-org proposal mutation and competing accept/decline transition coverage
- `app/tests/documents.branding.test.ts` — canonical organization-brand resolution and safe fallback/color behavior

## Known limitations

- historical proposal rows may still contain `rejected`; reads and status filters normalize that legacy value to canonical `declined`, and no destructive historical rewrite is performed
- `generated` and `expired` remain canonical contract states without a currently implemented proposal-service mutation path
- the organization work-queue read's product spec calls for excluding canceled/voided proposals from operational filters (`unsigned`, `stale`), but no canonical canceled/voided proposal status exists in this domain today — the rule has nothing to apply to and is not implemented as an invented status

## Deferred work

- further delivery-channel expansion beyond the current timeline and portal-aware surfaces

## Last verified date

2026-08-24

Exact-head GitHub verification for the earlier lifecycle PR #267 passed on
2026-08-22; the S016 document-brand rendering verification was completed on
2026-08-24. Production rollout remains governed by merge and deployment
evidence.
