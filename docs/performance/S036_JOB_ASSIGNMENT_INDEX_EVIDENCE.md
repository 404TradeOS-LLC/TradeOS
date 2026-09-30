# S036 Active Job-Assignment Index Evidence

Status: `PARTIAL` — disposable evidence shows a conditional plan benefit for a
larger, selective tenant workload, but does not validate production behavior.
S036 remains incomplete pending review of the storage/write-cost tradeoff and
merge decision for this candidate.

## Candidate

Migration `20260908120000_add_active_job_assignment_lookup` adds:

```sql
create index if not exists idx_job_assignments_active_org_job
  on job_assignments (org_id, job_id)
  where removed_at is null and declined_at is null;
```

This is the smallest S036 slice from the S035 dispatch-queue inventory. The
active/unassigned and needs-attention predicates in `JobsService.list()` and
`JobsService.getDispatchSummary()` traverse `Job.assignments` with both
`removedAt: null` and `declinedAt: null`. The existing full
`job_assignments(org_id, job_id)` index does not exclude historical or declined
rows, while the existing `(org_id, user_id, removed_at)` index is oriented to
technician lookup rather than job-to-active-assignment lookup.

## Baseline evidence

S035's redacted isolated staging plan for the dispatch queue recorded a
sequential scan of `job_assignments` with approximately 500 estimated rows,
followed by a hash join on `job_id`. The source artifact is
`docs/performance/S035_REDACTED_PLAN_EVIDENCE.md`; it uses synthetic data only
and makes no production latency claim.

## Expected invariant and write-cost review

- The index is partial, so historical assignments and declined assignments do
  not consume entries used by the active queue predicates.
- The key remains tenant-first and job-second, preserving organization scope
  and the relation lookup shape.
- Inserts for active assignments add one entry; setting `removed_at` or
  `declined_at` removes it. Updates that remain outside the active predicate do
  not maintain an index entry.
- This is a non-unique lookup index. It does not alter assignment cardinality,
  authorization, RLS, status semantics, or delete behavior.
- The session-level `lock_timeout = '5s'` applies during `CREATE INDEX`, and
  the trailing `reset lock_timeout` prevents the setting from leaking into later
  migration statements. A timeout fails the migration rather than silently
  proceeding under an unsafe lock.
- Production application must occur only during a documented write-maintenance
  window because transactional `CREATE INDEX` can block writes while the index
  builds. The migration path must retain ordinary transactional `CREATE INDEX`;
  `CREATE INDEX CONCURRENTLY` is not valid for the repository's Prisma deploy
  path.

These are schema-level write-cost expectations, not a measured production
workload claim.

## Disposable fixture result

The supplemental [S036 disposable PostgreSQL workflow](https://github.com/404TradeOS-LLC/TradeOS/actions/runs/34204415735)
applied the exact migration unmodified in an isolated `s036_evidence` schema
with the S035 representative fixture: 1,000 synthetic jobs, 500 synthetic
assignments, 100 active assignments, 200 removed assignments, and 200
declined assignments. The workflow run page contains the redacted JSON plans,
write-cost observations, and rollback result.

At this cardinality, the before and after plans are identical: a hash join
with a sequential scan of `job_assignments` and approximately 180 estimated
active rows. PostgreSQL did not select the candidate index after creation.
The candidate measured 16,384 bytes with approximately 100 estimated tuples.
The single controlled insert comparison was 0.294 ms execution before versus
0.429 ms with the index; the active-to-declined update was 0.231 ms before
versus 0.197 ms with the index. These are disposable `EXPLAIN (ANALYZE,
FORMAT JSON)` observations, not production latency or SLO measurements.

The rollback rehearsal dropped `idx_job_assignments_active_org_job` and
verified it was absent. The schema cleanup trap then removed the full
synthetic fixture.

## Larger selective fixture result

The follow-up [S036 disposable PostgreSQL workflow](https://github.com/404TradeOS-LLC/TradeOS/actions/runs/34206382438)
also applied the exact migration unmodified against 100,000 synthetic jobs and
500,000 synthetic assignments across 100 synthetic organizations. The target
organization represented approximately 1,000 jobs and 5,000 assignments. The
workflow run page contains the full redacted plans and measurements.

In this selective workload, the plan changed from a parallel nested loop with
a sequential scan of `job_assignments` to a hash join with a bitmap heap scan
driven by `idx_job_assignments_active_org_job`. Estimated total cost decreased
from approximately 13,351 to 8,280, and PostgreSQL selected the candidate
index. The index measured 5,169,152 bytes with approximately 300,000 estimated
tuples. The single controlled insert comparison was 0.309 ms execution before
versus 0.490 ms with the index; the active-to-declined update was 0.196 ms
before versus 0.252 ms with the index.

This narrows the evidence gap: the candidate is conditionally useful when a
tenant query is selective within a materially larger assignment table, but the
result does not establish production performance or an acceptable production
write/storage budget.

## Required follow-up before merge

Review both captured results before merge. The candidate should remain
review-only until the owning engineer confirms that production tenant
cardinality/selectivity and the approximately 5 MB per 300,000 active-row
index are acceptable, and accepts the measured write-cost tradeoff. Any
follow-up should retain redacted `EXPLAIN (FORMAT JSON)` output before and
after the index, planner cost, estimated rows, index size, controlled write-cost
observations, and migration rollback evidence.

The rollback command used was:

```sql
drop index if exists idx_job_assignments_active_org_job;
```

No production database, customer workload, production credentials, or
production `EXPLAIN ANALYZE` was used for this candidate. This document remains
`PARTIAL`, and the migration must not be represented as completed S036 work
until the conditional benefit and production cost budget are accepted.
