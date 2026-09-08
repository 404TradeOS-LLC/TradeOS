# S036 Active Job-Assignment Index Evidence

Status: `PARTIAL` — disposable evidence is captured, but the candidate is not
yet proven to improve the representative query plan. S036 remains incomplete
pending the merge decision for this candidate.

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

These are schema-level write-cost expectations, not a measured production
workload claim.

## Disposable fixture result

The supplemental [S036 disposable PostgreSQL workflow](https://github.com/404TradeOS-LLC/TradeOS/actions/runs/34204415735)
applied the exact migration unmodified in an isolated `s036_evidence` schema
with the S035 representative fixture: 1,000 synthetic jobs, 500 synthetic
assignments, 100 active assignments, 200 removed assignments, and 200
declined assignments. The [uploaded evidence artifact](https://github.com/404TradeOS-LLC/TradeOS/actions/runs/34204415735/artifacts/10047147281)
contains the redacted JSON plans, write-cost observations, and rollback result.

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

## Required follow-up before merge

Review the captured result before merge. It does not establish a plan benefit
at the representative fixture, so the candidate should remain unmerged unless
the owning engineer documents why the production cardinality/selectivity is
materially different and provides an additional authorized disposable plan
comparison. Any follow-up should retain redacted `EXPLAIN (FORMAT JSON)` output
before and after the index, planner cost, estimated rows, index size, controlled
write-cost observations, and migration rollback evidence.

The rollback command used was:

```sql
drop index if exists idx_job_assignments_active_org_job;
```

No production database, customer workload, production credentials, or
production `EXPLAIN ANALYZE` was used for this candidate. This document remains
`PARTIAL`, and the migration must not be represented as completed S036 work.
