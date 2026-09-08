# S036 Active Job-Assignment Index Evidence

Status: `PARTIAL` — candidate implementation prepared for review; S036 is not
complete until the isolated plan comparison and rollback rehearsal are attached.

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

## Required follow-up before merge

Run the candidate against an authorized disposable PostgreSQL fixture with the
S035 synthetic cardinalities and `ANALYZE`, then retain redacted
`EXPLAIN (FORMAT JSON)` output before and after the index. Record planner cost,
estimated rows, whether the active-assignment scan changes, index size, and a
controlled insert/update write-cost comparison. Rehearse migration apply and
rollback with:

```sql
drop index if exists idx_job_assignments_active_org_job;
```

No production database, customer workload, production credentials, or
`EXPLAIN ANALYZE` was used for this candidate. Until that evidence is attached,
this document remains `PARTIAL` and the migration must not be represented as
completed S036 work.
