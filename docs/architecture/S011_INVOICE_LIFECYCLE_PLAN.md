---
status: ready
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

**This is a planning artifact only.** No runtime code was modified to produce it. S011 is promoted to `Status: READY` in `docs/SPRINT_BACKLOG.md` by a separate governance-only readiness promotion; this document does not implement it. The founder-approved decisions are now explicit: overdue remains derived, partially-paid remains derived, payment-entry UI expansion is deferred, and S011 owns backend payment reconciliation correctness. The approved implementation is the bounded slice in Section 12 and must begin only from refreshed `origin/main` after the promotion merges.

## 1. Executive verdict

S011's problem shape is **not** the same as S010's, and a plain restatement of S006's Invoice row would be misleading if promoted to `READY` as-is.

S010's core problem was that the API returned a raw, non-canonical persisted value (`pending_signature`) with no normalization anywhere in the read path — a zero-migration DTO-boundary fix closed the whole gap in one bounded slice.

For Invoices, that DTO-boundary normalization **already exists and already works**: `InvoicesService.toDTO()` and `toInvoiceQueueItemDTO()` both call `normalizeInvoiceStatus()` (`app/domain/contracts.ts:292-294`), which maps the live check-constraint-legal raw value `void` to canonical `voided` via `legacyInvoiceStatusMap` (`contracts.ts:187-197`). PR #255 (merged 2026-08-20, `550fff8`) independently confirmed and hardened the write side of that same mapping by making `InvoicesService.void()` persist the constraint-compatible raw `void` instead of attempting the illegal canonical `voided`. So the "S010-shaped" half of S011 is already done, on `main`, today.

What remains is a different, two-part problem:

1. **Vocabulary reachability, not vocabulary translation.** Two canonical Invoice states (`viewed`, `partially_paid`) are **not legal in the database at all** — the `invoices.status` check constraint has never accepted them, exactly like S010's `draft`/`viewed` finding for Contracts. A third (`overdue`) **is** DB-legal but is **never written by any code path** — it is computed only at query time, never persisted. All three are present in `app/domain/contracts.ts`'s shared `invoiceStatuses`/`invoiceTransitions` as if they were live, enforced transitions; they are not.
2. **A real state-reconciliation gap, with no Contract analogue.** Recording a payment (`POST /api/v1/invoices/:id/payments`, `CrmService.createPayment`) never reads or writes `Invoice.status`, so a fully covered invoice stays `sent` until the separate `POST /api/v1/invoices/:id/mark-paid` action runs. Conversely, the manual `markPaid()` path sets `Invoice.status = paid` without creating a `Payment` row, while the organization queue derives `balance_due` only from recorded payments and its unpaid/overdue predicates currently exclude voided states but not `paid`. A manually-paid invoice can therefore still appear in follow-up queues with a positive derived balance. There is also no UI caller of the payment-recording API anywhere in `web/src` — it is backend-only today.

Section 12 defines the approved smallest safe S011 implementation slice: no schema migration; make recorded payments drive the existing `sent -> paid` transition safely, and make the queue's derived follow-up predicates respect an already-persisted `paid` status so the existing manual path and the payment-derived path agree. The founder has approved that `partially_paid` and `overdue` remain derived, payment-entry UI expansion is deferred, and S011 owns backend payment reconciliation correctness. `viewed` persistence remains outside this sprint.

This audit also confirms two status-mutation defect classes S010 found for Contracts — void non-idempotency and missing optimistic-concurrency guards — independently in Invoices. The production HTTP routes themselves already run inside the repository's request-scoped database transaction, so the earlier claim that `send()`/`markPaid()`/`void()` have no transaction boundary was incorrect; Section 17 now records the narrower direct-service-invocation caveat instead of treating that as a production HTTP defect.

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

So `overdue`/`partially_paid` are real displayed states, but they are computed independently in at least two places (the queue's SQL predicate and the dashboard's client-side derivation) rather than owned by one normalization function the way `normalizeInvoiceStatus()` owns `void -> voided`. `Invoice.status` itself never contains `overdue` or `partially_paid` on any real row; a `sent` invoice that is three weeks late still has `status: "sent"` in every API response, and the persisted-status side of the shared `invoiceTransitions` graph (`overdue -> [...]`, `sent -> [..., "overdue", ...]`) is consequently unreachable in the current architecture, exactly as flagged in Section 5.

