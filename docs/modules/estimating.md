---
status: current
owner: platform
last_verified: 2026-08-28
source_of_truth: false
related_code:
  - app/modules/estimate-engine
  - app/backend/routes/estimateEngine.routes.ts
  - web/src/app/(app)/projects/[id]/estimates
  - web/src/lib/estimate-compare.ts
  - app/modules/athena-tools/estimator
  - app/tests/estimate-costbook-snapshot.test.ts
---

# Estimating

## Purpose

Own estimate creation, line-item pricing, pricing mode changes, duplication, comparison, and finalize-to-ready behavior.

## Source code locations

- `app/modules/estimate-engine/*`
- `app/backend/routes/estimateEngine.routes.ts`
- `web/src/app/(app)/projects/[id]/estimates/**`

## Core models

- `Estimate`
- `EstimateLineItem`

## Routes

- `/api/v1/estimates/*`
- `GET /api/v1/estimates` — organization-scoped work-queue read (see below)

## Organization work-queue read

`GET /api/v1/estimates` (`EstimateEngineService.listOrganizationQueue`) returns every non-deleted estimate in the caller's organization, newest-activity-first, for dashboard/reporting/future-Athena-tool consumers that need a company-wide view rather than a single project's estimates.

- **Scope:** organization-wide; every authenticated organization member with `crm.read` may call it (every canonical/legacy role has that permission — see [RBAC_MATRIX.md](../RBAC_MATRIX.md)). Organization scope is derived from the authenticated request context, never a caller-supplied id, and is enforced both in the query (`orgId` predicate) and by forced RLS on the `estimates` table.
- **Filters:** `status` (comma-separated, accepts multiple canonical statuses in one request and transparently matches legacy raw synonyms — see `docs/WORKFLOW_LIFECYCLES.md`), `updatedAfter`, `updatedBefore`.
- **Pagination:** opaque cursor, default page size 25, maximum 50, ordered by `updatedAt desc, id desc` with the id as a stable tie-breaker; an invalid cursor returns `400` rather than silently restarting from page 1. Response is `{ items, total, nextCursor }` with an exact filtered `total`.
- **Response fields:** `id`, `projectId`, `projectName`, `customerName`, `status`, `amount` (`totalPrice`), `revision` (the existing `version` field — Estimate has no separate document-number field), `createdAt`, `updatedAt`. No `orgId` on individual items.
- Shares the cursor/limit helpers in `app/modules/shared/pagination.ts` and the legacy-status expansion helper in `app/modules/shared/statusFilter.ts` with the equivalent Proposals and Invoices queue reads, so all three resources use one consistent pagination/filter strategy.

## Permissions

See [RBAC_MATRIX.md](../RBAC_MATRIX.md).

## Lifecycle and statuses

See [WORKFLOW_LIFECYCLES.md](../WORKFLOW_LIFECYCLES.md).

Current enforced rule:

- estimate mutations are draft-only until the estimate is finalized to `ready`
- `ready` is the internally finalized state; this slice does not add customer delivery, viewing, or approval endpoints
- proposal creation is refused for draft estimates; finalization backfills the stored price on any legacy proposal that was created without one
- `Estimate(projectId, version)` is unique and estimate creation serializes on the project row before allocating the next version
- reviewed Costbook line-item replay may supply `sourceKey` for idempotency; the Costbook picker generates a key for each catalog add request

## Costbook provenance and pricing snapshots

Estimate line items preserve the Costbook source and price that existed when the line was created. `costItemId` or `assemblyId` identifies the source, while persisted `unitCost` and `lineCost` are historical pricing snapshots rather than live pointers to current Costbook pricing.

- recalculation of an existing Estimate uses persisted line costs and does not re-fetch current CostItem or Assembly unit cost
- changing later Costbook pricing does not silently mutate an already-created Estimate line
- a newly added CostItem or Assembly line resolves the current source cost at creation time and persists that value on the line
- estimate duplication/versioning copies the persisted source IDs and pricing values, preserving historical pricing context
- this verification does not add a second Estimate/Costbook integration path and does not introduce Athena Estimate writes

Focused regression coverage lives in `app/tests/estimate-costbook-snapshot.test.ts`.

## Frontend surfaces

### Starter-component mapping keyboard contract

The existing mapping combobox keeps DOM focus in its search input. ArrowDown
opens the results and starts at the first compatible, unused Cost Item;
ArrowUp starts at the last. Further arrows move through eligible options and
stop at either end. `aria-activedescendant` references the highlighted option;
active options scroll into view. Enter selects only that available option.
Escape dismisses the list without changing an existing mapping; Tab dismisses
and continues to the next form control. Options remain pointer selectable but
are not separate Tab stops. IME composition retains its normal keyboard input.

