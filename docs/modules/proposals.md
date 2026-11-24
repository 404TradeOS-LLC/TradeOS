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

## Proposal PDF saved-text layout repair

Customer and Project cards in both Proposal PDF renderers measure wrapped field height and place each subsequent field below the preceding rendered text. Their shared card height grows to contain the longer column. Saved CRLF, CR and Unicode paragraph separators are normalized to LF in metadata and narrative sections before PDFKit rendering, preventing visible control glyphs. Regression coverage uses the actual long-name beta fixture and compares alternate saved line endings with LF. Pricing, saved snapshots, authorization and routes are unchanged; final staging visual acceptance remains required.


## Contractor-brand proposal PDF header — merged PR #868

Proposed PDF fix removes the unconditional `TRADEOS` header label from both estimate-backed and project proposal PDFs. Brand Studio organization name/colors and the controlled `showPoweredByTradeOS` footer remain authoritative. Regression tests inspect PDF output with the setting disabled and enabled. The PDFKit renderer supports trusted image bytes and PR #873 implements private Storage retrieval. Live uploaded-logo rendering remains pending staged acceptance.

# Proposals

## Contractor proposal PDF logo from authenticated private storage

A proposed internal loader optionally supplies the authenticated organization's current private logo PNG/JPEG bytes to both estimate-backed and project-backed PDF generators. This does not add a request parameter or change proposal amounts, states or permissions. Missing/malformed images retain company-name text and existing optional platform footer. Real tenant PDF visual acceptance remains required.

## Optional validated logo bytes for proposal PDF headers

Estimate-backed and project-backed PDF renderers accept optional validated PNG/JPEG byte input from the implemented authenticated tenant-owned Storage loader. The source-facing service now attempts private organization-scoped Storage retrieval with protected backend credentials and does not fetch arbitrary external URLs. Missing bytes preserve text-only branding and the controlled `showPoweredByTradeOS` footer. API contract, proposal pricing, and state transitions are unchanged. Issue #870 owns remaining staging credential and customer-PDF visual acceptance.


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
- `ProposalSelection` — DES-10-F8: one row per customer decision (Copperline section 03)
- `ProposalAllowance` — DES-10-F8: one allowance line (Copperline section 04)

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

## Proposal selections and allowances (DES-10-F8)

Copperline proposal sections 03 (selections) and 04 (allowances) had no model; the staff form and customer document could not show them. Two additive tables (migration `20261123090000_add_proposal_selections_allowances`) now persist them, and `ProposalDTO` carries both lists plus a display-only `allowancesTotal`.

