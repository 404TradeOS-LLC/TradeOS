# Codes & Permits — permit/inspection tasks and price-neutral fee reviews

**Status:** draft PR, issue #946 TODO 5. Not merged, not deployed, not release-certified.
**Branch:** `feat/codes-permits-tasks-fees-946` (from `main` `c1b3cb0e`).
**Extends:** the read-only advisory pilot in #945 (`docs/architecture/COSTBOOK_CODES_PERMITS_PILOT.md`).
**Owners:** `app/modules/costbook/codes/permitTasks.service.ts`,
`app/modules/costbook/codes/feeReviews.service.ts`,
`app/modules/costbook/codes/jurisdiction.ts`,
`app/backend/controllers/costbookCodesPermitTasks.controller.ts`,
`app/backend/controllers/costbookCodesFeeReviews.controller.ts`,
`web/src/app/(app)/costbook/codes/permits/page.tsx`.

## Merge order — read first

This PR depends on work that has not landed:

1. **#945 (pilot)** — the read-only code-reference registry and Athena
   `codeReferences` tool. This PR's Athena enrichment is written as a
   standalone pure module (`jurisdiction.ts`) so it does not duplicate
   the pilot; the tool-file wiring lands on the rebase after #945 merges.
   The pilot's `GET /codes` route and this PR's `/codes/permit-tasks`
   and `/codes/fee-reviews` routes do not collide.
2. **TODO 2 — PR #960** (`feat/codes-permits-registry-946`,
   `codes_authority` / `codes_jurisdiction` / `codes_source`,
   migration `20261109220000_add_codes_authority_jurisdiction_source`).
   The enrichment module is built against their planned field
   contract (authority, jurisdiction, source citation/version/status)
   but reads no table that does not exist yet.
3. **TODO 4** — `codes_job_assessment`. Both new tables carry an
   `assessment_id` foreign key to it. **The migration in this PR FAILS
   until TODO 4's migration lands** (`prisma migrate deploy` errors on
   the missing referenced table). Merge TODO 2, then TODO 4, then this.
   The Prisma schema deliberately declares `assessmentId` as a plain
   nullable uuid (no relation) so client generation and unit tests do
   not depend on TODO 4's model; only migration SQL enforces the FK.

Do not apply this migration to staging or production before TODO 4.
Staging migration apply is Billy's gate click in any case.

## Permit / inspection tasks (`codes_permit_task`)

- `id`, `org_id`, `project_id`, `assessment_id` (nullable, TODO 4 FK),
  `task_kind` (`permit` | `inspection`), `title`, `permit_number`
  (nullable, explicit only), `permit_status` (explicit only — see
  below), `assignee_id` (nullable, active org member), `due_date`
  (nullable date), `evidence` (jsonb, official attachment refs only),
  `history` (jsonb, append-only), timestamps.
- Permit status vocabulary (the whole vocabulary, nothing else):
  `not_submitted`, `submitted`, `under_review`, `approved`, `denied`,
  `inspection_scheduled`, `inspection_passed`, `inspection_failed`.
  **Statuses are explicit only and never inferred** — no service,
  controller, Athena tool, or UI in this slice derives a status from
  an address, a source link, an AI message, or any other signal.
- **No accidental submission:** the only submit path is
  `POST /codes/permit-tasks/:id/submit` with `{confirm: true}` on a
  task currently `not_submitted`, by owner/admin. Creating a task,
  attaching evidence, or receiving an Athena answer never changes
  `permit_status`. The web submit button asks the human to confirm
  first (`window.confirm` + `confirm: true` in the request).
- **No source link or AI message counts as a permit.** This is stated
  in the migration, the UI, and this doc wherever a permit status is
  shown.
- RBAC: owner/admin create, reassign, update, submit, delete.
  An assigned technician may update only their own task's explicit
  status and evidence refs. All other roles are read-only (technicians
  list only tasks assigned to them).
- RLS (forced): reads org-scoped; inserts/deletes owner/admin only;
  updates owner/admin or the assigned technician on their own task.
  Cross-org reads return nothing; cross-org writes are refused.