Changing text clears the old mapping under the existing contract. Debouncing,
in-flight or failed searches suppress stale options and active descendants;
loading is announced as status and failure remains an alert. Keyboard selection
stages a mapping only: current-cost preview, Install, then reviewed Estimate Add
retain their existing gates. Tests in
`tests/components/starter-mapping-keyboard.spec.ts` mount the real production
picker/assessment with synthetic transport and a native Input fixture. This
component evidence is separate from full-app authenticated certification.

Install both root and Web dependencies (`npm ci` and `npm --prefix web ci`) and
Chromium (`npx playwright install chromium`), then run
`npx playwright test --config playwright.components.config.ts`. This hermetic
suite is separate from `tests/playwright` and its authenticated evidence
workflow, which installs root dependencies only. TypeScript/React fixture
dependencies load inside test execution, so listing either suite does not
require Web dependencies.

### Failed finalization focus recovery (responsive Review)

In the shared Scope / Items / Price / Review frontend, a failed finalize request retains the saved estimate and renders a focused `role="alert"` above the Retry finalization action. The focus handler only acts on a visible error notice and scrolls it toward the center so the fixed mobile action and Control Dock do not cover it. It uses the existing server-finalize mutation and does not imply proposal creation or saved pricing changes on failure. The previous standalone recovery PR #751 was closed unmerged; this is a reduced, current-main implementation for the single responsive Review surface. Source assertions are not hosted authenticated evidence.


### Responsive four-stage workflow (2026-10-16 implementation)

Canonical Figma Desktop Scope/Items/Price/Review `378:440–443` and mobile tracker `381:801` define the same sequence at all widths. Following merged mobile semantics PR #754, the responsive stage branch reuses one existing scope editor, Items picker/edit/delete list, Price panel and internal Review surface. Desktop pairs the active workspace with contextual Athena; mobile keeps the contextual rail in Scope and retains actions above the dock. Desktop stage actions are inline. The existing ordered native buttons expose aria-current="step", Tab/Enter/Space and visible focus at every width.

Inactive stage forms remain mounted/hidden to preserve unfinished item edits, selections and pricing fields during navigation and viewport changes. The Items search shortcut is inactive outside Items. Dirty scope saves still await acknowledgment before leaving Scope, and failure preserves text. All saved prices, provenance, explicit reviewed Add, draft-only mutations and finalize-before-proposal contracts remain unchanged. The contextual rail displays the real saved total; it never adds scripted reconciliation amounts or verification claims.

The opt-in `tests/playwright/estimate-stage-navigation.spec.ts` uses `TRADEOS_ESTIMATE_STAGE_PATH` (relative sanitized draft route) and optional `TRADEOS_ESTIMATE_STAGE_STATE`, under the existing non-production target guard. Project PATCH responses are intercepted for failure/retry, so the test does not persist scope. Its four-width matrix checks keyboard progression, pending/failure/retry, retained pricing inputs, breakpoint continuity and overflow. Synthetic local fixture execution proves frontend behavior only; signed-in persistence, tenant denial and complete design parity require separate governed evidence.

### Saved item columns and edit labels (2026-10-17 UTC)

Canonical Desktop Items `378:441` defines aligned saved item, quantity, unit amount and line amount columns. At 1024px and above, shared tracks align the headers and saved values; smaller screens retain the quantity × unit-cost summary and line cost with 44px edit/remove controls. The UI labels these internal fields Unit cost / Line cost and directs customer pricing review to Price. It renders the saved lineCost without recalculating it. Source/type/tax badges and existing edit/remove behavior remain intact.

All six line-editor fields have visible associated labels and unique IDs. Numeric cost presence, mutation payload, pending/error retention and draft-only gates remain unchanged. Read-only named metric groups require form-specific automation to target the Unit cost spinbutton. The opt-in `estimate-item-layout.spec.ts` refuses all writes and checks actual response values, desktop alignment, visible labels, keyboard Cancel, mobile hit targets and overflow at 390/768/1024/1440. Synthetic local browser execution is UI evidence, not authenticated persistence or full-design certification.

### Explicit cost when editing saved items (2026-10-17 UTC)

`EditableLineItem` requires an entered Unit cost before Save and repeats the presence check in its existing mutation handler. A blank string is never substituted for zero. Explicit numeric 0 remains valid; all other validation, draft-only authorization, PATCH payloads and Estimate Engine calculations stay authoritative. Per-editor help IDs describe the required field; failed saves are announced as alerts and preserve the draft for retry or Cancel.

