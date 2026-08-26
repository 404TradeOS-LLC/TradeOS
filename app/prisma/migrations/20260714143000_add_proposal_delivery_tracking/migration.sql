create table proposal_deliveries (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  proposal_id       uuid not null references proposals(id) on delete cascade,
  event_type        text not null,
  delivery_channel  text not null default 'app',
  recipient_email   text,
  actor_user_id     uuid references users(id) on delete set null,
  metadata_json     jsonb,
  occurred_at       timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index idx_proposal_deliveries_org_proposal_occurred
  on proposal_deliveries(org_id, proposal_id, occurred_at desc);
create index idx_proposal_deliveries_org_event_occurred
  on proposal_deliveries(org_id, event_type, occurred_at desc);

alter table proposal_deliveries enable row level security;
alter table proposal_deliveries force row level security;

create policy proposal_deliveries_select_policy on proposal_deliveries
for select using (
  org_id = (select current_app_org_id())
);

create policy proposal_deliveries_write_policy on proposal_deliveries
for all using (
  org_id = (select current_app_org_id()) and (select current_app_can_write())
) with check (
  org_id = (select current_app_org_id()) and (select current_app_can_write())
);