- Evidence holds a label + official reference (receipt number, filing
  ID, or official URL) only. No full model-code text is stored.

## Fee-review workflow (`codes_fee_review`) — price-neutral by construction

- `id`, `org_id`, `project_id`, `estimate_id` (nullable),
  `assessment_id` (nullable, TODO 4 FK), `fee_cents` (nullable,
  non-negative integer cents), `fee_source` (`quoted` | `verified`),
  `currency` (default `USD`), `status` (`pending` | `approved` |
  `rejected`, default `pending`), `cost_item_id` (nullable),
  `note`, `reviewed_by`, `reviewed_at`, timestamps.
- Workflow: quoted/verified fee → `pending` → human review →
  `approved` / `rejected`. Only a pending review can be reviewed;
  review records reviewer + timestamp; stale revisions 409.
- **`cost_item_id` is set ONLY by the explicit
  `POST /:id/select-cost-item` step**, on an already-approved fee,
  with a CostItem that exists in the same org. Creation never accepts
  a CostItem (unknown keys fail validation).
- **The fee-review code never mutates an estimate.** The service
  contains no `estimate.update` or line-item write of any kind. The
  DTO carries an advisory `mayAffectEstimate` flag that is true only
  for approved + explicitly selected CostItem — and even then the cost
  effect goes through the existing explicit CostItem write semantics
  owned by the estimator, never through this workflow.
- Pending, rejected, and unselected fees are financial no-ops. Tests
  prove this three ways: unit tests assert `estimate.update` is never
  called across create/review/select; the RLS integration test
  approves a fee and asserts the linked estimate's `subtotalCost` /
  `totalPrice` are unchanged; `mayAffectEstimate` is false for every
  combination except approved + selected.
- RBAC: owner/admin create, review, select, delete. Technicians (and
  all other roles) are read-only. RLS: reads org-scoped; all writes
  owner/admin only.

## Athena enrichment (`app/modules/costbook/codes/jurisdiction.ts`)

