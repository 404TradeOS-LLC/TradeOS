---
status: complete
owner: platform
last_verified: 2026-08-25
source_of_truth: true
related_docs:
  - docs/architecture/S041_RLS_POLICY_COVERAGE_PLAN.md
  - docs/architecture/S041_RLS_POLICY_COVERAGE_INVENTORY.md
  - docs/SPRINT_BACKLOG.md
  - docs/CURRENT_STATE.md

# S041 Completion Evidence

## Objective and shipped behavior

S041 audited the complete Prisma/migration table inventory against forced RLS,
application authorization, and request-session role behavior. The shipped
bounded hardening:

- requires `billing.write` for all change-order mutations while retaining
  `billing.read` for reads;
- requires `costbook.manage` for supplier create/update/delete while retaining
  `costbook.read` for reads;
- preserves raw legacy SQL role strings so `viewer` and `estimator` do not gain
  broader RLS write/admin privileges through compatibility normalization;
- records all 73 Prisma-mapped tables plus raw-SQL `athena_action_idempotency`
  with classification and forced-RLS evidence;
- adds focused controller, request-session, migration, and PostgreSQL tenant
  boundary regression coverage.

No schema or migration change shipped. RLS policy redesign, new roles or
permissions, production data, S027 browser evidence, and S042+ work remain
outside this sprint.

## Merge records

| Lane | PR | Head | Merge commit | Merged at |
| --- | --- | --- | --- | --- |
| Readiness | #350 | `7b02f1888e9d1657c324f8a97bcfac1466a2981d` | `9fde03effd679f63c36790f37ddfade2913247ed` | 2026-08-25T17:03:13Z |
| Implementation | #351 | `3951223c1e1d108e6406adc79b4524d953838017` | `3f7c263f324911911f734cd29ce1ed6879dc8ccc` | 2026-08-25T17:33:14Z |

## Verification evidence

- `git diff --check` passed on the implementation lane.
- `node scripts/sprint-state-check.mjs` passed during implementation with
  `READY=S041` before completion reconciliation.
- Required GitHub checks passed for the final implementation head, including
  Docs consistency, branch currency, App typecheck, App lint/unit/build,
  App integration tests, Database migration and RLS safety, Athena contracts
  and smoke, dependency review, and CodeQL (neutral/no blocking result).
- The full App unit suite passed after the deterministic policy-expression
  assertion repair; the live App integration suite passed, including the S041
  same-organization/cross-organization supplier and change-order cases.
- Focused negative/positive controller tests prove technician denial and
  permitted-role success. Request-session tests prove raw legacy role
  preservation. Migration tests prove the raw Athena idempotency table remains
  enabled and forced-RLS protected.

## Security review and disposition

The adversarial review found and repaired an initially proposed privilege
widening: normalizing legacy `viewer` to `technician` would have enabled generic
RLS writes, and normalizing `estimator` to `dispatcher` would have widened
administrative behavior. The final implementation preserves raw SQL role
semantics and resolves both review threads. No unresolved actionable review
thread remains on PR #351.

Deferred findings are change-order approval concurrency and malformed identifier
validation; both remain separate follow-up work and were not silently expanded
into S041.

## Repository truth after implementation merge

At completion-evidence branch creation, `origin/main` was
`3f7c263f324911911f734cd29ce1ed6879dc8ccc`. S041 implementation is merged;
this completion-evidence lane reconciles canonical sprint documentation to
`DONE`. S027 remains independently blocked only on authenticated rendered
Costbook browser evidence. No production/browser evidence is claimed here.
