---
status: draft
owner: platform
last_verified: 2026-08-23
source_of_truth: false
related_code:
  - app/prisma/schema.prisma
  - app/prisma/migrations/20260624100000_add_proposals_invoices_contracts/migration.sql
  - app/domain/contracts.ts
  - app/modules/invoices/service.ts
  - app/modules/crm/service.ts
  - app/backend/controllers/invoices.controller.ts
  - app/backend/routes/invoices.routes.ts
  - app/backend/routes/crm.routes.ts
  - web/src/lib/api.ts
  - web/src/components/shared/status-badge.tsx
  - web/src/components/dashboard/needs-attention-card.tsx
  - web/src/components/dashboard/needs-attention-model.ts
  - web/src/app/(app)/projects/[id]/invoices/[invoiceId]/page.tsx
  - web/src/app/(app)/portal/invoices/[invoiceId]/page.tsx
related_docs:
  - docs/LIFECYCLE_COMPATIBILITY_MATRIX.md
  - docs/WORKFLOW_LIFECYCLES.md
  - docs/modules/invoices-and-payments.md
  - docs/SPRINT_BACKLOG.md
  - docs/architecture/S010_CONTRACT_LIFECYCLE_PLAN.md
---

# S011 — Invoice Lifecycle Normalization: Readiness/Planning Audit

