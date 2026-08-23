---
status: draft
owner: platform
last_verified: 2026-08-22
source_of_truth: false
related_code:
  - app/prisma/schema.prisma
  - app/prisma/migrations/20260624100000_add_proposals_invoices_contracts/migration.sql
  - app/domain/contracts.ts
  - app/modules/contracts/service.ts
  - app/backend/controllers/contracts.controller.ts
  - app/backend/routes/contracts.routes.ts
  - web/src/lib/api.ts
  - web/src/components/shared/status-badge.tsx
  - web/src/app/(app)/portal/contracts/[contractId]/page.tsx
related_docs:
  - docs/LIFECYCLE_COMPATIBILITY_MATRIX.md
  - docs/WORKFLOW_LIFECYCLES.md
  - docs/SPRINT_BACKLOG.md
---

# S010 — Contract Lifecycle Normalization: Implementation-Ready Plan

**Implementation status: DONE.** This document originated as a planning artifact only; no runtime code was modified to produce it, and at the time it was written S010 remained `Status: PLANNED` in `docs/SPRINT_BACKLOG.md`. The Option A slice recommended below (Section 12) was subsequently implemented and merged as PR #276 (`fcbf1fff342053d854ad73667c54a5e44c1bbfb6`); `docs/SPRINT_BACKLOG.md` now records S010 as `DONE`. The remainder of this document is preserved as the original planning/audit evidence and is not updated line-by-line to past tense.

## 1. Executive verdict

The premise in `docs/LIFECYCLE_COMPATIBILITY_MATRIX.md` (S006) has the direction of the problem backwards for Contracts. `pending_signature` is not a legacy value drifting away from a canonical vocabulary the database already speaks — it is **the only pre-terminal value the database will accept**. The Postgres check constraint on `contracts.status`, unchanged since the table's creation migration, is:

```sql
check (status in ('pending_signature', 'signed', 'voided'))
```

Canonical `draft`, `sent`, and `viewed` are not merely "displayed differently than stored" — they are **not legal values in the `contracts` table today**. Writing any of them via `prisma.contract.update` or raw SQL would raise a constraint violation. `signed` and `voided` are already identical in both the persisted and canonical vocabularies; the entire drift is concentrated in one value, at one lifecycle position (pre-signature), and it is schema-enforced, not incidental.

The smallest safe S010 slice is **Option A: a service/DTO-boundary normalization with zero database migration.** Make the API return canonical `sent` instead of raw `pending_signature` at the point the DTO is constructed, leave the persisted column and its constraint untouched, and correct the two stale/incorrect claims this audit found in `docs/LIFECYCLE_COMPATIBILITY_MATRIX.md`. Section 12 explains why the alternative (Option B, an additive constraint + default migration) is not smaller than it looks and should not be attempted without a founder decision (Section 19).

This audit also surfaced three runtime defects unrelated to vocabulary (void non-idempotency, missing transaction boundaries, missing optimistic-concurrency guards). They are documented in Section 18 and explicitly placed on the forbidden list in Section 15 — S010 must not absorb them.

## 2. Current persisted vocabulary

Source: `app/prisma/schema.prisma:1138-1159` (Contract model) and `app/prisma/migrations/20260624100000_add_proposals_invoices_contracts/migration.sql:58-59` (check constraint, verified as the only migration ever touching `contracts.status` — no later migration alters it).

```prisma
model Contract {
  status  String  @default("pending_signature")
  ...
}
```

```sql
status text not null default 'pending_signature'
       check (status in ('pending_signature', 'signed', 'voided'))
```

| Value | DB-legal today | Is it the default |
|---|---|---|
| `pending_signature` | Yes | Yes |
| `signed` | Yes | No |
| `voided` | Yes | No |
| `draft` | **No** | No |
| `sent` | **No** | No |
| `viewed` | **No** | No |

No historical/legacy values beyond these three exist anywhere in migration history — this is a single-migration table with no drift accumulated over time, unlike Project or Estimate.

