-- S025 metadata-first AI generation persistence.
-- Raw prompts, model output, tool arguments, and tool results are never stored.

create table athena_generation_runs (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references organizations(id) on delete cascade,
  actor_user_id         uuid not null references users(id) on delete restrict,
  execution_id          uuid references athena_executions(id) on delete set null,
  request_id            text not null,
  trace_id              text not null,
  provider              text not null,
  model                 text not null,
  provider_version      text,
  status                text not null check (status in ('succeeded', 'failed', 'cancelled', 'expired', 'denied')),
  failure_code          text,
  input_tokens          integer,
  output_tokens         integer,
  estimated_usd          numeric(12, 6),
  latency_ms            integer not null check (latency_ms >= 0),
  tool_names_json        jsonb not null default '[]'::jsonb,
  provenance_json        jsonb not null default '{}'::jsonb,
  retention_expires_at   timestamptz not null,
  created_at             timestamptz not null default now(),
  completed_at           timestamptz
);

create index idx_athena_generation_runs_org_actor_created
  on athena_generation_runs(org_id, actor_user_id, created_at);
create index idx_athena_generation_runs_org_execution_created
  on athena_generation_runs(org_id, execution_id, created_at);
create index idx_athena_generation_runs_org_retention
  on athena_generation_runs(org_id, retention_expires_at);

create table athena_generation_reviews (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  generation_id   uuid not null references athena_generation_runs(id) on delete cascade,
  reviewer_user_id uuid not null references users(id) on delete restrict,
  outcome         text not null check (outcome in ('accepted', 'rejected', 'amended')),
  provenance_json jsonb not null default '{}'::jsonb,
  reviewed_at     timestamptz not null,
  created_at      timestamptz not null default now()
);

create index idx_athena_generation_reviews_org_generation_reviewed
  on athena_generation_reviews(org_id, generation_id, reviewed_at);
create index idx_athena_generation_reviews_org_reviewer_reviewed
  on athena_generation_reviews(org_id, reviewer_user_id, reviewed_at);

alter table athena_generation_runs enable row level security;
alter table athena_generation_runs force row level security;

create policy athena_generation_runs_select_policy on athena_generation_runs
for select using (
  org_id = (select current_app_org_id())
  and (current_app_can_administer() or actor_user_id = (select current_app_user_id()))
);

create policy athena_generation_runs_insert_policy on athena_generation_runs
for insert with check (
  org_id = (select current_app_org_id())
  and actor_user_id = (select current_app_user_id())
  and (
    execution_id is null
    or exists (
      select 1
      from athena_executions
      where athena_executions.id = execution_id
        and athena_executions.org_id = (select current_app_org_id())
    )
  )
);

create policy athena_generation_runs_delete_policy on athena_generation_runs
for delete using (
  org_id = (select current_app_org_id())
  and current_app_can_administer()
);

alter table athena_generation_reviews enable row level security;
alter table athena_generation_reviews force row level security;

create policy athena_generation_reviews_select_policy on athena_generation_reviews
for select using (
  org_id = (select current_app_org_id())
  and (
    current_app_can_administer()
    or reviewer_user_id = (select current_app_user_id())
    or exists (
      select 1 from athena_generation_runs
      where athena_generation_runs.id = athena_generation_reviews.generation_id
        and athena_generation_runs.org_id = (select current_app_org_id())
        and athena_generation_runs.actor_user_id = (select current_app_user_id())
    )
  )
);

create policy athena_generation_reviews_insert_policy on athena_generation_reviews
for insert with check (
  org_id = (select current_app_org_id())
  and reviewer_user_id = (select current_app_user_id())
  and exists (
    select 1 from athena_generation_runs
    where athena_generation_runs.id = athena_generation_reviews.generation_id
      and athena_generation_runs.org_id = (select current_app_org_id())
      and current_app_can_administer()
  )
);
