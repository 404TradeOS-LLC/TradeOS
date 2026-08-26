-- Project Athena A1 kernel execution persistence
-- (docs/athena/roadmap/A1-ai-kernel-implementation-plan.md
-- "A1 Execution Persistence Decision"). These tables hold only safe
-- summaries, error codes, and lifecycle/telemetry metadata - never a raw
-- prompt, message body, or model output.

create table athena_executions (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  request_id      text not null,
  trace_id        text not null,
  actor_user_id   uuid not null references users(id) on delete restrict,
  actor_type      text not null default 'user',
  canonical_role  text not null,
  request_source  text not null,
  state           text not null default 'created',
  round_trips     integer not null default 0,
  safe_summary    text,
  safe_error_code text,
  redaction_mode  text not null default 'metadata_only',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create index idx_athena_executions_org_state on athena_executions(org_id, state);
create index idx_athena_executions_org_actor_created on athena_executions(org_id, actor_user_id, created_at);

create table athena_execution_transitions (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  execution_id  uuid not null references athena_executions(id) on delete cascade,
  from_state    text,
  to_state      text not null,
  reason_code   text not null,
  metadata_json jsonb,
  created_at    timestamptz not null default now()
);

create index idx_athena_execution_transitions_org_execution on athena_execution_transitions(org_id, execution_id, created_at);

create table athena_telemetry_records (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  execution_id  uuid not null references athena_executions(id) on delete cascade,
  request_id    text not null,
  trace_id      text not null,
  span_type     text not null,
  status        text not null,
  duration_ms   integer not null,
  redaction     text not null,
  cost_json     jsonb,
  metadata_json jsonb not null,
  created_at    timestamptz not null default now()
);

create index idx_athena_telemetry_records_org_execution on athena_telemetry_records(org_id, execution_id, created_at);

alter table athena_executions enable row level security;
alter table athena_executions force row level security;

-- Athena execution records are actor-scoped, not merely org-scoped:
-- object-level RLS (HIGH-005, A0.5 review) applies here even though A1 has
-- no business-object context yet, because a kernel execution record can
-- reveal that a specific user asked Athena something. Owners/admins/
-- dispatchers can see every execution in their org for audit purposes;
-- everyone else only sees their own.
create policy athena_executions_select_policy on athena_executions
for select using (
  org_id = (select current_app_org_id())
  and (
    current_app_can_administer()
    or actor_user_id = current_app_user_id()
  )
);

create policy athena_executions_insert_policy on athena_executions
for insert with check (
  org_id = (select current_app_org_id())
  and actor_user_id = current_app_user_id()
);

create policy athena_executions_update_policy on athena_executions
for update using (
  org_id = (select current_app_org_id())
  and (
    current_app_can_administer()
    or actor_user_id = current_app_user_id()
  )
) with check (
  org_id = (select current_app_org_id())
  and (
    current_app_can_administer()
    or actor_user_id = current_app_user_id()
  )
);

alter table athena_execution_transitions enable row level security;
alter table athena_execution_transitions force row level security;

create policy athena_execution_transitions_select_policy on athena_execution_transitions
for select using (
  org_id = (select current_app_org_id())
  and exists (
    select 1
    from athena_executions
    where athena_executions.id = athena_execution_transitions.execution_id
      and athena_executions.org_id = (select current_app_org_id())
      and (
        current_app_can_administer()
        or athena_executions.actor_user_id = current_app_user_id()
      )
  )
);

create policy athena_execution_transitions_insert_policy on athena_execution_transitions
for insert with check (
  org_id = (select current_app_org_id())
  and exists (
    select 1
    from athena_executions
    where athena_executions.id = athena_execution_transitions.execution_id
      and athena_executions.org_id = (select current_app_org_id())
      and athena_executions.actor_user_id = current_app_user_id()
  )
);

alter table athena_telemetry_records enable row level security;
alter table athena_telemetry_records force row level security;

create policy athena_telemetry_records_select_policy on athena_telemetry_records
for select using (
  org_id = (select current_app_org_id())
  and exists (
    select 1
    from athena_executions
    where athena_executions.id = athena_telemetry_records.execution_id
      and athena_executions.org_id = (select current_app_org_id())
      and (
        current_app_can_administer()
        or athena_executions.actor_user_id = current_app_user_id()
      )
  )
);

create policy athena_telemetry_records_insert_policy on athena_telemetry_records
for insert with check (
  org_id = (select current_app_org_id())
  and exists (
    select 1
    from athena_executions
    where athena_executions.id = athena_telemetry_records.execution_id
      and athena_executions.org_id = (select current_app_org_id())
      and athena_executions.actor_user_id = current_app_user_id()
  )
);
