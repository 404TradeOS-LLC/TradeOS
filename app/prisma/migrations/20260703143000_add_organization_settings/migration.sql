create table if not exists organization_settings (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null unique references organizations(id) on delete cascade,
  settings_json jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_organization_settings_org_id on organization_settings(org_id);

alter table organization_settings enable row level security;
alter table organization_settings force row level security;

create policy organization_settings_select_policy on organization_settings
for select using (
  org_id = (select current_app_org_id())
);

create policy organization_settings_write_policy on organization_settings
for all using (
  org_id = (select current_app_org_id()) and (select current_app_can_administer())
) with check (
  org_id = (select current_app_org_id()) and (select current_app_can_administer())
);