The opt-in `tests/playwright/estimate-item-edit-cost.spec.ts` shares the sanitized draft route/state variables and nonproduction host guard. Its four-width matrix intercepts every write and verifies blank-input blocking, explicit-zero/original-cost payloads, pending and repeated failure recovery, retained text, Cancel and overflow. Local synthetic execution does not certify authenticated persistence or tenant isolation.

### Progressive item entry (2026-10-17 UTC)

Canonical Desktop Items `378:441` places saved rows below Add assembly / Costbook / Custom item actions. The Items picker now starts closed and exposes the existing forms through native disclosure buttons (`aria-expanded` / `aria-controls`, minimum 44px targets). Opening focuses search or custom description; closing retains draft fields and the same catalog selection. Switching catalog type clears that type-specific selection/query and filters the existing source kinds, rather than building a second search/write integration. The query cache includes the selected source kind; Cost Items calls only its search endpoint, while assemblies calls installed/starter endpoints. A slow unrelated catalog cannot block the chosen source. Loading is announced separately from an empty result. The existing active-Items shortcut opens catalog search. Blank custom Unit cost is required rather than coerced to zero; an explicitly entered 0 remains valid. The Add control and handler both enforce presence, with field guidance. Custom failure remains visible and retains input; explicit source-cost preview, starter mappings/install and separate Estimate Add are preserved.

`tests/playwright/estimate-item-entry.spec.ts` is opt-in with the same sanitized route/state variables as stage navigation. It intercepts every non-GET proxy request and provides labeled synthetic catalog reads. Its four-width behavioral matrix is frontend interaction evidence, not live supplier, authenticated persistence, or tenant-isolation certification.

### Explicit Costbook review before Estimate Add (2026-10-15 implementation slice)

The existing Items picker now separates keyboard search selection from a persisted line write. Search Enter selects the active result for review; only the visible Add control performs an Estimate Engine line-item POST. Selected organization Cost Items and installed Assemblies require a resolved, finite, nonnegative read-only current-unit-cost preview before Add is enabled. Failed/loading previews keep Add disabled and show an actionable state instead of inventing a cost. Quantities must be positive; starter recipes still require complete compatible mappings, resolved cost preview, explicit tenant-scoped installation, and a separate explicit Estimate Add. Costbook previews are advisory and may change; persisted Estimate snapshots remain owned by the Estimate Engine. Custom lines still follow the existing explicit input and save path.

These are frontend safety/interaction gates, not a new server-side pricing rule. No source price is silently refreshed on existing Estimate lines and no unsupported live supplier or provenance guarantee is implied. Authenticated responsive browser and persisted snapshot evidence remain release-certification requirements.


The same staged estimate flow remains available across mobile and desktop; only its supporting rail and action positioning change at `lg`.

- `/projects/[id]/estimates/[estimateId]`
- `/projects/[id]/estimates/compare`
- `/projects/[id]/estimates/[estimateId]/assist`

## Tests

- `app/tests/estimate-engine.service.test.ts`
- `app/tests/estimate-engine.formulas.test.ts`
- `app/tests/estimate-costbook-snapshot.test.ts`
- `app/tests/athena-tools.estimator.create-estimate.contracts.test.ts`
- `app/tests/athena-tools.estimator.update-estimate.contracts.test.ts`
- `app/tests/athena-tools.estimator.analyze-estimate.contracts.test.ts`
- `app/tests/athena-tools.estimator.compare-estimates.contracts.test.ts`
- `app/tests/estimate-engine.queue.test.ts`, `app/tests/estimate-engine.controller.queue.test.ts` — organization work-queue filters, pagination, and authorization
- `app/tests/rls.integration.ts` (`organization work-queue reads` describe block) — live tenant isolation for the queue read
- `app/tests/rls.integration.ts` (S040 core service boundary case) — same-org CRM/estimate/invoice/job access, cross-org 404 denial, and denied-estimate-write immutability

## Implementation notes

