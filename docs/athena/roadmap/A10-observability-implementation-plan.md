---
status: draft
owner: platform
last_verified: 2026-08-11
source_of_truth: true
related_docs:
  - ../README.md
  - ../roadmap.md
  - ../04-system-architecture/README.md
  - ../09-security/README.md
  - ../10-events/README.md
  - ../contracts/README.md
  - A1-ai-kernel-implementation-plan.md
  - A6-action-engine-implementation-plan.md
  - A7-memory-implementation-plan.md
  - A8-event-integration-implementation-plan.md
  - ../../TRADEOS_BIBLE.md
  - ../../ARCHITECTURE.md
---

# A10 Observability Implementation Plan

Milestone: A10 - Observability
Purpose: mature Athena's existing C011 telemetry into an operator-grade
observability platform - trace reconstruction, bounded search, reliability
and latency metrics, tool/model/cost reporting, event/DLQ health, alerts,
exporters, and retention - without introducing a second telemetry system.
Implementation posture: read/derive layer only over existing A1-A8 tables,
dark by default (`ATHENA_OBSERVABILITY_ENABLED`, default `false`), owner/
admin-only, tenant-isolated at the application layer and the database RLS
floor.

## A1-A8 Acceptance Summary

A10 starts from a verified A1-A8 state on this branch: the kernel
(`app/modules/athena-kernel/`) emits C011 telemetry spans for `kernel`,
`context`, `approval`, `action`, and `model` at defined call sites in
`service.ts`; A6's action engine (`app/modules/athena-action-engine/`)
executes authorized `tool_call` steps but keeps no persisted `AthenaAction`
row of its own (in-memory idempotency/approval state only - action-level
history exists solely through the `action`/`approval` telemetry spans the
kernel records around it); A7 memory (`app/modules/athena-memory/`) and A8
event integration (`app/modules/athena-events/`) are both real but dark by
default in production (no kernel call site wires either one to a live
router intent or production tool). A2 still registers no production tools,
so the full pipeline remains dormant end-to-end in production; A10 observes
whatever telemetry the currently-wired paths (draft response generation,
approval/denial, and any test/future tool execution) actually produce.

## Telemetry Coverage Matrix

| Component | Span type | Correlation | Duration | Status | Cost | Errors |
| --- | --- | --- | --- | --- | --- | --- |
| A1 Kernel (overall request) | `kernel` | orgId/requestId/traceId/executionId | yes | ok/error/denied/degraded | n/a | safe error code in `AthenaExecution.safeErrorCode` |
| A3 Context assembly (static + live) | `context` | same | yes | ok/degraded | n/a | degraded on provider failure |
| A4/A5 Permission/approval decisions (plan-level and per-step) | `approval` | same, +planId/stepId/toolId when applicable | yes | ok/denied/degraded | n/a | reasonCode in metadata |
| A6 Action execution (per authorized step) | `action` | same, +planId/stepId/toolId/actionId | yes | ok/error/denied | n/a (tool-level cost not modeled) | reasonCode in metadata |
| Model adapter call (draft response) | `model` | same | yes | ok/error | provider/model/tokens/estimatedUsd | errorCode in metadata |
| A7 Memory candidate hook | `memory` | same, +planId/stepId | yes | ok/degraded | n/a | closed in this milestone - see below |
| A2 Tool registry (dispatch-level) | none | n/a | n/a | n/a | n/a | folded into `action` span, no separate span |
| A5 Planner (classification) | none | n/a | n/a | n/a | n/a | folded into `kernel`/`approval` span metadata (`intent`, `planId`) |
| A8 Event publish/dispatch | none | `AthenaEvent.correlationId` (event table only) | n/a | n/a (delivery `status` column instead) | n/a | `AthenaEventDeadLetter.failureReason` |

Fix applied in this milestone: the A7 memory-candidate hook in
`athena-kernel/service.ts` (reachable only when both DI seams are supplied -
not wired to any production caller yet, same posture as the rest of A7) had
no telemetry span at all. It now emits `spanType: "memory"` with
`{ planId, stepId, candidateCount }` - counts only, never the candidates'
own values. This is the one minimal, in-scope instrumentation fix this
milestone makes; see "Known limitations" for the gaps left deliberately
unfixed and why.

