# S035 Query Performance Inventory

Status: INVENTORY COMPLETE; EXECUTION-PLAN EVIDENCE UNAVAILABLE IN THIS WORKSPACE
Baseline: `origin/main` at `7821c337d4c3c7e9eaefb028376428045b61ecd5`
Sprint contract: `docs/architecture/S035_QUERY_PERFORMANCE_INVENTORY_PLAN.md`

## Evidence boundary

This inventory is based on repository source, Prisma schema/index declarations,
route behavior, and test coverage. The workspace has no `psql` client, Docker
runtime, or authorized `DATABASE_URL`; therefore no live or isolated PostgreSQL
plan was executed and no production latency/frequency claim is made. The SQL
capture templates below are reproducible follow-up commands for an explicitly
authorized isolated database.

## Prioritized query paths

| Priority | Query path | Source evidence | Existing support | Follow-up candidate |
| --- | --- | --- | --- | --- |
| P1 | Dispatch queue page: count plus paginated Job list with project/customer and active assignments | `app/modules/jobs/service.ts`, `JobsService.list()` | `jobs(org_id,status)`, `jobs(org_id,archived_at)`, `jobs(scheduled_start)`, `job_assignments(org_id,job_id)`, `job_assignments(org_id,user_id,removed_at)` | Capture plans for needs-attention OR branches, assignment anti-join, and archived/time ordering; consider only in S036 after evidence. |
| P1 | Dispatch summary: five concurrent Job counts including overdue and needs-attention predicates | `app/modules/jobs/service.ts`, `JobsService.getDispatchSummary()` | Status, archived, and scheduled-start indexes exist; the needs-attention assignment predicate crosses `job_assignments` | Compare each count plan and combined queue plan under representative tenant cardinalities. |
| P1 | Organization invoice queue: raw SQL balance/payment aggregation, status/date filters, count, and cursor page | `app/modules/invoices/service.ts`, `listOrganizationQueue()` | Invoice/payment foreign-key indexes exist; balance is derived in SQL | Capture count and page plans with/without payment rows; verify aggregate does not defeat pagination. |
| P1 | Estimate and proposal queues: count plus cursor page ordered by updatedAt/id with project/customer/contract includes | `app/modules/estimate-engine/service.ts`, `app/modules/proposals/service.ts` | Project/estimate/proposal relation indexes and cursor predicates exist in code; composite coverage needs plan evidence | Compare count/page plan divergence and include fan-out. |
| P2 | Organization activity timeline: org/entity/event filters ordered by occurredAt/createdAt | `app/modules/intelligence/service.ts`, `ActivityTimelineService.list()` | `activity_events(org_id,entity_type,entity_id,occurred_at)` and `(org_id,event_type,occurred_at)` | Verify entity-filter selectivity and whether the createdAt tie-breaker causes an extra sort. |
| P2 | Costbook catalog pages and searches: org/active filters with name/code ordering and related hierarchy | `app/modules/costbook/repository.ts`, `app/modules/cost-database/service.ts` | Several org and hierarchy indexes exist; name/code search and ordering need measured plans | Capture representative material, labor, cost-item, division/category, and assembly pages. |
| P2 | Project task lists: project/status/due-date filters ordered by dueDate/updatedAt/createdAt | `app/modules/project-tasks/service.ts` | `project_tasks(project_id,status)`, `(project_id,due_date)`, and `(job_id,status)` exist | Verify organization-scoped joins and open-task versus all-task paths. |
| P3 | Authentication request bootstrap: auth-subject lookup, membership lookup, and request session setup | `app/backend/auth/session.ts` | Unique/organization membership access paths are security-sensitive and request-frequency high | Capture only redacted, isolated plans; never use production auth values. |

## Ranking method

Priority combines request frequency implied by authenticated top-level workspace
surfaces, tenant cardinality, joins/anti-joins, aggregation, ordering, and
whether the path is user-blocking. It is a qualitative engineering ranking,
not a production latency measurement. S036 must not act on a candidate without
an executed plan and a write-cost/rollback review.

## Plan-capture protocol

Run only against an explicitly authorized isolated database with representative
synthetic cardinalities and redacted parameters:

```sql
EXPLAIN (FORMAT JSON)
SELECT ...;
```

Capture the Prisma-generated SQL or an equivalent query shape, planner output,
row-count assumptions, existing relevant indexes, and the request/RLS context.
Do not use `EXPLAIN ANALYZE` against production, capture customer identifiers,
or commit raw parameter values. Store plan evidence next to the eventual
S035 completion evidence, not in application logs.

## Deferred candidates

- Composite or partial indexes for the Jobs attention/queue predicates.
- Invoice/payment aggregate and follow-up queue plan improvements.
- Cursor/count alignment for Estimate and Proposal queues.
- Activity timeline tie-breaker/index coverage.
- Costbook catalog ordering/search coverage.

These are inventory outputs only. No index, migration, query rewrite, runtime
instrumentation, or S036 implementation is included in S035.

## External evidence limitation

The missing database client/runtime/authorized database is a genuine external
evidence dependency for executed representative plans. This document records
the limitation rather than claiming plans were observed.