Pure functions only — no database access, no outbound fetch, no
auto-injection into the estimator. Enriches the pilot's read-only
`codeReferences` tool (wiring lands after #945 merges):

- `resolveJurisdiction(input)` — `verified` ONLY when parcel ID,
  incorporated vs unincorporated status, governing authority, source
  citation, and source version are all supplied explicitly. Anything
  missing, stale, or ambiguous → `needs_verification`, with the
  missing fields listed, a "why it matters" explanation, and the next
  human action. County or state alone never verifies a parcel.
- `resolveSourceVersion(reference, knownVersions)` — exact citation
  match returns that version's status. Superseded versions stay
  readable in history (returned with their successor pointer), never
  deleted or hidden. Unregistered citations are `unknown`; a citation
  older than a known newer version is `stale`.
- `citationSourceHash(citation, sourceUrl)` — SHA-256 of citation +
  source URL. Citation + hash only; **no full code text is stored or
  emitted** (tested: enriched payloads contain no `fullText` key).
- `enrichCodeReferences(items, jurisdiction, versions)` — attaches
  jurisdiction + version outcomes, `whyItMatters`, and the next human
  action to each advisory item. Every item stays applicability
  `unverified`. No legal determination, no license or
  legal-certification roleplay, no permit approval, no fee.

## API

Mounted on the Costbook router (`/api/v1/costbook`), behind the
existing bearer-auth + org-membership + forced-RLS session.
Reads require `costbook.read`; writes are additionally gated by the
services' owner/admin (and assigned-technician) rules.

- `GET /codes/permit-tasks?projectId=` — list (technicians: assigned only)
- `POST /codes/permit-tasks` — create (owner/admin)
- `GET /codes/permit-tasks/:taskId` · `PATCH /codes/permit-tasks/:taskId` · `DELETE /codes/permit-tasks/:taskId`
- `POST /codes/permit-tasks/:taskId/submit` — `{expectedUpdatedAt, confirm: true}` only
- `GET /codes/fee-reviews?projectId=` — list
- `POST /codes/fee-reviews` — create (owner/admin; no CostItem accepted)
- `GET /codes/fee-reviews/:feeReviewId`
- `POST /codes/fee-reviews/:feeReviewId/review` — `{expectedUpdatedAt, decision: approved|rejected}`
- `POST /codes/fee-reviews/:feeReviewId/select-cost-item` — `{expectedUpdatedAt, costItemId}` (approved only)
- `DELETE /codes/fee-reviews/:feeReviewId`

All mutations require `expectedUpdatedAt` (optimistic concurrency;
stale → 409). Unknown request keys fail validation.

## Web UI

`/costbook/codes/permits?projectId=` (server component, mobile-first,
reusing the shared `PageHeader` / `EmptyState` components and the
Costbook card styling):

- Task cards: title, kind, explicit status label, permit number (or
  "No permit number recorded"), due date, evidence refs, history
  count, assessment linkage. A submit button appears only on
  `not_submitted` tasks and confirms explicitly before posting.
- Fee-review cards: fee amount, quoted/verified source, status, and
  the price-neutral note — approved + selected explains the CostItem
  step; everything else states "No estimate effect."
- The page states on every render: "No source link or AI message
  counts as a permit."
- No project selected → guidance (permit work lives on a project).
  The link from the pilot's `/costbook/codes` browser lands with the
  #945 rebase; the permits page links back to `/costbook` and
  `/projects` until then.

## QA evidence

- `app/tests/codes-permit-tasks.service.test.ts` (13 tests) — RBAC,
  explicit-status-only, assigned-technician scope, evidence
  validation, confirm-required submit, stale-revision 409s.
- `app/tests/codes-fee-reviews.service.test.ts` (8 tests) — fee
  no-op proof (`estimate.update` never called), approve/reject
  no-ops, select-only-on-approved, `mayAffectEstimate` truth table.
- `app/tests/codes-jurisdiction.test.ts` (10 tests) — missing / stale /
  ambiguous jurisdiction → `needs_verification`; superseded versions
  stay readable; citation + hash only, no full text.
- `app/tests/codes-permit-tasks-fee-reviews.migration.test.ts` (4 tests)
  — migration/schema alignment, FORCE RLS, policies, TODO 4 FK note.
- `app/tests/codes-permit-tasks.controller.test.ts` (5 tests) +
  `app/tests/codes-fee-reviews.controller.test.ts` (5 tests) —
  controller validation and confirm passthrough.
- `app/tests/rls.integration.ts` — live cross-org isolation, refused
  cross-org writes, assigned-technician update scope, owner/admin-only
  fee writes, and estimate totals unchanged after fee approval.
  (Runs in CI only; local integration tests need docker
  postgres:16-alpine, which is not installed here. The migration
  itself fails until TODO 4 lands, so the RLS lane is expected red
  until the merge order above is satisfied.)
- `web/src/lib/costbook-permits.test.ts` (4 tests) — status labels,
  fee formatting, projectId normalization.

## Four-width acceptance spec (browser evidence still owed)

Run authenticated, on a working nonproduction deployment at the exact
PR head SHA, with the staging test account only, never production:

| Width | Checks |
| --- | --- |
| 390 | Permits page renders; task + fee cards stack; submit button thumb-reachable; no horizontal overflow; disclaimer visible without scrolling past the fold. |
| 768 | Cards in a readable single column; status badges and fee amounts legible; submit confirm dialog usable. |
| 1024 | Two-column card layout holds; no clipped text; empty states render for a project with no tasks/fees. |
| 1440 | Full layout; no overflow; all labels, evidence refs, and fee-neutral notes visible. |

Also: denied user (no `costbook.read`) gets 403, not data; cross-org
project returns 404, not another tenant's tasks; submit without
confirm is refused (400); an approved fee with no selected CostItem
leaves the linked estimate's totals unchanged; the Route 63 case shows
`needs_verification` until parcel + authority + version are explicit.

**Status 2026-11-09:** no browser evidence exists yet. The #945
preview is blocked on a stale Preview `DATABASE_URL` that only Billy
can fix in the Vercel dashboard, and no working preview deployment
exists for this branch. The exact browser-acceptance brief is in the
PR body. Do not claim acceptance without browser evidence.
