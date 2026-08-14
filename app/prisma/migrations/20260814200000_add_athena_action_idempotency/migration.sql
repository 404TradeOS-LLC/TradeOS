create table athena_action_idempotency (
  id uuid primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  actor_user_id uuid not null references users(id) on delete restrict,
  tool_id text not null,
  tool_version text not null,
  idempotency_key text not null,
  input_hash text not null,
  status text not null default 'reserved' check (status in ('reserved', 'completed')),
  action_json jsonb,
  result_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint athena_action_idempotency_completed_payload check (
    (status = 'reserved' and action_json is null and result_json is null)
    or
    (status = 'completed' and action_json is not null and result_json is not null)
  )
);

create unique index idx_athena_action_idempotency_scope
  on athena_action_idempotency(org_id, tool_id, tool_version, idempotency_key);
create index idx_athena_action_idempotency_actor_updated
  on athena_action_idempotency(org_id, actor_user_id, updated_at);

alter table athena_action_idempotency enable row level security;
alter table athena_action_idempotency force row level security;

create policy athena_action_idempotency_select_policy on athena_action_idempotency
  for select
  using (
    org_id = (select current_app_org_id())
    and actor_user_id = (select current_app_user_id())
  );

create policy athena_action_idempotency_insert_policy on athena_action_idempotency
  for insert
  with check (
    org_id = (select current_app_org_id())
    and actor_user_id = (select current_app_user_id())
  );

create policy athena_action_idempotency_update_policy on athena_action_idempotency
  for update
  using (
    org_id = (select current_app_org_id())
    and actor_user_id = (select current_app_user_id())
  )
  with check (
    org_id = (select current_app_org_id())
    and actor_user_id = (select current_app_user_id())
  );

create policy athena_action_idempotency_delete_policy on athena_action_idempotency
  for delete
  using (
    org_id = (select current_app_org_id())
    and actor_user_id = (select current_app_user_id())
  );
