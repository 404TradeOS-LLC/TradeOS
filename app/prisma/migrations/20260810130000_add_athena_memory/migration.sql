-- Project Athena A7 memory persistence
-- Durable, source-attributed memory only. Project/job scopes are part of the
-- contract but remain fail-closed until explicit object-scope authorization
-- exists at both the application and database layers.

create table athena_memories (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references organizations(id) on delete cascade,
  scope                 text not null check (scope in ('user', 'organization', 'project', 'job', 'conversation')),
  subject_id            text not null,
  kind                  text not null,
  value_json            jsonb,
  source_kind           text not null check (source_kind in ('user_message', 'approved_action', 'application_record', 'event', 'document', 'admin_policy')),
  source_id             text,
  source_trusted        boolean not null default false,
  source_description    text,
  confidence            real not null check (confidence >= 0 and confidence <= 1),
  retention_tier        text not null default 'standard' check (retention_tier in ('short_term', 'standard', 'long_term')),
  retention_expires_at  timestamptz,
  retention_legal_hold  boolean not null default false,
  status                text not null default 'active' check (status in ('active', 'corrected', 'deleted')),
  supersedes            uuid references athena_memories(id) on delete set null,
  visibility            text not null check (visibility in ('actor', 'organization')),
  created_by_actor_type text not null,
  created_by_actor_id   text not null,
  updated_by_actor_type text not null,
  updated_by_actor_id   text not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  last_accessed_at      timestamptz,
  metadata_json         jsonb not null default '{}'::jsonb
);

create unique index idx_athena_memories_active_stable_key
  on athena_memories (org_id, scope, subject_id, kind)
  where status = 'active';

create index idx_athena_memories_org_scope_subject_status on athena_memories(org_id, scope, subject_id, status);
create index idx_athena_memories_org_scope_subject_kind_status on athena_memories(org_id, scope, subject_id, kind, status);
create index idx_athena_memories_org_retention_expires on athena_memories(org_id, retention_expires_at) where retention_expires_at is not null;

alter table athena_memories enable row level security;
alter table athena_memories force row level security;

-- User/conversation memory is private to the exact actor with no admin
-- bypass. Organization memory is readable to the organization and mutable by
-- an admin-capable actor. Project/job rows are intentionally unreachable in
-- A7; enabling them requires a later migration that binds memory visibility to
-- authoritative project/job object-scope rules.
create policy athena_memories_select_policy on athena_memories
for select using (
  org_id = (select current_app_org_id())
  and (
    (scope in ('user', 'conversation') and subject_id = (select current_app_user_id())::text)
    or (scope = 'organization' and subject_id = (select current_app_org_id())::text)
  )
);

create policy athena_memories_insert_policy on athena_memories
for insert with check (
  org_id = (select current_app_org_id())
  and (
    (scope in ('user', 'conversation') and subject_id = (select current_app_user_id())::text)
    or (scope = 'organization' and subject_id = (select current_app_org_id())::text and current_app_can_administer())
  )
);

create policy athena_memories_update_policy on athena_memories
for update using (
  org_id = (select current_app_org_id())
  and (
    (scope in ('user', 'conversation') and subject_id = (select current_app_user_id())::text)
    or (scope = 'organization' and subject_id = (select current_app_org_id())::text and current_app_can_administer())
  )
) with check (
  org_id = (select current_app_org_id())
  and (
    (scope in ('user', 'conversation') and subject_id = (select current_app_user_id())::text)
    or (scope = 'organization' and subject_id = (select current_app_org_id())::text and current_app_can_administer())
  )
);