`contracts` has no `orgId` column; organization scope is inherited transitively through `project_id -> projects.org_id`. RLS (`contracts_select_policy`/`contracts_write_policy`, same migration file, lines 122-131) enforces this via `EXISTS (SELECT 1 FROM projects WHERE projects.id = contracts.project_id)` composed with the projects table's own org RLS policy. The later `contract_events` child table (`20260714162000_add_invoice_and_contract_history/migration.sql:34-64`) instead carries an explicit `org_id` column with direct RLS — a different, newer pattern than the parent table uses.

## 3. Canonical vocabulary

`app/domain/contracts.ts:174`:

```ts
export const contractStatuses = ["draft", "sent", "viewed", "signed", "voided"] as const;
```

Compatibility map, same file, `:176-183`:

```ts
export const legacyContractStatusMap: Record<string, ContractStatus> = {
  draft: "draft",
  pending_signature: "sent",
  sent: "sent",
  viewed: "viewed",
  signed: "signed",
  voided: "voided",
};
```

Transition table, `:336-342`:

```ts
const contractTransitions: Record<ContractStatus, readonly ContractStatus[]> = {
  draft: ["sent", "voided"],
  sent: ["viewed", "signed", "voided"],
  viewed: ["signed", "voided"],
  signed: [],
  voided: [],
};
```

`canTransitionContractStatus` (`:379-381`) implements this table but **has no call sites anywhere in the codebase outside its own definition** (verified by repo-wide grep across `app/` and `web/`). It is aspirational domain documentation, not enforced behavior.

## 4. Compatibility boundary

The only real compatibility boundary is `pending_signature <-> sent`, applied client-side today via `normalizeStatus(contract.status, legacyContractStatusMap, contractStatuses, "draft")` at every Contract read path in `web/src/lib/api.ts` (lines 671, 1019, 1026). `draft` and `viewed` require no compatibility mapping because no code path ever writes them (Section 5) — they are canonical-but-unreachable, not canonical-with-a-legacy-alias.

## 5. Current transition table (proven from runtime code, not inferred)

Source: `app/modules/contracts/service.ts`, `app/backend/controllers/contracts.controller.ts`, `app/backend/routes/contracts.routes.ts` (routes: `POST /`, `GET /:id`, `GET /by-project/:projectId`, `GET /:id/pdf`, `POST /:id/sign`, `POST /:id/void` — **no send/resend/view route exists**).

| Current state | Action | Stored result | API result (DTO) | Side effects |
|---|---|---|---|---|
| (none) | `create()` — requires `proposal.status === "accepted"` (`service.ts:16-22`) | DB default `pending_signature`; status is never set explicitly in the `.create()` payload (`:24-30`) | raw `pending_signature` (`toDTO` returns `row.status` unnormalized, `:198`) | `contract.created` `ContractEvent` row + `ActivityTimelineService.record` (`:31-41`) |
| `pending_signature` (raw-string equality check, `:62`) | `sign()` (`:59-88`) | `signed` | raw `signed` | `contract.signed` event; two sequential `await`s, **not wrapped in a `$transaction`** |
| any status where `row.status !== "signed"` (`:92`) | `void()` (`:90-105`) | `voided` | raw `voided` | `contract.voided` event; **calling void on an already-`voided` contract succeeds again** — no idempotency guard |
| — | `getPdf()` (`:107-120`) | no write | PDF rendered fresh on every request from live row/project state, not a frozen snapshot | none |

**Divergence between domain contract and service implementation:** `contractTransitions` (Section 3) claims `sent -> signed` and `viewed -> signed` are valid contract transitions, but `sign()`'s actual guard is a literal check against the raw string `pending_signature`, not a call to `canTransitionContractStatus`. Given Section 2's constraint, no other raw value is reachable today, so this divergence is currently harmless — but it means the domain transition table does not describe enforced behavior for Contracts.

## 6. `pending_signature` root cause

Answers, each backed by the citations above:

1. **Is it the DB default?** Yes (`schema.prisma:1142`).
2. **Does creation explicitly write it?** No — `create()` omits `status` from its `.create()` payload entirely; it relies on the DB default.
3. **Does send explicitly write it?** N/A — no send action exists in this codebase.
4. **Does it represent canonical `sent`?** Yes, by the declared compatibility map, but no code path ever performs a real `draft -> sent` transition — a contract is born directly into this state.
5. **Does any logic distinguish it from `sent`?** No. Only the raw literal `pending_signature` is ever checked; canonical `sent` never appears as a branch condition anywhere in backend code.
6. **Would writing canonical `sent` pass the DB constraint today?** No — the check constraint rejects it (Section 2).
7. **Would changing the default affect creation semantics?** Yes, materially. `sign()`'s guard at `service.ts:62` checks the literal string `pending_signature`; changing the default without also changing that guard would make every newly created contract permanently unsignable.
8. **Are historical `pending_signature` rows expected?** Yes — it is the sole non-terminal value ever written; every unsigned, unvoided contract row in the database is `pending_signature`.
9. **Does frontend/portal require the raw value?** No — every Contract read path normalizes via `normalizeStatus(...)` before the value reaches a component (Section 8).
10. **Does any integration query for it directly?** Yes — `app/tests/rls.integration.ts:1200` (approx., see Section 16) asserts `contract.status === "pending_signature"` immediately after creation.

**Classification: schema-enforced compatibility state.** It is not a cosmetic display alias — it is the only DB-legal pre-terminal value, is relied upon by service-layer string-equality logic, and any change to make canonical `sent` persistable requires a constraint migration, not just a service/DTO change.

## 7. `viewed` status findings

**Entirely unimplemented.** Evidence:

- No `viewedAt` column on `Contract` (contrast `Proposal.viewedAt`, used at `app/modules/proposals/service.ts:212`).
- No `ContractDelivery` table (contrast `ProposalDelivery`/`InvoiceDelivery` in `schema.prisma:1161-1180`).
- No contract-view endpoint exists in `app/backend/routes/contracts.routes.ts`.
- No `contract.viewed` event type is ever emitted by `ContractsService`.
- `contractTransitions.sent` lists `"viewed"` as a valid target (Section 3) but nothing ever writes it.
- `web/src/lib/document-workflow.ts:85-88` defines a humanized label for a `contract.viewed` event type that the backend never produces — dead/aspirational UI code.

Per the mission's explicit instruction, this is **not** grounds to add a view-tracking subsystem under S010. State plainly: `viewed` is unimplemented and out of scope.

## 8. Signature transaction integrity

- **Signer identity source:** client-supplied `signerName`/`signerEmail` from the sign form, validated only for shape (non-empty name, optional valid email format) by `signSchema` in `contracts.controller.ts:13-17`. **Not cross-checked** against the accepted Proposal's customer/contact record.
- **Authorization:** requires an authenticated internal session with `documents.manage` permission — `owner`/`admin`/`dispatcher` roles qualify; `technician` and legacy roles do not (`assertContractWriteAccess`, `service.ts:235-238`, permission table in `domain/contracts.ts`). There is no separate customer-identity verification step for who is physically signing.
- **Timestamp:** server-set (`signedAt: new Date()`, `service.ts:71`) — trustworthy, not client-supplied.
- **Signature IP:** server-derived from the request (`contracts.controller.ts:47`), not client-submitted.
- **Document/version linkage:** `termsText` is captured once at contract creation (`service.ts:28`, sourced from `input.termsText ?? proposal.termsAndConditions ?? DEFAULT_TERMS`) and no update-terms endpoint exists — the row is its own durable terms snapshot.
- **Signed document persistence:** `getPdf()` regenerates the PDF from live row/project data on every request (`:107-120`). There is **no frozen, persisted binary document** captured at the moment of signing — integrity rests entirely on `termsText` immutability, not on a stored artifact.
- **Activity/audit:** every mutation dual-writes a `ContractEvent` row and an `ActivityTimelineService` record, but the two writes are not atomic with the status update (Section 18).
- **Project/org boundary:** enforced via `findOrThrow`'s `project: orgId ? { orgId } : undefined` filter, backed by RLS.