- `ProposalSelection`: `label` (selection category, e.g. `CABINET FINISH`, `COUNTERTOP`, `PENDANTS`), `detail` (chosen option text, e.g. `Rift white oak · clear matte`; null while the decision is open), `status` (`action_required` = Figma ACTION REQUIRED, `confirmed` = Figma CONFIRMED), nullable `dueDate` (Figma `Choose by Oct 09`), `sortOrder`. Read from the Figma flagship frame `425:45123` via the Figma MCP.
- `ProposalAllowance`: `description` (e.g. `PENDANT LIGHTING`, `CABINET HARDWARE`) and `amount` (>= 0). The Figma total ($2,800) is the sum of the rows, computed at read time and never stored.
- Both rows carry their own `orgId` (set by the service from the owning proposal's project, never from caller input), cascade on proposal delete, and are covered by forced RLS with select/write policies scoped to the session org, mirroring `proposal_deliveries`. Portal reads are further scoped by restrictive policies through the owning proposal's project to the verified customer (`project.customer_id = current_app_portal_customer_id()`), because a portal session carries the contractor's `org_id` and the org-wide policy alone would expose every customer's rows in the org. Portal writes are denied by `current_app_can_write()`.

Endpoints (`billing.read` for reads, `documents.manage` for writes):

- `GET /api/v1/proposals/:id/selections`, `POST /api/v1/proposals/:id/selections`, `PATCH /api/v1/proposals/:id/selections/:selectionId`, `DELETE /api/v1/proposals/:id/selections/:selectionId`
- `GET /api/v1/proposals/:id/allowances`, `POST /api/v1/proposals/:id/allowances`, `PATCH /api/v1/proposals/:id/allowances/:allowanceId`, `DELETE /api/v1/proposals/:id/allowances/:allowanceId`

Writes follow the same draft rules as the proposal itself: an accepted proposal, or one with a contract, rejects every selection/allowance write with `409`; a missing or foreign-org proposal returns `404`. Each create/update/delete runs in one transaction that first takes a `FOR UPDATE` row lock on the parent proposal and re-checks editability, so acceptance committing mid-mutation cannot create a row on an accepted proposal (acceptance's conditional update blocks on the same row lock). Each child mutation also advances the parent proposal's `updatedAt` in the same transaction, so a portal accept bound to the previously rendered revision (`expectedUpdatedAt`) is rejected with 409 after a staff selection or allowance change. Duplicating a proposal carries its selections and allowances to the copy.

Display: the staff proposal detail page (`/projects/[id]/proposals/[proposalId]`) shows both sections with add/edit/delete forms (read-only once accepted); the customer portal proposal page shows them read-only and renders nothing when a proposal has neither. Both surfaces state that allowances are not added to the proposal total.

**Boundary — allowances do NOT feed the proposal total.** `finalPrice` is untouched by this change: the Figma investment summary shows an `ALLOWANCES $2,800` line, but the existing total pipeline (estimate total → `finalPrice` at creation/finalization) has no clean hook for allowance sums, and rewiring it would change money behavior. Follow-up: decide whether the proposal total should include the allowances sum (and the Figma `PROJECT COURTESY −$1,500` line, which has no model either), then implement it as its own priced change. Related follow-ups: render selections/allowances in the proposal PDF (DES-10-F9 / issue #870 territory — the PDF renderer does not know about these tables yet) and surface them in the authenticated portal accept/decline page (`/portal/proposals/[id]`), which uses the same DTO but has no selections/allowances section yet.

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

## Public-portal approval + signature (DES-10-F7)

The governed customer answer to a proposal, on the public portal — the
Copperline TARGET frames (425:45123 / 425:46807) plus the signature flow
(361:119), decided by the founder 2026-11-24. `POST
/api/v1/customer-portal/proposals/:id/accept` (`ProposalsService.
acceptAsPortalCustomer`, via `CustomerPortalService.acceptProposal`) moves a
`sent`/`viewed` proposal to `accepted` only with a drawn signature image
(a base64 raster image — `data:image/png|jpeg|gif|webp;base64,…` — that
decodes to bytes starting with the magic bytes of the declared type, ≤
2,000,000 chars; a bare `data:image/` prefix with no payload, a one-byte
payload, and base64-encoded prose are rejected with `400` at the HTTP
boundary, in the service, and by the migration trigger — the trigger check
was strengthened to magic bytes by migration
`20261124185609_add_signature_image_magic_bytes`, which replaces the trigger
function without editing the landed `20261124150000` migration) plus the
printed name; a typed name
alone is rejected with `400`. The signer email is the customer record's email
on file, never a request value. The proposal records `signerName`,
`signerEmail`, `signatureDataUrl`, reported IP/user agent, `signedAt`, and
`respondedAt`, and the owning project moves to `awarded` (staff accept
parity). `POST /api/v1/customer-portal/proposals/:id/decline`
(`declineAsPortalCustomer`) moves it to `declined` with an optional
`declinedReason` (≤ 500 chars) and deliberately leaves the project untouched:
a project may carry several proposals, and declining one must not un-award a
project won through another (unlike staff `reject()`, which sets `estimating`
unconditionally). Both write a `proposal.accepted` / `proposal.declined`
delivery event with `deliveryChannel: "portal"` and `actorType:
"customer_portal"` (customer id, portal session id) plus the matching
activity row; neither publishes an Athena event nor sends email. Drafts 404,
foreign-customer and cross-org proposals 404, a second response 409s, and
concurrent double-responses allow exactly one (conditional update on the
status predicate — and, when the caller sends `expectedUpdatedAt`, on the
revision predicate too). Both accept and decline take an optional
`expectedUpdatedAt` (the proposal's `updatedAt` as rendered on the portal
page): a staff edit after the page rendered bumps `updatedAt`, so the
response is rejected with 409 and the customer must review the updated
document before answering. Selection and allowance create/update/delete
each advance the parent proposal's `updatedAt` in the same transaction as
the child write, so a staff change to either list after the page rendered
invalidates the reviewed revision the same way a direct proposal edit does.

Governance is three layers: the portal service asserts the proposal belongs
to the session's customer (404 first); the conditional update requires
`sent`/`viewed` and the org/customer project scope; migration
`20261124150000_add_proposal_portal_acceptance` grants one narrow portal
UPDATE policy keyed by the transaction-local `app.portal_proposal_id` plus a
trigger pinning every column except the response itself — the portal displays
what the proposal already says and cannot rewrite scope, prices, or terms.
An error response rolls the portal transaction back (the middleware rejects
the session operation when the response status is 400+, so a response written
before a later failure is not left standing while the client sees an error).
The project award uses a second transaction-local id,
`app.portal_proposal_project_id`, because a subquery over proposals inside
the projects policy recurses through the proposals SELECT policy (PostgreSQL
42P17, proven by the live integration test before the fix). The web form
(`PortalProposalApprovalForm`) requires the review confirmation, the printed
name, and ink on the signature pad before it submits; the accepted/declined
page state replaces the form so a refresh cannot re-submit. The
authenticated `(app)/portal` accept/decline surface is unchanged. The
identity model is ADR-010's magic-link principal — see its DES-10-F7
amendment; no new customer identity or authorization model was introduced.
Live coverage: `app/tests/proposal-portal-acceptance.integration.ts` (accept
+ award + audit trail, double-accept 409, concurrent double-accept, decline
+ no project touch, no-signature 400, draft/foreign/cross-org 404, no-email
409, expired session 401, replayed link 410, raw-UPDATE RLS probe) and
`app/tests/proposals.portal-acceptance.test.ts` (unit) plus
`web/src/components/proposals/portal-proposal-approval.test.ts`.

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
- `app/tests/proposals.selections-allowances.test.ts` — DES-10-F8: selection/allowance create/update/delete, org scoping, accepted-proposal immutability, display-only allowances total, duplication carry-over, parent row lock inside one transaction per child mutation
- `app/tests/proposal-selections-allowances.migration.test.ts` — DES-10-F8: both tables, forced RLS, org-scoped policies, portal customer scope through the owning proposal, status/amount checks, cascade
- `app/tests/rls.integration.ts` ("proposal selections and allowances RLS") — DES-10-F8: live tenant isolation, portal customer isolation within one org, viewer/portal write denial at the database boundary
- `web/src/components/proposals/proposal-selections-allowances.test.ts` — DES-10-F8: staff display + CRUD actions, portal read-only display, display-only total disclosure, accepted read-only state
- `app/tests/jobs.service.test.ts` — accepted-proposal conversion, idempotency, unauthorized roles, tenant scope and address ownership
- `app/tests/proposalsInvoicesContractsMigration.test.ts`
- `app/tests/proposal-delivery.migration.test.ts`
- `app/tests/proposals.athena-events-integration.test.ts`
- `app/tests/proposals.queue.test.ts`, `app/tests/proposals.controller.queue.test.ts` — organization work-queue filters (sent/viewed/unsigned/stale), pagination, and authorization
- `app/tests/rls.integration.ts` (`organization work-queue reads` describe block) — live tenant isolation and unsigned/contractId resolution for the queue read
- `app/tests/rls.integration.ts` — live same-org/cross-org proposal mutation and competing accept/decline transition coverage
- `app/tests/documents.branding.test.ts` — canonical organization-brand resolution and safe fallback/color behavior

## Known limitations

- proposal selections and allowances are not rendered in the proposal PDF yet, and the allowances sum is not part of `finalPrice` — see the DES-10-F8 section above for the follow-ups
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

## Staff-recorded offline proposal acceptance (feature branch; not yet released)

For an approved written quote accepted face-to-face, by telephone, or by an
externally signed copy, staff can record the approval without simulating a
delivery. Permission rules are in [RBAC_MATRIX.md](../RBAC_MATRIX.md); eligible
status, validation, and transition behavior are in
[WORKFLOW_LIFECYCLES.md](../WORKFLOW_LIFECYCLES.md). The new
`POST /api/v1/proposals/:id/accept-offline` endpoint accepts
`{ "channel": "in_person" | "phone" | "signed_document", "note": "...",
"confirmed": true }`; the note is 10–500 characters.

This path does **not** set `sentAt`, emit `ProposalSent`, send email, create a
customer signature, or affect customer-portal acceptance. It writes an
organization-scoped `proposal.accepted` delivery/activity record with
`actorUserId`, `acceptanceChannel`, `acceptanceNote`, and
`source: staff_recorded_offline`. The UI labels it "Customer accepted outside
TradeOS" and requires explicit staff confirmation. Lifecycle effects and
related send/acceptance transitions are defined in
[WORKFLOW_LIFECYCLES.md](../WORKFLOW_LIFECYCLES.md).