- A12 (`app/modules/athena-tools/estimator/*`): four Athena tools (`estimator.create-estimate`, `estimator.update-estimate`, `estimator.analyze-estimate`, `estimator.compare-estimates`) call `EstimateEngineService` directly, never Prisma. `EstimateEngineService.create()` now publishes the canonical `EstimateStarted` A8 event and `finalize()` publishes `EstimateCompleted`, both after the mutation commits and both non-blocking on publish failure (same posture as `ProposalsService.send()`'s existing `ProposalSent` publish). Both methods' return types gained an additive, optional `athenaEvent?: { type, id }` field so a calling Athena tool can wrap the real published event with `eventRef()` - existing callers (the estimate controller) are unaffected. A new read-only `EstimateEngineService.compareEstimates(baseEstimateId, candidateEstimateId, orgId?)` method computes a cost/price/margin/line-item-count delta between two estimates; this is distinct from the existing UI-only `web/src/lib/estimate-compare.ts` comparison helper behind `/projects/[id]/estimates/compare`. See `docs/athena/roadmap/A12-business-tool-rollout-implementation-plan.md` for the full tool catalog and permission mapping.
- `EstimateEngineService` now imports the shared `round2()` helper from `estimate-engine/formulas.ts` instead of defining a duplicate private copy (cleanup only; no change to pricing behavior)
- Estimate mutation locking binds both estimate and authenticated organization identifiers as UUIDs before the parent-row lock, preserving the existing draft-only and tenant-scoped behavior without changing any route or DTO contract. S040 live RLS coverage proves same-org success, cross-org 404 denial, and no mutation after a denied update.
- `EstimateLineItem.sourceKey` is optional and is used for backend-generated idempotency/replay protection on reviewed structured-AI apply calls. Manual line-item creation remains unrestricted by source key.
- `EstimateEngineService.removeLineItem(lineItemId, orgId)` resolves the target line item's estimate by `lineItemId` alone (plus org scope and the existing draft-only check); it does not separately validate against the `:id` route param. It now returns `{ estimateId }` (was `void`) so the controller's activity-log entry is recorded against the line item's actual estimate rather than trusting the URL, which could otherwise misattribute the audit entry if a caller passed a `lineItemId` belonging to a different draft estimate. No lifecycle or authorization behavior changed — draft-only enforcement and org scoping are unchanged.

## Known limitations

- downstream commercial workflows still rely on compatibility status normalization in some paths
- Costbook pricing preview remains calculation-only; it is not a saved organization pricing-policy system
- when a tax rate is entered without any taxable line, the builder warns that the tax total will be zero; the estimate tax basis remains the marked-up taxable share
- S008 closes the prior `sent -> ready` normalization defect. `sent` now remains `sent` in API/DTO/UI normalization and is independently accepted by the organization queue filter. Historical `rejected -> declined` compatibility remains. Customer delivery, viewing, approval, expiration, and supersession workflows remain outside this bounded normalization slice.

## Deferred work

- customer-facing estimate delivery and review transitions beyond the current finalize step
- richer historical pricing comparison/reporting may build on the persisted snapshot semantics without repricing historical lines

## Last verified date

2026-08-28


## S026 ordering concurrency

Estimate line-item append allocation remains persisted through `EstimateLineItem.sortOrder`. The S026 implementation serializes next-order allocation on the organization-scoped parent Estimate row inside the existing request-aware transaction, preserving append order, pricing snapshots, source-key idempotency, and draft-only writes.


## S028 estimate deliverability

PR #338 verifies draft persistence/reload for custom and Costbook-backed lines, sections and cost types, taxable flags, deterministic overhead/tax totals, revision-safe updates, and finalized-estimate immutability. The additive migration does not rewrite existing data.

## Pre-beta handoff safeguards

The estimate builder keeps proposal creation behind finalization, surfaces an actionable empty Costbook state, announces search results with combobox/listbox semantics, and preserves partial search results when one catalog query fails. Finalization backfills an unpriced legacy proposal only when no explicit proposal price or range exists. The proposal and invoice handoff paths consume persisted customer-facing prices rather than direct costs.

## Contextual review freshness

Contextual Athena stores the project/estimate/scope snapshot associated with its response. Suggestions are actionable only for that same non-empty normalized scope while the panel is ready and no Add is pending. Scope or record changes require refreshing review; failed/loading reviews never authorize applying previous suggestions. This is a frontend freshness guard over existing authenticated API/RLS and idempotent source keys, not a new financial or permission policy.


### Responsive scope and Price/Review recovery (2026-10-16)

The existing builder owns both responsive scope editors through one parent draft/save state and a shared editor. Desktop users can now edit the same Project `simpleScope` used by contextual Athena. Save success binds to the submitted value rather than the latest render. Failed saves retain input; finalized estimates stay read-only. No browser-local draft persistence is claimed.

The Price breakdown groups saved `lineCost` snapshots by persisted cost type and does not multiply current source costs, apply markup, or alter server totals. Invalid amounts display Unavailable. Mobile Review labels direct costs and margin as internal, then links to the separate proposal form after backend finalization. Finalization failures expose retry; uncertain deletion exposes refresh before another attempt. Supplier quotes, Estimate snapshots and lifecycle permissions are unchanged.