There is also a separate reconciliation defect in these derived predicates: their current status exclusion protects voided rows but not persisted `paid` rows. Because `markPaid()` sets `status = paid` and `paidAt` without creating an equivalent recorded `Payment`, a manually-paid invoice can retain a positive derived `balance_due` and still satisfy the unpaid/overdue queue filters. That means the queue can contradict the canonical API status for a real, currently-supported write path. The future S011 implementation must either exclude persisted `paid` invoices from all balance-due follow-up predicates or deliberately change the manual `markPaid()` contract to create equivalent payment ledger data. The smaller, non-semantic-changing repair is to exclude persisted `paid` from those follow-up predicates; this plan recommends that option.

`markPaid()`'s guard `!["sent", "overdue"].includes(row.status)` (`service.ts:256`) still has a dead `overdue` disjunct: no invoice can ever actually have `status === "overdue"` when `markPaid()` runs, so that branch of the allowlist is currently unreachable configuration, not a bug that changes observed behavior today.

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

This is one concrete item in Section 12's recommended smallest-safe slice. The other is the paid-status queue reconciliation from Section 8. Together they make the existing manual-paid path and the recorded-payment path converge on the same externally observed state without adding a new canonical status or schema change.

## 10. Tenant/RLS boundary

`app/tests/rls.integration.ts`'s cross-org invoice block (`~1108-1180`) creates, sends, and marks an invoice paid in `orgA` via `InvoicesService`, then confirms `orgB` cannot read it — the same pattern S010 relied on as its regression baseline for Contracts. Invoice write policies (`invoices_write_policy`, `invoice_line_items` policy) come from the same `20260624100000_add_proposals_invoices_contracts/migration.sql` that defines the status check constraint; neither this audit nor Section 12's recommended slice touches RLS, permissions, or tenant scoping. `assertInvoiceWriteAccess()` (`service.ts:483-487`) already gates every mutating method on `billing.write`; `createPayment` gates through `assertInvoice` (org-scoped existence check) in `CrmService`. No gap found here.

## 11. Frontend/portal consumers

- `web/src/lib/api.ts` re-applies `normalizeStatus(invoice.status, legacyInvoiceStatusMap, invoiceStatuses, "draft")` client-side on both `getInvoice()` and `listInvoiceQueue()` — redundant-but-harmless given the server already normalizes, the same pattern S010 found and left alone for Contracts.
- `status-badge.tsx` carries tone/label entries for `overdue`, `partially_paid`, `voided`, and `viewed` (lines 34, 38, 55, 57, 89) even though only `voided` (via normalized raw `void`) can ever actually reach the badge from a persisted `Invoice.status` — `overdue`/`partially_paid` reach it only through the client-side derivation in Section 8, never through `item.status` itself.
- The portal invoice page (`web/src/app/(app)/portal/invoices/[invoiceId]/page.tsx`) is read-only display; no separate customer-facing authorization boundary exists for invoices beyond the same internal Supabase session every other authenticated route uses — same finding S010 made for the Contract portal page, and out of scope here for the same reason (S018).

## 12. Proposed S011 implementation (recommended smallest safe slice)

No database migration. Keep the production HTTP path inside the repository's existing request-scoped database session; do **not** add an unnecessary nested `$transaction`. Change `CrmService.createPayment()` (or a thin wrapper it calls) and the organization queue predicates as follows:

