-- Project Athena A7 memory persistence
-- (docs/athena/roadmap/A7-memory-implementation-plan.md, C006 in
-- docs/athena/contracts/README.md). Holds only durable, deliberately
-- attributed memory content that already passed athena-memory/writePolicy.ts
-- (no secrets/credentials/raw payment data by construction) - never a raw
-- conversation transcript or arbitrary tool result.

create table athena_memories (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references organizations(id) on delete cascade,
  scope                 text not null check (scope in ('user', 'organization', 'project', 'job', 'conversation')),
  -- Not a foreign key: polymorphic depending on scope (a user id, the
  -- organization's own id, a job/project id, or a conversation id - the
  -- last of which is not guaranteed to be a uuid). Ownership is enforced by
  -- the RLS policies below and independently by athena-memory/service.ts.
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

-- Deterministic upsert (docs task Step 5): at most one active memory per
-- stable key. A "correction" (writePolicy.ts's "update" decision) flips the
-- previous active row to status = 'corrected' and inserts a new active row
-- with supersedes set, inside the same transaction - so this index is never
-- violated by a legitimate correction.
create unique index idx_athena_memories_active_stable_key
  on athena_memories (org_id, scope, subject_id, kind)
  where status = 'active';

create index idx_athena_memories_org_scope_subject_status on athena_memories(org_id, scope, subject_id, status);
create index idx_athena_memories_org_scope_subject_kind_status on athena_memories(org_id, scope, subject_id, kind, status);
create index idx_athena_memories_org_retention_expires on athena_memories(org_id, retention_expires_at) where retention_expires_at is not null;

alter table athena_memories enable row level security;
alter table athena_memories force row level security;

-- Stricter than every other Athena table's RLS so far: "user"/"conversation"
-- scope rows are visible/writable only to the exact matching actor, with no
-- admin bypass (docs task brief's isolation requirement: "org A / user A
-- must never be retrievable... by org A / user B", stronger than
-- athena_executions_select_policy's admin-sees-all-in-org posture, which is
-- appropriate for an audit trail but not for a user's private preference
-- memory). "organization"/"project"/"job" scope rows are readable by any org
-- member and writable only by an admin-capable actor
-- (current_app_can_administer(), same role set - owner/admin/dispatcher - as
-- 08-memory/README.md's "Organization memory: Admin-managed with audit").
create policy athena_memories_select_policy on athena_memories
for select using (
  org_id = (select current_app_org_id())
  and (
    (scope in ('user', 'conversation') and subject_id = (select current_app_user_id())::text)
    or scope in ('organization', 'project', 'job')
  )
);

create policy athena_memories_insert_policy on athena_memories
for insert with check (
  org_id = (select current_app_org_id())
  and (
    (scope in ('user', 'conversation') and subject_id = (select current_app_user_id())::text)
    or (scope in ('organization', 'project', 'job') and current_app_can_administer())
  )
);

create policy athena_memories_update_policy on athena_memories
for update using (
  org_id = (select current_app_org_id())
  and (
    (scope in ('user', 'conversation') and subject_id = (select current_app_user_id())::text)
    or (scope in ('organization', 'project', 'job') and current_app_can_administer())
  )
) with check (
  org_id = (select current_app_org_id())
  and (
    (scope in ('user', 'conversation') and subject_id = (select current_app_user_id())::text)
    or (scope in ('organization', 'project', 'job') and current_app_can_administer())
  )
);
