# S035 Redacted Plan Evidence

These artifacts were captured with `EXPLAIN (FORMAT JSON)` through the
authorized TradeOS Staging Supabase project after `ANALYZE`. All organization,
user, and resource identifiers are redacted to `<synthetic-org>` or
`<synthetic-resource>`; no production values are present.

Fixture cardinalities at capture: 1,000 jobs, 500 job assignments, 1,000
activity events, and 100 invoices. The fixture was deleted after capture and
verified absent.

## Dispatch queue

Source/query shape: `JobsService.list()` — organization filter, active status
filter, archived exclusion, project/customer joins, active assignment join,
grouping, scheduled-start/id ordering, and `LIMIT 50`.

```json
{
  "Node Type": "Limit",
  "Startup Cost": 114.03,
  "Total Cost": 114.15,
  "Plan Rows": 50,
  "Sort Key": ["j.scheduled_start", "j.id"],
  "Aggregate": {"Strategy": "Hashed", "Plan Rows": 600},
  "Job Index": "idx_jobs_org_status",
  "Job Filter": "archived_at IS NULL",
  "Assignment Plan": "Seq Scan on job_assignments; 500 estimated rows",
  "Join": "Hash Join on assignment job_id"
}
```

## Dispatch summary

Source/query shape: `JobsService.getDispatchSummary()` — four filtered counts
for one organization, including status, archived, scheduled-time, and overdue
predicates.

```json
{
  "Node Type": "Aggregate",
  "Strategy": "Plain",
  "Startup Cost": 68.50,
  "Total Cost": 68.51,
  "Plan Rows": 1,
  "Input": "Seq Scan on jobs",
  "Input Rows": 1000,
  "Filter": "org_id = <synthetic-org>",
  "Index Considered": "idx_jobs_org_archived"
}
```

## Invoice queue

Source/query shape: `listOrganizationQueue()` — organization project join,
invoice/payment aggregation, recorded-payment filter, updatedAt/id ordering,
and `LIMIT 50`.

```json
{
  "Node Type": "Limit",
  "Startup Cost": 10.98,
  "Total Cost": 11.11,
  "Plan Rows": 50,
  "Aggregate": {"Strategy": "Hashed", "Plan Rows": 100},
  "Invoice Input": "Seq Scan on invoices; 100 estimated rows",
  "Payment Input": "Seq Scan on payments; synthetic fixture had no payment rows",
  "Join": "Hash Left Join on invoice_id",
  "Sort Key": ["i.updated_at DESC", "i.id DESC"]
}
```

## Activity timeline

Source/query shape: `ActivityTimelineService.list()` — organization/entity-type
filter, occurredAt/createdAt descending ordering, and `LIMIT 50`.

```json
{
  "Node Type": "Limit",
  "Startup Cost": 72.22,
  "Total Cost": 72.34,
  "Plan Rows": 50,
  "Input": "Seq Scan on activity_events; 1000 estimated rows",
  "Filter": "org_id = <synthetic-org> AND entity_type = job",
  "Sort Key": ["occurred_at DESC", "created_at DESC"]
}
```

These are synthetic staging planner observations, not production latency or
SLO measurements. No optimization, migration, index, or query rewrite was
applied.
