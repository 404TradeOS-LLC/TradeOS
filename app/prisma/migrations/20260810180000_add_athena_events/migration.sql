-- Project Athena A8 event integration persistence
-- (docs/athena/roadmap/A8-event-integration-implementation-plan.md, C008 in
-- docs/athena/contracts/README.md). athena_events holds only C008-validated
-- canonical business events; payload_json is the tool/service-constructed
-- event payload, never a raw prompt, secret, or unnecessary PII
-- (docs/athena/09-security/README.md).

create table athena_events (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  type            text not null,
  version         text not null,
  -- Not a foreign key: entity is polymorphic across business object types
  -- (proposal, job, invoice, ...), same posture as athena_memories.subject_id.
  entity_type     text not null,
  entity_id       text not null,
  actor_type      text not null check (actor_type in ('user', 'system', 'athena')),
  -- Nullable: 'system'/'athena' actors may have no user id.
  actor_id        text,
  occurred_at     timestamptz not null,
  payload_json    jsonb not null,
  correlation_id  text not null,
  idempotency_key text not null,
  causation_id    text,
  is_replay       boolean not null default false,
  replayed_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- Publication dedupe key (plan doc "Versioning, Retries, Deduplication,
-- Replay": "Publication dedupes by (orgId, idempotencyKey)").
create unique index idx_athena_events_org_idempotency_key on athena_events(org_id, idempotency_key);
create index idx_athena_events_org_type_occurred on athena_events(org_id, type, occurred_at);
create index idx_athena_events_org_entity on athena_events(org_id, entity_type, entity_id);

create table athena_event_deliveries (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  event_id          uuid not null references athena_events(id) on delete cascade,
  subscriber_id     text not null,
  status            text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'dead_letter')),
  attempt_count     integer not null default 0,
  next_attempt_at   timestamptz not null default now(),
  last_error        text,
  last_attempt_at   timestamptz,
  succeeded_at      timestamptz,
  is_replay         boolean not null default false,
  replayed_from_id  uuid references athena_event_deliveries(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Dispatch dedupe key (plan doc: "dispatch dedupes by (eventId,
-- subscriberId) - a delivery row is claimed exactly once per attempt
-- cycle"). A replay creates a *new* delivery row rather than reusing this
-- one, so replay does not violate this constraint - see replay.ts.
create unique index idx_athena_event_deliveries_event_subscriber on athena_event_deliveries(event_id, subscriber_id) where is_replay = false;
create index idx_athena_event_deliveries_org_status_next_attempt on athena_event_deliveries(org_id, status, next_attempt_at);

create table athena_event_dead_letters (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references organizations(id) on delete cascade,
  delivery_id            uuid not null unique references athena_event_deliveries(id) on delete cascade,
  event_id               uuid not null references athena_events(id) on delete cascade,
  subscriber_id          text not null,
  failure_reason         text not null,
  payload_snapshot_json  jsonb not null,
  attempt_count          integer not null,
  created_at             timestamptz not null default now()
);

create index idx_athena_event_dead_letters_org_event on athena_event_dead_letters(org_id, event_id);

alter table athena_events enable row level security;
alter table athena_events force row level security;

-- Same posture as athena_executions: owners/admins/dispatchers see every
-- event in their org for audit purposes; a non-admin actor sees events they
-- themselves triggered plus system/athena-originated events (business-wide
-- facts, not private per-user data - unlike athena_memories' user-scope
-- rows). Insert requires the caller's own session to match the event's
-- claimed actor when actor_type = 'user', so no session can forge another
-- user's authorship; system/athena-actor events may be inserted by any
-- authenticated session in the org (the publishing service, not an
-- individual user, owns that authorization decision at the application
-- layer per ADR-008 - RLS here is the isolation floor, not the primary
-- authorization gate for a service-owned write).
create policy athena_events_select_policy on athena_events
for select using (
  org_id = (select current_app_org_id())
  and (
    current_app_can_administer()
    or actor_type <> 'user'
    or actor_id = (select current_app_user_id())::text
  )
);

create policy athena_events_insert_policy on athena_events
for insert with check (
  org_id = (select current_app_org_id())
  and (
    actor_type <> 'user'
    or actor_id = (select current_app_user_id())::text
  )
);

alter table athena_event_deliveries enable row level security;
alter table athena_event_deliveries force row level security;

-- Delivery/dead-letter rows are infra-owned (dispatch worker, not an
-- individual end user), so access derives entirely from the parent event's
-- own visibility rule rather than a second actor check.
create policy athena_event_deliveries_select_policy on athena_event_deliveries
for select using (
  org_id = (select current_app_org_id())
  and exists (
    select 1 from athena_events
    where athena_events.id = athena_event_deliveries.event_id
      and athena_events.org_id = (select current_app_org_id())
      and (
        current_app_can_administer()
        or athena_events.actor_type <> 'user'
        or athena_events.actor_id = (select current_app_user_id())::text
      )
  )
);

create policy athena_event_deliveries_insert_policy on athena_event_deliveries
for insert with check (
  org_id = (select current_app_org_id())
  and exists (
    select 1 from athena_events
    where athena_events.id = athena_event_deliveries.event_id
      and athena_events.org_id = (select current_app_org_id())
  )
);

create policy athena_event_deliveries_update_policy on athena_event_deliveries
for update using (
  org_id = (select current_app_org_id())
  and exists (
    select 1 from athena_events
    where athena_events.id = athena_event_deliveries.event_id
      and athena_events.org_id = (select current_app_org_id())
  )
) with check (
  org_id = (select current_app_org_id())
  and exists (
    select 1 from athena_events
    where athena_events.id = athena_event_deliveries.event_id
      and athena_events.org_id = (select current_app_org_id())
  )
);

alter table athena_event_dead_letters enable row level security;
alter table athena_event_dead_letters force row level security;

create policy athena_event_dead_letters_select_policy on athena_event_dead_letters
for select using (
  org_id = (select current_app_org_id())
  and exists (
    select 1 from athena_events
    where athena_events.id = athena_event_dead_letters.event_id
      and athena_events.org_id = (select current_app_org_id())
      and (
        current_app_can_administer()
        or athena_events.actor_type <> 'user'
        or athena_events.actor_id = (select current_app_user_id())::text
      )
  )
);

create policy athena_event_dead_letters_insert_policy on athena_event_dead_letters
for insert with check (
  org_id = (select current_app_org_id())
  and exists (
    select 1 from athena_events
    where athena_events.id = athena_event_dead_letters.event_id
      and athena_events.org_id = (select current_app_org_id())
  )
);