**This is a planning artifact only.** No runtime code was modified to produce it. S011 remains `Status: PLANNED` in `docs/SPRINT_BACKLOG.md`; this document does not promote it and does not implement it. It corresponds to the "Perform a bounded S011 readiness/planning reconciliation" step recorded as follow-up work after the merged S010 completion-evidence PR (#279), and mirrors the audit methodology and document shape of `docs/architecture/S010_CONTRACT_LIFECYCLE_PLAN.md` (commit `5e0e67e`).

## 1. Executive verdict

S011's problem shape is **not** the same as S010's, and a plain restatement of S006's Invoice row would be misleading if promoted to `READY` as-is.

S010's core problem was that the API returned a raw, non-canonical persisted value (`pending_signature`) with no normalization anywhere in the read path — a zero-migration DTO-boundary fix closed the whole gap in one bounded slice.

For Invoices, that DTO-boundary normalization **already exists and already works**: `InvoicesService.toDTO()` and `toInvoiceQueueItemDTO()` both call `normalizeInvoiceStatus()` (`app/domain/contracts.ts:292-294`), which maps the live check-constraint-legal raw value `void` to canonical `voided` via `legacyInvoiceStatusMap` (`contracts.ts:187-197`). PR #255 (merged 2026-08-20, `550fff8`) independently confirmed and hardened the write side of that same mapping by making `InvoicesService.void()` persist the constraint-compatible raw `void` instead of attempting the illegal canonical `voided`. So the "S010-shaped" half of S011 is already done, on `main`, today.

What remains is a different, two-part problem:

1. **Vocabulary reachability, not vocabulary translation.** Two canonical Invoice states (`viewed`, `partially_paid`) are **not legal in the database at all** — the `invoices.status` check constraint has never accepted them, exactly like S010's `draft`/`viewed` finding for Contracts. A third (`overdue`) **is** DB-legal but is **never written by any code path** — it is computed only at query time, never persisted. All three are present in `app/domain/contracts.ts`'s shared `invoiceStatuses`/`invoiceTransitions` as if they were live, enforced transitions; they are not.
2. **A real functional gap, with no Contract analogue.** Recording a payment (`POST /api/v1/invoices/:id/payments`, `CrmService.createPayment`) never reads or writes `Invoice.status`. An invoice that is fully paid off through recorded payments stays `sent` until someone separately calls the unrelated `POST /api/v1/invoices/:id/mark-paid` action. There is also no UI caller of the payment-recording API anywhere in `web/src` — it is backend-only today.

Section 12 recommends the smallest safe S011 implementation slice for a future implementation PR: no schema migration, and it targets only the functional gap in point 2 (auto-transitioning a fully-covered invoice to canonical `paid`, which is already DB-legal and already used), while leaving `partially_paid`/`overdue`/`viewed` persistence as an explicitly deferred, founder-decision item (Section 19), matching how S010 deferred `viewed`.

This audit also reproduces all three defect classes S010 found for Contracts — void non-idempotency, missing transaction boundaries, missing optimistic-concurrency guards — independently, in Invoices' `send()`/`markPaid()`/`void()`. They are documented in Section 17 and explicitly out of scope for S011, exactly as S010 scoped its own findings.

## 2. Current persisted vocabulary

The Postgres check constraint on `invoices.status`, unchanged since the table's creation migration (`app/prisma/migrations/20260624100000_add_proposals_invoices_contracts/migration.sql:24-28`), is:

```sql
status text not null default 'draft'
       check (status in ('draft', 'sent', 'paid', 'overdue', 'void')),
```

No later migration touches this constraint. `app/prisma/migrations/20260706120000_add_beta_backend_foundation/migration.sql` and `app/prisma/migrations/20260714162000_add_invoice_and_contract_history/migration.sql` only add the `payments` and `invoice_deliveries` tables (foreign-keyed to `invoices`); neither alters `invoices.status` or its constraint.

DB-legal raw values today: `draft`, `sent`, `paid`, `overdue`, `void`. Note the constraint spells the voided terminal state `void`, not canonical `voided` — this is the same raw/canonical spelling mismatch S010 found for `pending_signature`, except here it was already closed by PR #255 plus the pre-existing `legacyInvoiceStatusMap`.

## 3. Canonical vocabulary

`app/domain/contracts.ts:185-186`:

```ts
export const invoiceStatuses = ["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "voided"] as const;
```

Comparing against Section 2's DB-legal set:

| Canonical value | DB-legal? | Ever written by a service method? |
|---|---|---|
| `draft` | Yes (default) | Yes — `create()` |
| `sent` | Yes | Yes — `send()` |
| `viewed` | **No** | **No** |
| `partially_paid` | **No** | **No** |
| `paid` | Yes | Yes — `markPaid()` |
| `overdue` | Yes | **No** |
| `voided` | No (raw `void` only) | Yes, as raw `void` — `void()`, normalized to canonical `voided` at every read path |

`viewed` and `partially_paid` are canonical-but-currently-DB-illegal, the same class of finding S010 made for Contract's `draft`/`sent`/`viewed`. `overdue` is a third, distinct class this audit adds: canonical **and** DB-legal, but dead — nothing in the codebase ever sets `Invoice.status` to `overdue`.

## 4. Compatibility boundary

`legacyInvoiceStatusMap` (`contracts.ts:187-197`):

```ts
export const legacyInvoiceStatusMap: Record<string, InvoiceStatus> = {
  draft: "draft",
  sent: "sent",
  viewed: "viewed",
  partially_paid: "partially_paid",
  paid: "paid",
  overdue: "overdue",
  void: "voided",
  voided: "voided",
  cancelled: "voided",
};
```

The only real compatibility translation is `void -> voided`, applied by `normalizeInvoiceStatus()` at every read path: `InvoicesService.toDTO()` (`service.ts:425`), `toInvoiceQueueItemDTO()` (`service.ts:384`), and redundantly-but-harmlessly again client-side in `web/src/lib/api.ts` (`getInvoice`, line ~947; `listInvoiceQueue`, line ~988) via the same shared map. `cancelled` is a defensive legacy synonym the constraint has never permitted and no write path can produce — same status as Contract's dormant aliases; `docs/modules/invoices-and-payments.md` (line 57) already documents this accurately for the work-queue's voided-exclusion filter.

Everything else in the map (`viewed`, `partially_paid`, `overdue`, and the identity entries) is not a compatibility translation at all — it is the map asserting that those raw strings equal their own canonical spelling, which is true in principle but moot in practice since none of them ever appears as a real `Invoice.status` value (Section 3).

## 5. Current transition table (proven from runtime code, not inferred)

`InvoicesService` (`app/modules/invoices/service.ts`) exposes exactly four status-mutating methods:

| From (guard) | Method | To | Notes |
|---|---|---|---|
| `draft` (`row.status !== "draft"` throws) | `send()` (`:236-251`) | `sent` | Sets `sentAt`; records `invoice.sent` |
| `sent` or `overdue` (allowlist) | `markPaid()` (`:253-268`) | `paid` | Sets `paidAt`; records `invoice.paid`. The `overdue` branch is unreachable in practice — see Section 8 |
| anything except `paid` (blocklist) | `void()` (`:270-285`) | `void` (raw) | Records `invoice.voided` (canonical) via delivery + activity metadata; raw persisted value stays `void` |
| n/a | `create()` (`:23-80`) | `draft` (Prisma column default; never set explicitly in the `.create()` payload) | Records `invoice.created` |

No method ever writes `viewed`, `partially_paid`, or `overdue`. The shared `invoiceTransitions` table (`contracts.ts:344-352`) claims a richer graph:

```ts
const invoiceTransitions: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  draft: ["sent", "voided"],
  sent: ["viewed", "partially_paid", "paid", "overdue", "voided"],
  viewed: ["partially_paid", "paid", "overdue", "voided"],
  partially_paid: ["paid", "overdue", "voided"],
  paid: [],
  overdue: ["partially_paid", "paid", "voided"],
  voided: [],
};
```

This exactly mirrors S010's Section 5 finding for Contracts: `canTransitionInvoiceStatus()` describes enforced-looking behavior for six source states, but only two of them (`draft`, `sent`/`overdue` as a markPaid source) are ever reached by a real guard in `InvoicesService`. `viewed`, `partially_paid`, and `overdue`-as-a-source-state are configuration for a graph that no runtime code path can enter.

## 6. `void`/`voided` — already resolved, not an S011 gap

Unlike S010's `pending_signature`, this raw/canonical mismatch does not need S011 work. PR #255 (`fix(invoices): persist constraint-compatible void status`, merged 2026-08-20 as `550fff8`) made `void()` persist the constraint-legal raw `void` while `toDTO()`'s pre-existing `normalizeInvoiceStatus()` call already normalized it to canonical `voided` at every read path, and delivery/activity metadata already recorded canonical `invoice.voided` / `newStatus: "voided"`. `app/tests/invoices.void.test.ts` pins this. No further vocabulary change is needed here; Section 12 does not touch it.

## 7. `viewed` status findings

Same conclusion as S010's Section 7 for Contracts, reached independently: no code path ever sets `Invoice.status` to `viewed`. There is no `viewedAt` column, no delivery-event type for a view, and the customer portal invoice page (`web/src/app/(app)/portal/invoices/[invoiceId]/page.tsx`) is read-only — it renders the existing `StatusBadge` from whatever status the API already returned and does not call any mutation endpoint on load. `status-badge.tsx` carries a `viewed` tone entry (line 55) purely as defensive/shared styling, not because it is reachable for invoices. Building `viewed` tracking would require the same class of new infrastructure S010 deferred for Contracts (a view-tracking column/event, wired into the portal read path) and is not attempted here.

## 8. `overdue` and `partially_paid` findings — dead persisted-status configuration, live derived display

This is the finding class with no Contract analogue, because Contracts never had a "compute at read time instead of persisting" design for any of its states.

`InvoicesService.listOrganizationQueue()` (`service.ts:102-187`) computes `overdue`/`partiallyPaid`/`unpaid` entirely from SQL predicates over `due_date` and a payment-derived `balance_due` (`service.ts:113-121`), never by reading or writing `Invoice.status`:

```sql
-- overdue:
due_date IS NOT NULL AND due_date < now() AND balance_due > 0 AND status NOT IN (...)
-- partiallyPaid:
paid_amount > 0 AND balance_due > 0 AND status NOT IN (...)
```

The only frontend consumer that displays an "Overdue" or "Partially Paid" badge, `web/src/components/dashboard/needs-attention-card.tsx:193`, derives the badge status client-side the same way — from which query bucket (`overdue: true` vs `unpaid: true`) a row came back in, and from `paidAmount > 0`, not from `item.status`:

```tsx
<StatusBadge status={row.overdue ? "overdue" : row.paidAmount > 0 ? "partially_paid" : row.status} />
```

So `overdue`/`partially_paid` are real, working, displayed states — but they are computed independently in at least two places (the queue's SQL predicate and the dashboard's client-side derivation) rather than owned by one normalization function the way `normalizeInvoiceStatus()` owns `void -> voided`. `Invoice.status` itself never contains `overdue` or `partially_paid` on any real row; a `sent` invoice that is three weeks late still has `status: "sent"` in every API response, and the persisted-status side of the shared `invoiceTransitions` graph (`overdue -> [...]`, `sent -> [..., "overdue", ...]`) is consequently unreachable in the current architecture, exactly as flagged in Section 5.

`markPaid()`'s guard `!["sent", "overdue"].includes(row.status)` (`service.ts:256`) therefore has a dead disjunct: no invoice can ever actually have `status === "overdue"` when `markPaid()` runs, so that branch of the allowlist is currently unreachable configuration, not a bug that changes observed behavior today.

Persisting `overdue` for real would require a scheduled sweep (a background job periodically transitioning past-due invoices), which is new infrastructure and a genuine architecture decision, not a documentation or DTO-boundary fix. Persisting `partially_paid` for real would additionally require a schema/constraint migration, since it is not DB-legal (Section 2). Both are deferred to Section 19.

## 9. Payment-to-invoice-status disconnect (functional gap, no Contract analogue)

`CrmService.createPayment()` (`app/modules/crm/service.ts:435-449`) is the only code path that writes a `Payment` row:

```ts
async createPayment(orgId: string, invoiceId: string, input: PaymentInput) {
  await this.assertInvoice(orgId, invoiceId);
  return prisma.payment.create({
    data: { orgId, invoiceId, amount: input.amount, paymentDate: new Date(input.paymentDate),
             method: input.method, status: input.status ?? "recorded",
             reference: emptyToNull(input.reference), notes: emptyToNull(input.notes) },
  });
}
```

It never reads `Invoice.status`, never computes the invoice's remaining balance, and never calls `prisma.invoice.update(...)`. So recording a payment — even one that exactly covers an invoice's full balance — leaves `Invoice.status` untouched. The only way an invoice's status becomes `paid` is the fully separate, manually-triggered `POST /api/v1/invoices/:id/mark-paid` action, which itself does not look at recorded payments or verify the balance is actually zero; it only checks the current status is `sent`/`overdue` (Section 8).

Confirmed via repository-wide search: no route or component under `web/src` calls `POST /api/v1/invoices/:id/payments` or `GET /api/v1/invoices/:id/payments` anywhere. The internal invoice detail page (`web/src/app/(app)/projects/[id]/invoices/[invoiceId]/page.tsx:93-94`) renders a "Payment history" section that only checks `invoice.paidAt` for a binary "Paid in full" / "No payments recorded yet" label — it does not call `listPayments()` and cannot display an actual partial-payment list. Payment recording is a backend-only capability today; there is no way for an owner/admin to record a payment through the app UI.

This is the one concrete item in Section 12's recommended smallest-safe slice, because closing it requires no schema change (`paid` is already DB-legal and already the value `markPaid()` writes) and no founder decision about new architecture — only wiring the existing, already-correct `paid` transition to fire from the existing payment-recording write path when it fully covers the balance.

## 10. Tenant/RLS boundary

`app/tests/rls.integration.ts`'s cross-org invoice block (`~1108-1180`) creates, sends, and marks an invoice paid in `orgA` via `InvoicesService`, then confirms `orgB` cannot read it — the same pattern S010 relied on as its regression baseline for Contracts. Invoice write policies (`invoices_write_policy`, `invoice_line_items` policy) come from the same `20260624100000_add_proposals_invoices_contracts/migration.sql` that defines the status check constraint; neither this audit nor Section 12's recommended slice touches RLS, permissions, or tenant scoping. `assertInvoiceWriteAccess()` (`service.ts:483-487`) already gates every mutating method on `billing.write`; `createPayment` gates through `assertInvoice` (org-scoped existence check) in `CrmService`. No gap found here.

## 11. Frontend/portal consumers

- `web/src/lib/api.ts` re-applies `normalizeStatus(invoice.status, legacyInvoiceStatusMap, invoiceStatuses, "draft")` client-side on both `getInvoice()` and `listInvoiceQueue()` — redundant-but-harmless given the server already normalizes, the same pattern S010 found and left alone for Contracts.
- `status-badge.tsx` carries tone/label entries for `overdue`, `partially_paid`, `voided`, and `viewed` (lines 34, 38, 55, 57, 89) even though only `voided` (via normalized raw `void`) can ever actually reach the badge from a persisted `Invoice.status` — `overdue`/`partially_paid` reach it only through the client-side derivation in Section 8, never through `item.status` itself.
- The portal invoice page (`web/src/app/(app)/portal/invoices/[invoiceId]/page.tsx`) is read-only display; no separate customer-facing authorization boundary exists for invoices beyond the same internal Supabase session every other authenticated route uses — same finding S010 made for the Contract portal page, and out of scope here for the same reason (S018).

## 12. Proposed S011 implementation (recommended smallest safe slice)

No database migration. Change `CrmService.createPayment()` (or a thin wrapper it calls) to, within the same request-scoped transaction as the `Payment` insert:

1. Recompute the invoice's total recorded-payment sum including the new payment.
2. If that sum is `>=` the invoice's `amount` **and** the invoice's current status is `sent` (the only status from which the existing `markPaid()` allows a `paid` transition that is actually reachable per Section 8), transition `Invoice.status` to `paid` and set `paidAt`, reusing the existing `invoice.paid` delivery/activity event shape `markPaid()` already writes.
3. If the sum is greater than zero but less than `amount`, do **not** attempt to persist `partially_paid` — it is not DB-legal (Section 2) and making it legal is a schema decision, not an implementation detail, deferred to Section 19.

This closes the concrete functional gap from Section 9 (a fully-paid invoice actually becomes `paid`) using only the transition that is already DB-legal, already used, and already has passing regression tests (`app/tests/invoices.service.test.ts:167`, `"marks a sent invoice paid"`) — extend that same test file with a payment-triggered-paid case rather than inventing a new mechanism.

Matrix/workflow-lifecycle/module-doc corrections (Sections 2-9 of this audit) ship with that future S011 implementation PR, not during this planning task — the same sequencing S010 used (see `docs/architecture/S010_CONTRACT_LIFECYCLE_PLAN.md` Section 14).

## 13. What Option A deliberately does not do

- Does not persist `overdue` (Section 8 — requires a scheduled-sweep architecture decision, Section 19).
- Does not persist `partially_paid` (Section 8 — requires a constraint migration, Section 19).
- Does not build `viewed` tracking (Section 7 — requires new portal-side infrastructure, same as S010's deferred Contract `viewed`).
- Does not add a payment-recording UI (Section 9 — the API exists and would be reused as-is; building the missing frontend form is separate product/UI scope, not a lifecycle-normalization concern).
- Does not touch `void()`, `send()`, or their guards.
- Does not fix any of the three defects in Section 17.

## 14. Exact files expected to change (future Option A implementation PR)

- `app/modules/crm/service.ts` — `createPayment()` gains the balance-check + conditional `paid` transition, in a transaction with the `Payment` insert.
- `app/tests/invoices.service.test.ts` and/or `app/tests/payments.service.test.ts` — new coverage for the payment-triggered `paid` transition (full payment closes the invoice; partial payment leaves status unchanged; payment on an already-voided or already-paid invoice is rejected or no-ops safely — needs an explicit decision at implementation time, not invented here).
- `docs/LIFECYCLE_COMPATIBILITY_MATRIX.md` — correct the Invoice row and the S011-input section: `viewed`/`partially_paid` are canonical-but-currently-DB-illegal (not "documented transitions differ" as currently phrased); `overdue` is DB-legal but dead configuration, derived and displayed independently of `Invoice.status`.
- `docs/WORKFLOW_LIFECYCLES.md` — correct the Invoice section's "Current enforced transitions" list to state plainly that `overdue`/`partially_paid`/`viewed` are never persisted, and that `overdue`/`partiallyPaid` are read-time-derived queue/dashboard labels, not lifecycle transitions.
- `docs/modules/invoices-and-payments.md` — document the new payment-triggered `paid` transition alongside the existing manual `mark-paid` action, and note the still-missing payment-recording UI as a known limitation if not also closed in the same PR.
- `docs/SPRINT_BACKLOG.md` — status/acceptance update for S011 at implementation time (not part of this planning artifact).

## 15. Exact files forbidden for the Option A slice

- `app/prisma/schema.prisma`, any new migration touching `invoices.status` or its check constraint.
- `app/modules/invoices/service.ts`'s `send()`, `void()`, or their guards.
- Any RLS policy, permission key, or `assertInvoiceWriteAccess`/`assertInvoice` boundary.
- `app/domain/contracts.ts`'s `invoiceStatuses`, `legacyInvoiceStatusMap`, or `invoiceTransitions` — none of them need a code change for Option A; only the docs describing them need correcting.
- Any new frontend payment-recording form (Section 13).
- Any fix to the three defects in Section 17.

## 16. Regression test matrix (for the future implementation PR)

| Behavior | Test file | Assertion |
|---|---|---|
| Payment fully covering balance transitions invoice to `paid` | `app/tests/invoices.service.test.ts` or `app/tests/payments.service.test.ts` | after `createPayment()` with `amount === invoice.amount`, `getById(...).status === "paid"` and `paidAt` is set |
| Partial payment does not change status | same | after `createPayment()` with `amount < invoice.amount`, `status` remains `"sent"` |
| Payment on a non-`sent` invoice does not silently transition it | same | payment recorded against a `draft`, `voided`, or already-`paid` invoice leaves status unchanged (or the exact rejection behavior decided at implementation time) |
| Existing manual `mark-paid` path is unaffected | `app/tests/invoices.service.test.ts:167` | unchanged, still passes |
| Existing `void()` raw-value regression is unaffected | `app/tests/invoices.void.test.ts` | unchanged, still passes |

## 17. Pre-existing defects found during this audit, explicitly out of scope for S011

Independently reproducing all three defect classes S010 found for Contracts (`docs/architecture/S010_CONTRACT_LIFECYCLE_PLAN.md` Section 18), now confirmed in Invoices:

1. **`void()` non-idempotency.** `InvoicesService.void()` (`service.ts:270-285`) only blocks `status === "paid"`; it does not check whether the invoice is already `void`. Calling it twice on an already-voided invoice succeeds a second time and writes a duplicate `invoice.voided` delivery/activity record. `send()` and `markPaid()` do not share this gap — both use an allowlist/single-precondition guard (`row.status !== "draft"`, `!["sent","overdue"].includes(row.status)`) that naturally rejects a repeat call.
2. **Missing transaction boundaries around status + event writes.** `send()`, `markPaid()`, and `void()` each perform `prisma.invoice.update(...)` and the subsequent `recordDeliveryEvent(...)` (which itself does a separate `invoiceDelivery.create` and `activityService.record`) as sequential, unwrapped `await`s — not inside a `$transaction`. A failure after the status write but before the event write leaves the invoice's status changed with no corresponding audit trail.
3. **Missing optimistic-concurrency guards.** Every mutating method's `prisma.invoice.update({ where: { id } })` call keys only on `id`, with no expected-prior-status predicate. Two concurrent `markPaid()` calls (or a `markPaid()` racing a `void()`) can both succeed against a stale read, silently overwriting one outcome.

These are real correctness gaps, orthogonal to lifecycle vocabulary. Bundling a fix into S011 would violate the same smallest-safe-slice discipline S010 used. Track them as a separate ticket — likely the same ticket as S010's three deferred Contract defects, since the fix (an expected-status `where` predicate plus a `$transaction` wrapper) is structurally identical across both services.

## 18. Risk assessment

- **Vocabulary risk:** low. Section 6 shows the highest-risk half of a typical lifecycle-normalization slice (raw/canonical DTO mismatch) is already resolved on `main`. No schema migration is proposed.
- **Documentation risk:** `docs/LIFECYCLE_COMPATIBILITY_MATRIX.md` is marked `source_of_truth: true` and currently describes the Invoice drift as "documented transitions differ from the richer shared contract" (a wording that reads as under-documentation), when the actual finding is that `viewed`/`partially_paid` are DB-illegal and `overdue` is dead configuration — the same class of correction S010 made for its own matrix row. Not corrected now (deferred to the implementation PR per Section 14, matching S010's own precedent), but flagged here as required work.
- **Functional risk of the proposed Option A slice itself:** low — it only wires an existing, already-tested transition (`sent -> paid`) to fire from an additional trigger (a balance-covering payment) instead of only the existing manual action, and only touches `CrmService.createPayment()`.

## 19. Open questions requiring a founder/product decision

1. **Should `overdue` ever be a persisted `Invoice.status` value, or is compute-at-read-time (the current design) actually correct?** Persisting it requires a new scheduled-job mechanism (nothing in this repository currently sweeps rows on a time-only trigger for lifecycle transitions) and raises staleness questions the current derived-at-read design avoids for free. This plan does not recommend persisting it without an explicit decision that the derived design is insufficient.
2. **Should `partially_paid` become a real persisted status**, requiring a constraint migration (`ALTER TABLE invoices DROP CONSTRAINT ... ADD CONSTRAINT ... CHECK (status IN ('draft','sent','viewed','partially_paid','paid','overdue','voided'))` or similar, matching the additive pattern S010's Section 13 recommended for Contracts if Option B were ever chosen there), or is the current dashboard-only derived badge (Section 8) sufficient for "API, UI, and reporting agree on invoice state"? If a migration is chosen, it should also resolve the `void`/`voided` raw-spelling mismatch (Section 2) as part of the same widening, rather than leaving that asymmetry in place indefinitely.
3. **Should a payment-recording UI be built**, and if so, in which surface (the internal invoice detail page, a new dedicated flow, or folded into a future S021 portal-invoice-payment-presentation slice)? Section 9's API already exists; only the UI and Section 12's status-transition wiring are missing. This is product-surface scope, not lifecycle-vocabulary scope, and should not be silently absorbed into S011.
4. **Should the three defects in Section 17 become their own ticket now, shared with S010's identical Contract findings**, or wait? Not blocking S011, but worth an explicit decision so they are not silently dropped across two independent audits that found the same pattern.

## 20. Recommended S011 acceptance criteria (for a future promotion PR)

- `CrmService.createPayment()` transitions a `sent` invoice to canonical `paid` (reusing the existing `markPaid()` event/audit shape) when a recorded payment brings its balance to exactly zero or below; a partial payment leaves status unchanged.
- No schema, migration, RLS, permission, or `send()`/`void()` guard change.
- `docs/LIFECYCLE_COMPATIBILITY_MATRIX.md`'s Invoice row and S011-input section are corrected to state that `viewed`/`partially_paid` are canonical-but-currently-DB-illegal and `overdue` is DB-legal-but-dead-configuration, derived and displayed independently of `Invoice.status`, as part of the same implementation PR.
- `docs/WORKFLOW_LIFECYCLES.md`'s Invoice section and `docs/modules/invoices-and-payments.md` are updated to describe the new payment-triggered transition and the still-open items from Section 19.
- The three pre-existing defects in Section 17 remain explicitly out of scope and unfixed, tracked separately.
- Persisting `overdue`, persisting `partially_paid`, and building `viewed` tracking or a payment-recording UI remain explicitly out of scope pending the founder/product decisions in Section 19.
