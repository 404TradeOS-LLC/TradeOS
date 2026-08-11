-- Project Athena A10 Observability persistence
-- (docs/athena/roadmap/A10-observability-implementation-plan.md). A10 does
-- not introduce a competing telemetry system: it adds the indexes that the
-- existing C011 telemetry/execution tables need to support bounded trace
-- and metrics queries, plus one new table (athena_alerts) that holds only
-- derived operational alert state - never a copy of the underlying
-- telemetry/event data.

-- Trace/request lookup and bounded time-range search.
create index idx_athena_executions_org_trace on athena_executions(org_id, trace_id);
create index idx_athena_executions_org_request on athena_executions(org_id, request_id);
create index idx_athena_executions_org_created on athena_executions(org_id, created_at);

create index idx_athena_telemetry_records_org_trace on athena_telemetry_records(org_id, trace_id);
create index idx_athena_telemetry_records_org_span_created on athena_telemetry_records(org_id, span_type, created_at);
create index idx_athena_telemetry_records_org_status_created on athena_telemetry_records(org_id, status, created_at);

-- Event/DLQ Health lists recent dead letters org-wide.
create index idx_athena_event_dead_letters_org_created on athena_event_dead_letters(org_id, created_at);

create table athena_alerts (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  rule_id        text not null,
  dedupe_key     text not null,
  severity       text not null check (severity in ('critical', 'high', 'medium', 'low')),
  status         text not null default 'active' check (status in ('active', 'resolved')),
  summary        text not null,
  metadata_json  jsonb not null default '{}'::jsonb,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  resolved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index idx_athena_alerts_org_dedupe_key on athena_alerts(org_id, dedupe_key);
create index idx_athena_alerts_org_status_last_seen on athena_alerts(org_id, status, last_seen_at);

alter table athena_alerts enable row level security;
alter table athena_alerts force row level security;

-- Observability is operator-only (docs/athena/roadmap/
-- A10-observability-implementation-plan.md "Operator authorization"):
-- deliberately narrower than current_app_can_administer() (which also
-- includes 'dispatcher') - only owner/admin may see or act on alerts, cost,
-- traces, or tool/model metrics. Writes are service-owned (the alert
-- evaluator runs as an authenticated org session, not tied to one specific
-- user), so insert/update only need the org + role check, not an actor
-- match.
create policy athena_alerts_select_policy on athena_alerts
for select using (
  org_id = (select current_app_org_id())
  and (select current_app_role()) in ('owner', 'admin')
);

create policy athena_alerts_insert_policy on athena_alerts
for insert with check (
  org_id = (select current_app_org_id())
  and (select current_app_role()) in ('owner', 'admin')
);

create policy athena_alerts_update_policy on athena_alerts
for update using (
  org_id = (select current_app_org_id())
  and (select current_app_role()) in ('owner', 'admin')
) with check (
  org_id = (select current_app_org_id())
  and (select current_app_role()) in ('owner', 'admin')
);