1. Within the existing request-scoped transaction, serialize payment reconciliation per invoice before aggregating payments — preferably by locking the target invoice row (`SELECT ... FOR UPDATE`-equivalent) before the payment insert/balance check. If serializable isolation is chosen instead, it must include bounded retry for serialization conflicts; simply raising the isolation level without retry is not an equivalent success contract. This prevents two concurrent payments that jointly cover the balance from both observing an incomplete total and leaving the invoice in `sent`.
2. Insert the `Payment` row, then recompute the invoice's total **recorded**-payment sum including it while that invoice is serialized.
3. If that sum is `>=` the invoice's `amount` **and** the invoice's current status is `sent` (the only status from which the existing `markPaid()` allows a `paid` transition that is actually reachable per Section 8), transition `Invoice.status` to `paid` and set `paidAt`, reusing the existing `invoice.paid` delivery/activity event shape. Those writes must stay on the same request-scoped transaction client/session as the payment and invoice writes. If the implementation needs to remain safe for direct service invocation outside an HTTP request, use the repository's transaction helper that reuses an active request transaction and opens one only when none exists; do not nest a transaction on the request-scoped Prisma proxy.
4. If the sum is greater than zero but less than `amount`, do **not** attempt to persist `partially_paid` — it is not DB-legal (Section 2) and making it legal is a schema decision, not an implementation detail, deferred to Section 19.
5. Update `InvoicesService.listOrganizationQueue()`'s balance-due follow-up predicates so a persisted raw/canonical `paid` invoice cannot be returned as unpaid, partially paid, or overdue solely because the manual `markPaid()` path has no corresponding `Payment` rows. Preserve the existing recorded-payment ledger math for non-paid invoices; do not fabricate a payment row or change manual `markPaid()` billing semantics in this slice.

This closes both concrete reconciliation gaps: recorded payments can make a fully-covered `sent` invoice become `paid`, and an invoice already marked `paid` cannot simultaneously appear in a follow-up queue as owing money. It uses only the existing DB-legal `paid` transition and existing queue surface, without adding a status or changing the payment ledger contract.

The source-of-truth `docs/LIFECYCLE_COMPATIBILITY_MATRIX.md` correction identified by this audit ships in this planning PR so repository truth is not left contradictory. `docs/WORKFLOW_LIFECYCLES.md`, `docs/modules/invoices-and-payments.md`, and sprint-status updates remain deferred to the future S011 implementation/promotion sequence because those documents describe shipped behavior rather than audit evidence.

## 13. What Option A deliberately does not do

