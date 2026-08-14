create table athena_approvals (
  id uuid primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete restrict,
  action_id text not null,
  tool_id text not null,
  tool_version text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  approved_at timestamptz,
  approved_by text,
  expires_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'granted', 'denied', 'revoked', 'expired')),
  idempotency_key text not null,
  input_hash text not null,
  plan_id text not null,
  step_id text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_athena_approvals_org_action on athena_approvals(org_id, action_id);
create index idx_athena_approvals_org_user_status on athena_approvals(org_id, user_id, status);
create index idx_athena_approvals_org_expires on athena_approvals(org_id, expires_at);

alter table athena_approvals enable row level security;
alter table athena_approvals force row level security;

create policy athena_approvals_select_policy on athena_approvals
  for select
  using (
    org_id = (select current_app_org_id())
    and (
      current_app_role() in ('owner', 'admin', 'dispatcher')
      or user_id = current_app_user_id()
    )
  );

create policy athena_approvals_insert_policy on athena_approvals
  for insert
  with check (
    org_id = (select current_app_org_id())
    and (
      current_app_role() in ('owner', 'admin', 'dispatcher')
      or user_id = current_app_user_id()
    )
  );

create policy athena_approvals_update_policy on athena_approvals
  for update
  using (
    org_id = (select current_app_org_id())
    and current_app_role() in ('owner', 'admin', 'dispatcher')
  )
  with check (
    org_id = (select current_app_org_id())
    and current_app_role() in ('owner', 'admin', 'dispatcher')
  );

create table athena_audit_events (
  id uuid primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  actor_user_id uuid references app_users(id) on delete set null,
  actor_role text,
  request_id text,
  trace_id text,
  execution_id uuid,
  action_id text,
  approval_id uuid,
  event_type text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_athena_audit_events_org_created on athena_audit_events(org_id, created_at);
create index idx_athena_audit_events_org_event_type_created on athena_audit_events(org_id, event_type, created_at);
create index idx_athena_audit_events_org_execution_created on athena_audit_events(org_id, execution_id, created_at);

alter table athena_audit_events enable row level security;
alter table athena_audit_events force row level security;

create policy athena_audit_events_select_policy on athena_audit_events
  for select
  using (
    org_id = (select current_app_org_id())
    and (
      current_app_role() in ('owner', 'admin', 'dispatcher')
      or actor_user_id is null
      or actor_user_id = current_app_user_id()
    )
  );

create policy athena_audit_events_insert_policy on athena_audit_events
  for insert
  with check (
    org_id = (select current_app_org_id())
    and (
      current_app_role() in ('owner', 'admin', 'dispatcher')
      or actor_user_id is null
      or actor_user_id = current_app_user_id()
    )
  );
