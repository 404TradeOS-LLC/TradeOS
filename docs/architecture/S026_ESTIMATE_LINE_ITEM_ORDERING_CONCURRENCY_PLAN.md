# S026 — Estimate line-item ordering concurrency plan

Status: READY
Dependencies: S023 (DONE through merged implementation and completion evidence)
Founder decision required: NO

## Objective

Eliminate remaining manual and AI estimate line-item sortOrder races so concurrent inserts receive deterministic, collision-free order without changing estimate pricing or review semantics.

## Verified baseline

- EstimateLineItem.sortOrder is the existing persisted integer ordering field.
- Estimate reads already order line items by sortOrder ascending.
- EstimateEngineService.addLineItem currently calculates the next value with an unprotected aggregate-then-insert sequence.
- Manual adds, structured AI review applies, and other callers converge on the Estimate Engine service; S026 must preserve that service boundary.
- sourceKey idempotency for AI-reviewed inserts remains independent from ordering allocation.

## In scope

- Make next-order allocation atomic or serialize it at the estimate scope for all existing line-item creation paths.
- Preserve the current append-at-end behavior and deterministic ordering of existing rows.
- Add focused concurrent-insert regression coverage for manual and AI/replay-shaped callers.
- Verify transaction behavior, rollback/retry behavior, organization scoping, forced RLS, and unchanged cost/price recalculation.
- Add migration only if the selected implementation proves it necessary; any schema or migration change remains PR-only under repository governance.

## Acceptance contract

1. Concurrent inserts for the same estimate never silently receive the same effective order.
2. The resulting order is deterministic and existing line items are not reordered unexpectedly.
3. Retry/idempotency behavior remains correct for sourceKey-backed AI applies.
4. Writes remain draft-only, organization-scoped, and protected by existing authorization/RLS boundaries.
5. Pricing snapshots, totals, activity behavior, duplication/versioning, and public API shapes remain unchanged.
6. Focused service/concurrency tests, PostgreSQL/RLS evidence where applicable, typecheck, lint, build, docs checks, and required CI pass.

## Explicit non-goals

- No line-item reordering UI or new user-facing ordering policy.
- No estimate pricing, markup, tax, lifecycle, or accounting changes.
- No direct Prisma write path outside EstimateEngineService.
- No AI provider, prompt, generation, or review-policy changes.
- No broad schema redesign, unrelated idempotency repair, or S027 Costbook work.

## Security and founder boundary

Organization context remains server-derived, and existing forced RLS and draft-only authorization remain authoritative. Stop for a founder decision only if implementation would change customer-visible ordering semantics, require irreversible data rewriting, or introduce materially different estimate persistence architecture.