**S010 constraint:** any vocabulary-normalization change to `sign()`'s guard condition must preserve its current single-precondition, single-shot semantics. It must not be loosened to accept multiple raw or canonical input values without also closing the idempotency and transaction gaps in Section 18 — doing so would widen, not shrink, the risk to signature-evidence integrity that the mission explicitly forbids weakening.

## 9. Tenant/RLS boundary

- `/api/v1/*`, including `/api/v1/contracts`, is uniformly gated by `requireAuth` + `databaseSession` middleware (`app/backend/server.ts:71`) — no route-level exception for contracts.
- **No separate customer-portal authentication exists for Contracts.** `web/src/app/(app)/portal/contracts/[contractId]/page.tsx` uses the identical internal Supabase session (`getSessionToken()`) that every other authenticated app route uses; `web/src/proxy.ts` routes `/portal/:path*` through the same session middleware as `/dashboard` and `/settings`. The mission brief's framing of a distinct "portal token/customer authorization" boundary does not exist today for Contracts — this is a finding, not something S010 should build. It is explicitly S018's scope (Section 19).
- **Existing tenant-isolation proof (real, non-mocked):** `app/tests/rls.integration.ts`, the cross-org contract block — creates and signs a contract in `orgA`, confirms a session scoped to `orgB` gets `null` on a direct `contract.findUnique` lookup and `[]` on a `contractEvent.findMany` lookup for the same IDs. This is the test to **extend** for S010 regression coverage, not replace.
- `app/tests/contracts.service.test.ts` is unit-level with mocked Prisma and has no cross-org assertion — org values are accepted uninterpreted by the mocks.
- **Gap:** no existing test covers concurrent/duplicate sign or void calls (Section 18), and none will exist for a lifecycle-normalization migration path until S010 adds one.

## 10. Frontend/portal consumers

Read-only inventory; nothing here was modified.

- `web/src/lib/api.ts:36-39` — `normalizeStatus<T>()`, a domain-parameterized normalizer (not the generic `normalizeDisplayStatus`). Called for Contracts at lines 671 (`getProject`), 1019 (`listContractsByProject`), 1026 (`getContract`), each passing `legacyContractStatusMap`/`contractStatuses` explicitly.
- `web/src/components/shared/status-badge.tsx:37,90` — still carries a `pending_signature: "Awaiting Signature"` tone/label entry as defensive fallback, even though the client-side normalization above means it's currently unreachable in practice for values coming through `api.ts`.
- `web/src/app/(app)/projects/[id]/contracts/[contractId]/page.tsx:51,69,111` — renders `contract.status === "signed"` / `!== "voided"` gates on the post-normalization canonical value.
- `web/src/app/(app)/portal/contracts/[contractId]/page.tsx:29,65` — same pattern; gates the sign form on `contract.status !== "signed" && contract.status !== "voided"`. This is broader than what the backend actually permits (backend only allows signing from the raw literal `pending_signature`); it works today only because no other raw value is reachable per Section 2.
- `web/src/app/actions/contracts.ts` — server actions wrapping the sign/void API calls; no independent status logic beyond passthrough.
- `web/src/lib/document-workflow.ts:85-88` — dead UI labels for `contract.sent`/`contract.viewed` event types the backend never emits (Section 7).

**Raw `pending_signature` is never exposed to a human through any Contract consumer** — every read path normalizes client-side before render, and `StatusBadge`'s literal fallback label is currently unreachable given that normalization.

## 11. Generic normalization collision findings

`normalizeDisplayStatus` (`app/domain/contracts.ts:296-303`), the context-free helper the S006 matrix describes as an active collision risk, **has zero call sites anywhere in the codebase outside its own definition** (verified by repo-wide grep). It is dead code today for every domain, not just Contracts. The frontend instead uses the domain-parameterized `normalizeStatus<T>()` (Section 10), called explicitly per-domain at each Contract site with the correct legacy map — there is no real collision risk in current runtime code for Contracts.

