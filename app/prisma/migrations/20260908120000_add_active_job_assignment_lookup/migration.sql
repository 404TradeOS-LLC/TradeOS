-- Narrow the dispatch queue's active-assignment relation lookup without
-- changing query semantics. The full (org_id, job_id) index remains useful
-- for historical assignments; this partial index stores only assignments
-- that the queue's active/unassigned predicates can observe.
set local lock_timeout = '5s';

create index if not exists idx_job_assignments_active_org_job
  on job_assignments (org_id, job_id)
  where removed_at is null and declined_at is null;
