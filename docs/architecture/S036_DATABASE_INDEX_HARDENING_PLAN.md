# S036 — Database Index Hardening Plan

Status: `READY` through governance PR #475; implementation has not started.

## Scope

S036 may add only verified database indexes supported by the S035 query-performance inventory. Each candidate must have a representative isolated PostgreSQL plan comparison, an index-size and write-cost review, a reversible migration/rollback rehearsal, and focused regression coverage for the query contract and tenant/RLS boundary.

The implementation must use a fresh isolated worktree and a separate implementation pull request after this readiness promotion lands. Candidate selection is evidence-driven; the sprint does not authorize speculative indexing or broad query tuning.

## Forbidden paths

- Production database changes or production index application.
- Unapproved customer workload capture or production performance claims.
- Speculative indexes without before/after plan evidence and write-cost review.
- Query rewrites, ORM replacement, schema/domain redesign, or unrelated migrations.
- Auth, permissions, RLS-policy redesign, runtime tracing, provider work, or product behavior changes.
- S027 browser evidence, S044/S045 deployment inventory, S046 migration gates, S048 beta selection, or launch approval.

## Dependencies and overlap

- S027: `DONE` with merged implementation and browser evidence.
- S035: `DONE` with the query-performance inventory and representative isolated plan evidence.
- No open PR implements S036. PR #475 is governance-only and must merge before the implementation branch is created.
- Draft PR #453 and production-access work remain separate.

## Worktree and infrastructure boundary

Implementation starts in a new isolated worktree from the then-current `main`. Verification uses disposable PostgreSQL or another explicitly approved non-production database. No production credentials, customer data, or live database writes are required or authorized by this plan.

## Required validation

For every proposed index:

1. Record the query path and baseline plan from the S035 inventory.
2. Reproduce the representative plan with the candidate index in isolated PostgreSQL.
3. Review index size, write amplification, migration duration, and rollback behavior.
4. Run focused query-contract, tenant/RLS, migration, and regression tests.
5. Run repository governance checks and the applicable app lint, typecheck, build, unit, and integration checks.

## Founder-decision boundary

No founder decision is required for repository changes and disposable-database evidence. Production database access, production index application, or adoption of a latency/write-cost SLO requires separate authorization and is outside this readiness promotion.

## Acceptance

S036 is complete only when each merged index has auditable plan improvement, acceptable isolated write-cost evidence, reversible migration/rollback proof, focused regression coverage, and merged completion evidence. A partial candidate set must remain explicitly partial rather than being represented as complete.