Known limitations (documented, not fixed in A10 - fixing them would mean
adding new kernel-side spans/behavior beyond "observe what already exists",
which is out of this milestone's scope per its own rules):

- `planner` and `tool` are valid C011 span types that are never emitted as
  their own span. Planner work is visible only as metadata on the `kernel`/
  `approval` spans; tool dispatch is visible only as the `action` span
  (which already carries `toolId`/`toolVersion`). A future milestone that
  wants planner-stage or tool-registry-stage latency broken out separately
  would need new kernel instrumentation, not an A10 change.
- `event` span type is never emitted; A8's event pipeline health is
  observed directly from `athena_events`/`athena_event_deliveries`/
  `athena_event_dead_letters` instead (see "Event/DLQ Health" below), which
  is more precise than a synthetic span would be anyway.
- There is no persisted `AthenaAction`/`AthenaPlan` record (A6 keeps
  idempotency/approval state in memory only - see
  `app/modules/athena-action-engine/idempotency.ts`/`approval.ts`), so
  "action metrics" and trace completeness are both derived entirely from
  telemetry spans, never from a dedicated action table. This is intentional
  (matches "reuse C011, no duplicate telemetry system"), but it means an
  action retried at the in-memory idempotency layer produces at most one
  telemetry row per attempt with no separate "attempt count" field beyond
  what a caller happens to pass in span metadata.
- `recordAthenaTelemetry()` deliberately swallows its own write failures
  (`athena-kernel/telemetry.ts`) so a telemetry outage never flips a real
  business result. This means A10 has no direct signal for "telemetry write
  failed" - the `telemetry_write_failure` alert rule is either a
  best-effort proxy or explicitly not implemented; see the alerts section
  and the exporters/retention/alerts implementation report for the exact
  status.

## Architecture

`app/modules/athena-observability/` is the sole query/derivation boundary,
mirroring every prior milestone's single-module-owns-its-domain pattern
(A7's `athena-memory`, A8's `athena-events`). It never becomes a second
persistence system - it reads `AthenaExecution`, `AthenaExecutionTransition`,
`AthenaTelemetryRecordRow`, `AthenaEvent`, `AthenaEventDelivery`,
`AthenaEventDeadLetter` (all pre-existing) plus one new table this milestone
adds, `AthenaAlert` (derived alert lifecycle state only - never a copy of
underlying telemetry/event data).

- `types.ts` - the full read-model contract (trace/search/metrics/alert/
  exporter/retention types). Owned by the integrating agent; every other
  file implements against it without modification.
- `completeness.ts` - `computeTraceCompleteness(finalState, spans)`,
  documented in-line against the exact kernel lifecycle edges that make each
  rule true today (see the file's own header comment for the full
  derivation). Summary: `kernel` and `context` are always expected;
  `approval` is expected only when the terminal state is `succeeded` or
  `denied` (the only two states A1's lifecycle table reaches from
  `policy_check`); `action` is expected only when an observed `approval`
  span for the trace already carries a `stepId`; `model` is expected only
  when the terminal state is `succeeded`. `memory`/`event` are never
  required (neither is wired to a production caller).
- `traceService.ts` - `getTrace`, `getTraceByRequest`, `searchTraces`.
  Bounded, cursor-paginated, tenant-scoped by `orgId` in every query.
- `metricsService.ts` - `getOverviewMetrics`, `getToolMetrics`,
  `getModelMetrics`, `getCostSummary`, `getEventHealth`.
- `alerts.ts` - `listAthenaAlerts`, `evaluateAthenaAlerts`,
  `applyAthenaAlertEvaluations` (dedup'd active/resolved lifecycle over
  `AthenaAlert`).
- `exporters.ts` - `AthenaObservabilityExporter` implementations (console,
  webhook) plus `runAthenaObservabilityExport`. Exporter failure is always
  isolated - it can never affect a real Athena execution, and exporters run
  out-of-band (script/cron), never inline with request handling.
- `retention.ts` - `runAthenaObservabilityRetention`: batched, idempotent
  cleanup of telemetry/execution rows past a configurable retention window.

Backend HTTP surface: `app/backend/controllers/athenaObservability.controller.ts`
+ `app/backend/routes/athenaObservability.routes.ts`, mounted at
`/api/v1/athena/observability`. Every handler: feature-flag gate
(`ATHENA_OBSERVABILITY_ENABLED`, 404 when off, same posture as
`athena.controller.ts`'s `ATHENA_KERNEL_ENABLED` gate) -> authorization
(`requireRoles(req, ["owner", "admin"])`) -> Zod-validated query params ->
delegates to `athena-observability` service functions only. No controller
queries Prisma directly.

Background jobs (retention/export/alert evaluation) follow the existing
`runWithBackgroundDatabaseSession` pattern established by
`app/modules/supplier-integration/worker.ts` - there is no administrative
RLS-bypass path in this codebase, so every maintenance run is scoped to one
real `{ orgId, userId }` membership at a time, configured via
`ATHENA_OBSERVABILITY_MAINTENANCE_JOBS` (same `orgId:userId,...` shape as
`SUPPLIER_PRICE_SYNC_JOBS`). This is a deliberate consistency choice, not an
oversight: inventing a global-bypass query for "all orgs" would be exactly
the kind of new administrative pattern the milestone's own rules forbid.

## Operator Authorization

Deliberately narrower than the existing `requireOrgAdmin()`/
`current_app_can_administer()` helpers, both of which also admit
`dispatcher` (see `app/domain/contracts.ts`'s `settings.manage`/
`company.manage` grants and the RLS helper function definition). A10 treats
cost, trace, and error detail across an entire organization as owner/admin
operator data specifically, so every HTTP handler uses `requireRoles(req,
["owner", "admin"])` directly, and the new `athena_alerts` table's RLS
policies check `current_app_role() in ('owner', 'admin')` rather than
reusing `current_app_can_administer()`. Trace IDs never grant authorization
by themselves - every trace/request lookup is additionally scoped by the
caller's authenticated `orgId`, enforced identically at the application
query layer and the RLS floor.

## Trace Requirements

Reconstructed stages, only when they actually occurred for a given
execution:

```
Request (AthenaExecution)
 -> Kernel (span: kernel)
 -> Context (span: context)
 -> Planner (folded into kernel/approval span metadata: intent, planId)
 -> Permission/Approval (span: approval)
 -> Action (span: action)
 -> Tool (folded into the action span: toolId, toolVersion)
 -> Model (span: model)
 -> Memory (span: memory, A10-added)
 -> Event (observed separately via athena_events/*, not a span)
 -> Final Outcome (AthenaExecution.state/safeSummary/safeErrorCode)
```

## Metrics

Reliability: success/error/degraded/denied rate (bucketing documented in
`metricsService.ts`). Latency: p50/p95/p99 from `completedAt - createdAt`.
Tools: invocation/success/failure counts and p50/p95 latency, grouped by
`action` span `toolId`. Models: provider/model grouping from `model` span
metadata + cost JSON. Cost: total estimated USD, cost/request, cost/
successful request, cost by provider/model (cost/org is implicit - every
query is already org-scoped, so "total estimated cost" returned by
`getCostSummary` for an org's own window is its cost/org figure; a
cross-org cost/org breakdown is not exposed anywhere, by design - one org's
session can never see another org's cost). Event/DLQ health: event count,
delivery success rate, pending retries, dead-letter count and breakdown by
event type, read directly from A8's own tables.

## Alerts

Ten rule ids fixed in `types.ts` (`athenaAlertRuleIds`). Each evaluation
produces a `dedupeKey`; re-firing the same key updates `lastSeenAt` without
resetting `firstSeenAt` or creating a duplicate row (`AthenaAlert` is unique
on `(orgId, dedupeKey)`); a rule that stops firing resolves its active alert
(`status: "resolved"`, `resolvedAt` set). Do not sample away errors,
approvals, denials, high-risk actions, or security-sensitive events - none
of the alert or metrics queries in this milestone apply sampling; the only
bounded-sample behavior is `getOverviewMetrics`'s `averageTraceCompleteness`
figure (capped at the 500 most recent executions in the window, documented
in `metricsService.ts`), which is a display aggregate, not an omission of
underlying records. See the exporters/retention/alerts implementation
report (folded into this branch's final PR description) for exactly which
rules are fully implemented vs. a documented proxy vs. explicitly skipped
with a stated reason - `approval_bypass_attempt` and
`telemetry_write_failure` are the two rules most likely to need dedicated
security review before being trusted operationally.

## Exporters And Retention

Exporters (`console`, `webhook`) never throw out of `.export()` - failures
are caught and reported as counts/errors, and exporters only ever run
out-of-band via `app/scripts/run-athena-observability-export.ts`, never
inline with request handling, so an exporter outage cannot affect a real
Athena execution. Retention (`app/scripts/run-athena-observability-retention.ts`)
batches deletes (default batch size 500) and is idempotent - re-running
finds nothing left to delete. Default windows: telemetry spans 90 days
(`ATHENA_TELEMETRY_RETENTION_DAYS`), executions/transitions 400 days
(`ATHENA_EXECUTION_RETENTION_DAYS`, must be >= telemetry retention). No
Kafka, Elasticsearch, ClickHouse, or other external observability platform
is introduced - exporters are a plain HTTP webhook or console output only.

## Dashboards

`web/src/app/(app)/athena/` - Overview (KPIs + active alerts), Trace
Explorer (bounded/filtered search with pagination), Trace Detail (execution
summary, lifecycle timeline, span list, completeness checklist), Tool
Health, Model & Cost, Event/DLQ Health. Every page implements loading,
empty, error, and permission-denied states (denied covers both a
non-owner/admin role and the feature flag being off, treated as the same
calm "not available" state rather than a scary error).

## Required Tests

Telemetry: existing `athena-kernel.service.test.ts` regression (33/33
passing after the memory-span change) plus completeness algorithm coverage.
Trace: lookup by trace/request id (including not-found), search
filtering/pagination/cursor behavior, timeline ordering, completeness
scoring. Metrics: latency percentiles, reliability rates, tool/model/cost
aggregation, event/DLQ counts. Security: cross-org denial for every
trace/metrics/alert query, trace ID cannot bypass authorization, no raw
prompt/secret/reasoning ever surfaces (spans only ever expose what
write-time redaction already allowed through - this milestone's read layer
adds no new redaction logic and must not need to). Exporters: success,
failure isolation, timeout handling. Alerts: dedup, firing, resolution.
Retention: batching, idempotency, org isolation. UI: loading/empty/error/
denied on every page.

## Exit Criteria

Requests and actions are traceable through an operator workflow (Alert
fires -> Athena Overview -> Trace Explorer -> Trace Detail -> safe failure
reason) using only C011 telemetry and the existing A1/A8 tables - no
`ObservabilityRecordV2`, no second telemetry system, no competing event
format. Safe observability data is available without storing raw prompts,
hidden reasoning, or secrets - the read layer inherits write-time
redaction rather than reimplementing it. Tenant boundaries are enforced at
the application layer and the database RLS floor independently, matching
A7/A8's isolation posture, with `owner`/`admin`-only operator authorization
(narrower than the pre-existing `current_app_can_administer()` helper).
Exporters fail safely; retention is batched and idempotent; alerts dedupe
and resolve. No A11 (prompt injection defenses, plugin sandboxing, abuse
controls), A12 (business tools), or A13 (plugin SDK) work is present.
Rollback: set `ATHENA_OBSERVABILITY_ENABLED=false` (already the default) to
make every new route 404 again; stop invoking the retention/export/alert
scripts to freeze exporter/retention/alert activity without touching the
underlying telemetry the kernel already records.