One additional correction to the S006 matrix while auditing this: it claims `legacyEstimateStatusMap.sent -> "ready"` as a live collision source; current code (`domain/contracts.ts:149-157`) shows `legacyEstimateStatusMap.sent: "sent"` (identity mapping). That specific claim appears to have been resolved since S006/S008 and is now stale, though it has no bearing on Contracts either way since Contracts never route through the generic helper.

**Recommendation:** continue using the parameterized `normalizeStatus` pattern for any new Contract call site S010 introduces; do not wire Contracts into `normalizeDisplayStatus`.

## 12. Proposed S010 implementation

Two candidate shapes were evaluated, not assumed:

**Option A — service/DTO-boundary normalization, zero migration (recommended).**
Persisted value stays `pending_signature`; `ContractsService`'s `toDTO()` (`service.ts:194-208`) maps it to canonical `sent` before returning the API response, using the existing `legacyContractStatusMap`/`normalizeContractStatus` from `app/domain/contracts.ts` (already exported, currently unused by the backend). No schema change, no default change, no historical row rewrite, no `sign()`/`void()` guard change. The frontend's existing `normalizeStatus()` calls become redundant-but-harmless for Contracts (they'd now normalize an already-canonical value) and can stay as-is — removing them is not required and is explicitly not part of this slice.

**Option B — additive constraint migration + default change.**
Widen the check constraint to accept `draft`/`sent`/`viewed` alongside the existing three values, change the column default to `sent` (or `draft`), and make new writes canonical at rest. This requires also rewriting `sign()`'s literal guard at `service.ts:62` (Section 6, answer 7) — otherwise every newly created contract becomes unsignable the moment the default changes. Option B is not smaller than it looks: it touches a Postgres constraint on a production table, needs migration rehearsal, and forces a service-layer change that Option A avoids entirely.

**Recommendation: Option A.** It is the smallest slice that makes the API contract honest (canonical `sent` at the DTO boundary, matching what the frontend already displays) without touching persistence, defaults, or the `sign()`/`void()` guards. Option B should not be attempted without an explicit founder decision that canonical **persistence** (not just canonical API surface) is required — see Section 19.

New lifecycle writes (i.e., anything `create()` does going forward) continue to rely on the DB default under Option A; there is no "new behavior" to gate separately since no send/view actions exist to normalize.

## 13. Migration decision

**No database migration under Option A.** The check constraint, default, and all three persisted values (`pending_signature`, `signed`, `voided`) are left exactly as they are. This satisfies the mission's stated migration policy (prefer additive compatibility, no historical row rewrite, no removal of `pending_signature`) trivially, because nothing is removed or rewritten.

If a founder decision later selects Option B: prefer an additive constraint widening (`ALTER TABLE contracts DROP CONSTRAINT ... ADD CONSTRAINT ... CHECK (status IN ('pending_signature','draft','sent','viewed','signed','voided'))`) over a destructive rewrite, keep `pending_signature` in the accepted set permanently (existing rows never get rewritten), and treat the `sign()` guard change as a required companion PR, not a follow-up.

## 14. Exact files expected to change (Option A)

- `app/modules/contracts/service.ts` — `toDTO()` only: map `row.status` through `normalizeContractStatus` (or equivalent) before assigning `status` on the returned DTO.
- `app/tests/contracts.service.test.ts` — extend to assert the DTO's `status` field is canonical `sent` for a freshly created contract, while the underlying stored value (if asserted anywhere) remains `pending_signature`.
- `app/tests/rls.integration.ts` — extend the existing cross-org contract block (Section 9) to assert the API-surface status is canonical post-normalization, without changing its cross-org assertions.
- `docs/LIFECYCLE_COMPATIBILITY_MATRIX.md` — correct the Contract row and the S010-input section: `draft`/`sent`/`viewed` are not currently DB-legal (they are canonical-but-unreachable, not "canonical states not centered in current documentation"); note the resolved `legacyEstimateStatusMap.sent` claim is stale. This is documentation correction work that ships **with** the S010 implementation PR, not during this planning task.
- `docs/SPRINT_BACKLOG.md` — status/acceptance update for S010 at implementation time (not part of this planning artifact).

## 15. Exact files forbidden

- Anything under `app/db/**`, `app/.env.example`, `docs/DEPLOYMENT_GUIDE.md`, Vercel/runtime environment configuration — owned by PR #268.
- `docs/CURRENT_STATE.md`, `web/src/app/(app)/dashboard/**` — owned by PR #258.
- `app/prisma/schema.prisma`, any `app/prisma/migrations/**` file — forbidden under Option A; only in scope under Option B, and only after the founder decision in Section 19.
- `app/domain/contracts.ts` `contractTransitions`/`canTransitionContractStatus` — do not wire these into `sign()`/`void()` as part of this slice; that is a separate behavioral change from vocabulary normalization and was not proven safe by this audit (Section 5's divergence note).
- Any fix to the three runtime defects in Section 18 (`void()` non-idempotency, missing `$transaction` boundaries, missing optimistic-concurrency guards) — real bugs, but not S010. Track them as a separate ticket.
- `web/src/lib/api.ts`, `web/src/components/shared/status-badge.tsx`, any `web/**` file — no frontend change is required for Option A; the existing client-side normalization already produces the correct display and becomes simply redundant, not wrong.
- Customer-portal auth (`web/src/proxy.ts`, portal session handling) — S018's scope, not S010's (Section 9, Section 19).
- Proposal lifecycle, Invoice lifecycle, dashboard, Costbook, Athena, billing, e-signature provider integration, document-engine rewrite, historical status cleanup beyond the one Contract row correction above — all explicitly out of scope per the mission's forbidden-expansion list.

## 16. Regression test matrix

Extend existing files rather than inventing new suites:

| Test | File to extend | Assertion |
|---|---|---|
| Contract creation returns canonical status | `app/tests/contracts.service.test.ts` | `toDTO(...).status === "sent"` for a newly created row whose underlying `status` column is `pending_signature` |
| Historical `pending_signature` rows normalize on read | `app/tests/contracts.service.test.ts` | `getById()`/`listByProject()` on a row seeded directly with `pending_signature` returns canonical `sent` |
| Sign transition still enforced from the correct raw state | `app/tests/contracts.service.test.ts:92-147` (existing) | unchanged — Option A does not touch `sign()`'s guard |
| Double sign rejected | `app/tests/contracts.service.test.ts:149-160` (existing) | unchanged |
| Void before sign succeeds | `app/tests/contracts.service.test.ts` (existing void tests) | unchanged |
| Void after sign rejected | `app/tests/contracts.service.test.ts:162-174` (existing) | unchanged |
| Repeated void (documented as a known gap, not fixed here) | none — explicitly not remediated under S010; note in the PR description as a known pre-existing gap | N/A |
| Organization isolation for contract + contract events | `app/tests/rls.integration.ts` (existing cross-org contract block) | extend to assert the DTO-level status returned to the in-org session is canonical, while the cross-org lookup still returns `null`/`[]` |
| Portal authorization | out of scope — no portal-specific auth exists to test (Section 9) | N/A |
| Audit/event count unchanged | `app/tests/contracts.service.test.ts` | assert event count per action is unaffected by the DTO normalization (it's a pure read-side mapping) |
| Signature metadata preserved | `app/tests/contracts.service.test.ts` (existing) | unchanged |
| Project relationship preserved | `app/tests/contracts.service.test.ts` / `rls.integration.ts` (existing) | unchanged |
| Database constraint acceptance | none needed under Option A (no schema change) | N/A |
| PostgreSQL/RLS behavior | `app/tests/rls.integration.ts` | unchanged cross-org assertions, extended per above |

## 17. PostgreSQL/RLS verification plan

Under Option A, no schema or constraint changes occur, so no migration rehearsal against the check constraint is required. Verification is limited to: (1) confirming `app/tests/rls.integration.ts`'s existing cross-org contract assertions still pass unmodified after the DTO change, and (2) confirming the extended assertions in Section 16 pass against a real (non-mocked) database session, consistent with how that file already operates. If Option B is ever pursued, this section must be redone with an explicit `ALTER TABLE ... CHECK` rehearsal against a copy of production-shaped data before any migration is written.

## 18. Risk assessment

- **Low risk (Option A):** a pure read-side mapping at the DTO boundary. No persisted data changes, no constraint changes, no change to `sign()`/`void()` preconditions. The main risk is a missed call site that still returns `row.status` raw somewhere outside `toDTO()` — grep confirms `toDTO()` is the sole DTO constructor for Contracts, so this is contained.
- **Pre-existing defects found during this audit, explicitly not in scope for S010:**
  1. `void()` is not idempotent — calling it on an already-`voided` contract succeeds again and writes a duplicate `contract.voided` event and activity record (`service.ts:90-105`, no test coverage today).
  2. Neither `sign()` nor `void()` wraps its status update and event write in a `$transaction` — a crash between the two calls leaves the status changed with no corresponding audit event.
  3. Neither mutation guards its `prisma.contract.update` with the expected prior status (`where: { id }` only) — concurrent duplicate sign or void requests can both pass their read-time check and both write.
  These are real correctness gaps but are orthogonal to vocabulary normalization; bundling a fix into S010 would violate the mission's smallest-safe-slice instruction and its explicit prohibition on scope expansion.
- **Documentation risk:** `docs/LIFECYCLE_COMPATIBILITY_MATRIX.md` is marked `source_of_truth: true` and is demonstrably wrong about Contracts' persisted-vs-canonical relationship (it implies `draft`/`viewed` are simply under-documented rather than DB-illegal). This plan does not correct it now (forbidden during this planning task) but flags the correction as required work shipped with the S010 implementation PR (Section 14).

## 19. Open questions requiring a founder decision

1. **Does S010 need canonical persistence, or is a canonical API surface sufficient?** This is the Option A vs. Option B choice in Section 12. Option A satisfies "contract state transitions are consistent and auditable" (the SPRINT_BACKLOG acceptance criterion) at the API/audit-trail level without a schema change. Option B additionally makes the *stored* value canonical, at the cost of a constraint migration and a required `sign()` guard rewrite. This plan recommends Option A but the choice of how far "normalization" should reach into persistence is a product/doctrine call, not a technical one.
2. **Customer-portal authorization gap.** `portal/contracts/[contractId]` uses the same internal Supabase session as the authenticated app, not a distinct customer-facing token boundary. This audit surfaces it as a finding; it is explicitly S018's scope (customer portal authentication hardening) and must not be redesigned under S010. Founder input needed only on sequencing (whether S018 should be pulled forward given S010 touches adjacent code).
3. **Should the three defects in Section 18 become their own ticket now, or wait?** Not blocking S010, but worth an explicit decision so they don't get silently dropped.

## 20. Recommended S010 acceptance criteria

- `ContractsService.toDTO()` returns canonical `sent` for any row whose persisted `status` is `pending_signature`; `signed` and `voided` pass through unchanged (they are already canonical).
- No change to the `contracts` table schema, default, or check constraint.
- No change to `sign()`'s or `void()`'s transition guards or preconditions.
- `app/tests/contracts.service.test.ts` and the cross-org block in `app/tests/rls.integration.ts` cover the DTO-level normalization and pass against a real database session.
- `docs/LIFECYCLE_COMPATIBILITY_MATRIX.md`'s Contract row and S010-input section are corrected to state that `draft`/`sent`/`viewed` are canonical-but-currently-DB-illegal (not simply under-documented), as part of the same implementation PR.
- No frontend (`web/**`) file changes required or made.
- No new e-signature, document-engine, or portal-auth work introduced.