- Does not persist `overdue` (Section 8 — requires a scheduled-sweep architecture decision, Section 19).
- Does not persist `partially_paid` (Section 8 — requires a constraint migration, Section 19).
- Does not build `viewed` tracking (Section 7 — requires new portal-side infrastructure, same as S010's deferred Contract `viewed`).
- Does not add a payment-recording UI (Section 9 — the API exists and would be reused as-is; building the missing frontend form is separate product/UI scope, not a lifecycle-normalization concern).
- Does not change the manual `markPaid()` action into a ledger-writing operation; instead, Section 12 makes queue derivation respect its already-persisted `paid` state.
- Does not touch `void()`, `send()`, or their guards.
- Does not fix the two confirmed status-mutation defects in Section 17.

## 14. Exact files expected to change (future Option A implementation PR)

- `app/modules/crm/service.ts` — `createPayment()` gains per-invoice serialization, recorded-balance reconciliation, conditional `paid` transition, and transaction-context-preserving audit event, per Section 12.
- `app/modules/invoices/service.ts` — organization queue unpaid/partially-paid/overdue predicates exclude persisted `paid` invoices while retaining existing recorded-payment balance math for active non-paid invoices; `send()`, `markPaid()`, and `void()` behavior remain otherwise unchanged.
- `app/tests/invoices.service.test.ts` and/or `app/tests/payments.service.test.ts` — new coverage for the payment-triggered `paid` transition and paid-queue exclusion (full payment closes the invoice; cumulative partial-then-final payments; non-`recorded` payment status excluded; partial payment leaves status unchanged; manually `markPaid()` invoice is absent from follow-up queues; payment on an already-voided or already-paid invoice is rejected or no-ops safely — needs an explicit decision at implementation time, not invented here).
- `app/tests/rls.integration.ts` — live PostgreSQL coverage for the concurrent-payment serialization behavior in Section 12, since that class of race is not provable against a mocked Prisma client.
- `docs/WORKFLOW_LIFECYCLES.md` — correct the Invoice section's "Current enforced transitions" list to state plainly that `overdue`/`partially_paid`/`viewed` are never persisted, that `overdue`/`partiallyPaid` are read-time-derived queue/dashboard labels, and that persisted `paid` is terminal for follow-up queue purposes.
- `docs/modules/invoices-and-payments.md` — document the new payment-triggered `paid` transition, the queue exclusion for persisted paid invoices, the existing manual `mark-paid` action, and the still-missing payment-recording UI as a known limitation if not also closed in the same PR.
- `docs/SPRINT_BACKLOG.md` — status/acceptance update for S011 at implementation time (not part of this planning artifact).

## 15. Exact files forbidden for the Option A slice

- `app/prisma/schema.prisma`, any new migration touching `invoices.status` or its check constraint.
- `app/modules/invoices/service.ts`'s `send()`, `markPaid()`, `void()`, or their transition guards; only the queue read predicates are in scope there.
- Any RLS policy, permission key, or `assertInvoiceWriteAccess`/`assertInvoice` boundary.
- `app/domain/contracts.ts`'s `invoiceStatuses`, `legacyInvoiceStatusMap`, or `invoiceTransitions` — none of them need a code change for Option A; only the docs describing them need correcting.
- Any new frontend payment-recording form (Section 13).
- Any fix to the two confirmed defects in Section 17.

## 16. Regression test matrix (for the future implementation PR)

| Behavior | Test file | Assertion |
|---|---|---|
| Payment fully covering balance transitions invoice to `paid` | `app/tests/invoices.service.test.ts` or `app/tests/payments.service.test.ts` | after `createPayment()` with `amount === invoice.amount`, `getById(...).status === "paid"` and `paidAt` is set |
| Cumulative payments reach `paid` only once the running total covers the balance | same | record a partial payment (status stays `sent`), then a second payment that brings the cumulative total to `>= amount`; only the second call transitions status to `paid` with `paidAt` set |
| A non-`recorded` payment status does not count toward the balance or trigger a transition | same | a payment created with `status` other than `recorded` leaves `Invoice.status` unchanged and is excluded from the balance sum, matching the existing `listOrganizationQueue`/ledger convention of only counting `status = "recorded"` rows |
| Partial payment does not change status | same | after `createPayment()` with `amount < invoice.amount`, `status` remains `"sent"` |
| Manual `markPaid()` invoices do not reappear as owing money | invoice queue tests | after `markPaid()` without a Payment row, unpaid/partially-paid/overdue organization queue filters return no row for that invoice even though its ledger-derived raw balance would otherwise be positive |
| Payment on a non-`sent` invoice does not silently transition it | same | payment recorded against a `draft`, `voided`, or already-`paid` invoice leaves status unchanged (or the exact rejection behavior decided at implementation time) |
| Concurrent payments on the same invoice serialize and only one transition fires | `app/tests/rls.integration.ts` (live PostgreSQL) | two concurrent `createPayment()` calls that together cover the balance observe serialized, up-to-date recorded totals; exactly one resulting transition to `paid`, no lost update |
| Serializable alternative retries conflicts if used instead of row locking | same | a forced/observed serialization conflict is retried within a bounded policy and the concurrent-payment contract still completes rather than leaking a transient conflict as the normal outcome |
| The `invoice.paid` audit event and the status write share the request transaction | request-session/integration coverage | forced failure after the status write but before the event write rolls back the payment/status/event set on the production request-scoped path; direct service invocation is covered only if it is intentionally supported outside a database session |
| Existing manual `mark-paid` path is otherwise unaffected | `app/tests/invoices.service.test.ts:167` | unchanged status/event behavior, still passes |
| Existing `void()` raw-value regression is unaffected | `app/tests/invoices.void.test.ts` | unchanged, still passes |

## 17. Pre-existing defects found during this audit, explicitly out of scope for S011

Two status-mutation correctness gaps independently match S010's Contract findings:

1. **`void()` non-idempotency.** `InvoicesService.void()` (`service.ts:270-285`) only blocks `status === "paid"`; it does not check whether the invoice is already `void`. Calling it twice on an already-voided invoice succeeds a second time and writes a duplicate `invoice.voided` delivery/activity record. `send()` and `markPaid()` do not share this gap — both use an allowlist/single-precondition guard (`row.status !== "draft"`, `!["sent","overdue"].includes(row.status)`) that naturally rejects a repeat call.
2. **Missing optimistic-concurrency guards.** Every mutating method's `prisma.invoice.update({ where: { id } })` call keys only on `id`, with no expected-prior-status predicate. Two concurrent `markPaid()` calls (or a `markPaid()` racing a `void()`) can both proceed from stale reads and silently overwrite one outcome unless the surrounding request transaction/locking strategy serializes them for some other reason.

**Transaction-boundary clarification:** the production HTTP API does **not** lack a transaction boundary around these writes. `databaseSession` is mounted ahead of `/api/v1` routes and `runWithDatabaseSession()` wraps the request in one Prisma transaction; the request-scoped `prisma` proxy therefore routes `invoice.update`, `recordDeliveryEvent()`, `invoiceDelivery.create`, and activity writes through that active transaction. A production request failure before completion rolls those request-session writes back together. The remaining caveat is narrower: direct service invocation outside `runWithDatabaseSession()` does not automatically receive that request transaction, so any code path that intentionally supports such invocation must use the repository's transaction helper rather than assuming the HTTP middleware exists. This is not a confirmed production HTTP partial-write defect and does not justify adding nested `$transaction` calls to these methods.

The two confirmed defects are orthogonal to S011's lifecycle reconciliation. Bundling them into S011 would violate the same smallest-safe-slice discipline S010 used. Track them as a separate follow-up, potentially alongside the analogous Contract defects after reconciling S010's own transaction-boundary wording to the same request-session reality.

## 18. Risk assessment

- **Vocabulary risk:** low. Section 6 shows the highest-risk half of a typical lifecycle-normalization slice (raw/canonical DTO mismatch) is already resolved on `main`. No schema migration is proposed.
- **Documentation risk:** resolved in this planning PR. `docs/LIFECYCLE_COMPATIBILITY_MATRIX.md` now states the audited Invoice truth directly: `viewed`/`partially_paid` are canonical but DB-illegal, `overdue` is DB-legal but has no repository write path, and the concrete reconciliation gap is around `paid` across payment recording and follow-up queues. Future implementation docs still must describe the behavior that actually ships.
- **Functional risk of the proposed Option A slice itself:** bounded but concurrency-sensitive — it reuses the existing `sent -> paid` transition, repairs the existing paid/follow-up queue contradiction, and requires per-invoice serialization plus live concurrent regression coverage. It does not add a status, schema change, or new billing ledger semantics.

## 19. Resolved founder decisions and deferred defects

1. **Overdue remains derived.** S011 must not introduce a persisted-overdue writer or scheduler. Existing balance/due-date-derived presentation remains authoritative where correct.
2. **Partially-paid remains derived.** S011 must not add `partially_paid` to the database status constraint. Derive it from valid recorded payments and remaining balance.
3. **Payment-entry UI expansion is deferred.** Existing payment-recording entry points remain the input boundary; S011 does not build or redesign payment-entry UI. Any later UI ownership/expansion belongs to a later sprint.
4. **S011 owns backend payment reconciliation correctness.** The implementation is limited to serialized payment reconciliation, persisted `paid` advancement for eligible fully covered invoices, transaction/event coherence, and follow-up queue correctness.
5. The two confirmed status-mutation defects in Section 17 remain separate follow-up work and are not blockers for this bounded slice.

## 20. Recommended S011 acceptance criteria (for a future promotion PR)

- `CrmService.createPayment()` transitions an eligible `sent` invoice to canonical `paid` (reusing the existing `markPaid()` event/audit shape) when valid recorded payments bring its balance to exactly zero or below; a partial payment leaves status unchanged, non-recorded payments do not count, and concurrent payments cannot leave a fully covered invoice in `sent`.
- `InvoicesService.listOrganizationQueue()` never returns a persisted `paid` invoice from unpaid, partially-paid, or overdue follow-up filters merely because the manual `markPaid()` path has no Payment ledger row.
- The payment/status/audit path stays inside the existing request-scoped transaction; no nested transaction is added to the request-scoped Prisma proxy. Any intentionally supported direct service invocation uses the repository transaction helper safely.
- No schema, migration, RLS, permission, or `send()`/`markPaid()`/`void()` transition-guard change.
- `docs/LIFECYCLE_COMPATIBILITY_MATRIX.md` already records the audited pre-implementation truth in this planning PR and must remain consistent with whatever runtime behavior the later implementation ships.
- `docs/WORKFLOW_LIFECYCLES.md`'s Invoice section and `docs/modules/invoices-and-payments.md` are updated to describe the new payment-triggered transition, paid follow-up exclusion, and the still-open items from Section 19.
- The two confirmed pre-existing defects in Section 17 remain explicitly out of scope and unfixed, tracked separately.
- Persisting `overdue`, persisting `partially_paid`, building `viewed` tracking, and expanding payment-entry UI are explicitly out of scope under the approved decisions in Section 19.
