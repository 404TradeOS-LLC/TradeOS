---
status: current
owner: platform
last_verified: 2026-08-28
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

## Idempotent proposal creation

`POST /api/v1/proposals` accepts a UUID `Idempotency-Key` header for persisted draft creation. First-party Proposal Review forms send it; keyed retries and concurrent submissions for the same project cannot create duplicate drafts. Requests with no key retain the pre-existing create behavior for older web bundles and external clients during independent deployments, but are not deduplicated. A malformed supplied key is rejected.

- First successful create returns `201`, the proposal representation, and `Idempotency-Replayed: false`.
- Repeating the key with the same request returns the original proposal with `200` and `Idempotency-Replayed: true`; no second proposal or project status write is made.
- Reusing a key with different request details returns `409`. The client must inspect the Project's Proposals tab before starting a new draft.
- The request fingerprint is SHA-256 over canonicalized request JSON; organization context is derived from authentication and is not part of the client fingerprint. The lookup remains scoped through the parent Project and does not relax RLS or permissions.
- Current first-party Proposal Review forms seed the key per draft and preserve it in the returned React action state, including the ambiguous API-error recovery state. Callers that omit the key receive legacy non-idempotent creation; callers that provide an invalid key receive validation error.

The key applies to draft creation only; it does not send a proposal or change pricing/lifecycle semantics. Uniqueness is retained for the lifetime of the proposal (there is no TTL cleanup). A full page reload seeds a new key, so the existing recovery instruction to inspect the Project proposal list remains the safe path after leaving the form.

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

## Accepted proposal → field job (step 9)

The organization-scoped `POST /api/v1/jobs/from-proposal/:proposalId` converts
an **accepted** proposal to a single, **unscheduled** Job. The request accepts
only a customer-owned `serviceAddressId`; all other job and commercial fields
come from the accepted proposal and its project. Access and denial rules are defined in the [Step 9 proposal-to-job conversion permission](../RBAC_MATRIX.md#step-9-proposal-to-job-conversion-permission) and [workflow lifecycle](../WORKFLOW_LIFECYCLES.md).

The job stores a unique nullable `sourceProposalId` and
`acceptedBaselineJson` copied at conversion time, including approved scope,
assumptions, exclusions, estimate reference, monetary decimal **strings**,
payment milestones and terms. The original proposal remains immutable.
A transaction-scoped proposal lock plus a unique index prevents concurrent
double jobs; retry returns the existing job without duplicating activities.
The job's service address is chosen deliberately by a manager. Crew assignment,
scheduling, signed contract, and invoicing are not implied by acceptance.

The entry point is the accepted proposal's **Create field job from accepted
proposal** action; it uses the existing address chooser and the Dispatch link.
The additive migration `20261028151000_accepted_proposal_job_handoff`
must be applied in authorized nonproduction before executing this API.
There is no production migration execution in this PR.
See the [staging review packet](../operations/accepted-proposal-job-staging.md)
for the protected apply dependency, evidence capture and ordered rollout.

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
- `app/tests/jobs.service.test.ts` — accepted-proposal conversion, idempotency, unauthorized roles, tenant scope and address ownership
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

2026-08-28

Exact-head GitHub verification for the earlier lifecycle PR #267 passed on
2026-08-22; the S016 document-brand rendering verification was completed on
2026-08-24. Production rollout remains governed by merge and deployment
evidence.

## S022 rendering boundary

Proposal PDF and document-frame rendering preserve the existing organization-scoped routes and proposal semantics. The first S022 slice adds deterministic UTC dates, safe finite numeric/currency output, and explicit empty-table presentation; it does not change proposal lifecycle, persistence, or authorization behavior.


## S028 estimate-to-proposal handoff

Estimate-backed proposal creation persists the finalized Estimate `totalPrice` into `Proposal.finalPrice` at creation time when the caller supplies no explicit price. Draft estimates retain null pricing, and explicit low/high proposal ranges are preserved without a second derived fixed price.

PR #338 carries the verified estimate state through the existing proposal creation and document/PDF handoff path, preserving proposal authorization, lifecycle semantics, audit events, and organization scoping.

The pre-beta repair closes both UI orderings: draft-estimate proposal creation is rejected and hidden from the estimate picker, while estimate finalization backfills `finalPrice` only for proposals that have no explicit fixed or ranged price. Proposal document generation no longer falls back to a live estimate total when the stored proposal price is null.

Accepted proposals and proposals linked to a contract are immutable through the normal update path. Amendments require the separate change-order or replacement-contract workflow; the current repair does not invent a new amendment status.


## Proposal creation price preview (2026-10-16)

The existing staff proposal-new form shows the selected finalized Estimate's saved `totalPrice` as Proposal price, with cents. Changing Estimate updates the displayed amount and form identity together; intake-only selection instead shows the saved intake range and explains that this form does not set a fixed proposal price. The price basis is associated with the selector and changes are announced politely. Draft/unknown Estimate IDs cannot appear as selected eligible options.

This is presentation of the existing `createFromEstimate`/`createFromProject` rules, not a new quote, repricing calculation, price approval or send action. `tests/playwright/proposal-price-basis.spec.ts` is an opt-in read-only matrix using the existing safe non-production target, `TRADEOS_PROPOSAL_PRICE_PATH` and optional `TRADEOS_PROPOSAL_PRICE_STATE`. It requires two finalized Estimates with different totals and a saved intake range; all write requests are blocked. Local four-width evidence used explicitly synthetic fixtures, not authenticated persistence.


## Failed creation retains edits (2026-10-16)

`createProposalAction` returns a validation/API error state or redirects on success. Because a returned error is a fulfilled React form action, the native uncontrolled-field reset previously discarded contractor edits. The creation form now prevents that reset; no explicit Reset control exists and successful creation still redirects. Text fields, scope/assumptions/exclusions/terms, payment fields and line-detail checkbox survive failures, and the returned error is a focused alert with submit next in keyboard order. No local storage, new request payload, validation or lifecycle policy is introduced.

`tests/playwright/proposal-failure-retention.spec.ts` is an opt-in non-production matrix using `TRADEOS_PROPOSAL_RETENTION_PATH` and optional `TRADEOS_PROPOSAL_RETENTION_STATE` with existing safe target guards. An incomplete payment row deliberately reaches the real server action's validation before its backend create call; two failures at each of four widths preserve edits and focus. Local props are explicitly synthetic. Successful creation, database persistence and authenticated negative permission evidence remain separate.

