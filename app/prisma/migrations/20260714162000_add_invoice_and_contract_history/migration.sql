create table invoice_deliveries (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  invoice_id        uuid not null references invoices(id) on delete cascade,
  event_type        text not null,
  delivery_channel  text not null default 'app',
  recipient_email   text,
  actor_user_id     uuid references users(id) on delete set null,
  metadata_json     jsonb,
  occurred_at       timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index idx_invoice_deliveries_org_invoice_occurred
  on invoice_deliveries(org_id, invoice_id, occurred_at desc);
create index idx_invoice_deliveries_org_event_occurred
  on invoice_deliveries(org_id, event_type, occurred_at desc);

alter table invoice_deliveries enable row level security;
alter table invoice_deliveries force row level security;

create policy invoice_deliveries_select_policy on invoice_deliveries
for select using (
  org_id = (select current_app_org_id())
);

create policy invoice_deliveries_write_policy on invoice_deliveries
for all using (
  org_id = (select current_app_org_id()) and (select current_app_can_write())
) with check (
  org_id = (select current_app_org_id()) and (select current_app_can_write())
);

create table contract_events (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  contract_id       uuid not null references contracts(id) on delete cascade,
  event_type        text not null,
  actor_user_id     uuid references users(id) on delete set null,
  recipient_email   text,
  metadata_json     jsonb,
  occurred_at       timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index idx_contract_events_org_contract_occurred
  on contract_events(org_id, contract_id, occurred_at desc);
create index idx_contract_events_org_event_occurred
  on contract_events(org_id, event_type, occurred_at desc);

alter table contract_events enable row level security;
alter table contract_events force row level security;

create policy contract_events_select_policy on contract_events
for select using (
  org_id = (select current_app_org_id())
);

create policy contract_events_write_policy on contract_events
for all using (
  org_id = (select current_app_org_id()) and (select current_app_can_write())
) with check (
  org_id = (select current_app_org_id()) and (select current_app_can_write())
);
