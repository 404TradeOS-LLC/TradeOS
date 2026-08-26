create or replace function current_app_can_write() returns boolean
language sql stable
as $$
  select coalesce(current_app_role() in ('owner', 'admin', 'estimator', 'dispatcher', 'technician'), false)
$$;

create or replace function current_app_can_administer() returns boolean
language sql stable
as $$
  select coalesce(current_app_role() in ('owner', 'admin', 'dispatcher'), false)
$$;

create table service_addresses (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  customer_id     uuid not null references customers(id) on delete cascade,
  label           text,
  address_line_1  text not null,
  address_line_2  text,
  city            text not null,
  state           text not null,
  postal_code     text not null,
  country         text default 'US',
  is_primary      boolean not null default false,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_service_addresses_org_customer on service_addresses(org_id, customer_id);

create table customer_equipment (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organizations(id) on delete cascade,
  customer_id        uuid not null references customers(id) on delete cascade,
  service_address_id uuid references service_addresses(id) on delete set null,
  name               text not null,
  manufacturer       text,
  model              text,
  serial_number      text,
  installed_at       timestamptz,
  status             text not null default 'active',
  notes              text,
  deleted_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_customer_equipment_org_customer on customer_equipment(org_id, customer_id);
create index idx_customer_equipment_service_address on customer_equipment(service_address_id);

create table service_agreements (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organizations(id) on delete cascade,
  customer_id        uuid not null references customers(id) on delete cascade,
  service_address_id uuid references service_addresses(id) on delete set null,
  project_id         uuid references projects(id) on delete set null,
  name               text not null,
  status             text not null default 'draft',
  start_date         timestamptz,
  end_date           timestamptz,
  billing_cadence    text,
  amount             numeric(14, 2),
  terms              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_service_agreements_org_customer on service_agreements(org_id, customer_id);
create index idx_service_agreements_project on service_agreements(project_id);

create table payments (
  id            uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  invoice_id     uuid not null references invoices(id) on delete cascade,
  amount         numeric(14, 2) not null,
  payment_date   timestamptz not null,
  method         text not null,
  status         text not null default 'recorded',
  reference      text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_payments_org_invoice on payments(org_id, invoice_id);

create table organization_invites (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organizations(id) on delete cascade,
  email              text not null,
  role               text not null,
  token_hash         text not null unique,
  invited_by_user_id uuid not null references users(id) on delete cascade,
  expires_at         timestamptz not null,
  accepted_at        timestamptz,
  status             text not null default 'pending',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_organization_invites_org_email_status on organization_invites(org_id, email, status);

create table auth_refresh_tokens (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  user_id        uuid not null references users(id) on delete cascade,
  membership_id  uuid not null references organization_memberships(id) on delete cascade,
  token_hash     text not null unique,
  expires_at     timestamptz not null,
  last_used_at   timestamptz,
  revoked_at     timestamptz,
  replaced_by_id uuid,
  created_at     timestamptz not null default now()
);

create index idx_auth_refresh_tokens_user_org on auth_refresh_tokens(user_id, org_id);
create index idx_auth_refresh_tokens_membership on auth_refresh_tokens(membership_id);

create table password_reset_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index idx_password_reset_tokens_user_expires on password_reset_tokens(user_id, expires_at);

create table user_totp_credentials (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references users(id) on delete cascade,
  secret_encrypted text not null,
  enabled_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

do $$
declare
  tenant_table text;
begin
  foreach tenant_table in array array[
    'service_addresses', 'customer_equipment', 'service_agreements', 'payments'
  ]
  loop
    execute format('alter table %I enable row level security', tenant_table);
    execute format('alter table %I force row level security', tenant_table);
    execute format(
      'create policy %I on %I for select using (org_id = (select current_app_org_id()))',
      tenant_table || '_select_policy', tenant_table
    );
    execute format(
      'create policy %I on %I for all using (org_id = (select current_app_org_id()) and (select current_app_can_write())) with check (org_id = (select current_app_org_id()) and (select current_app_can_write()))',
      tenant_table || '_write_policy', tenant_table
    );
  end loop;
end
$$;

alter table organization_invites enable row level security;
alter table organization_invites force row level security;
create policy organization_invites_select_policy on organization_invites
for select using (
  org_id = (select current_app_org_id()) and (select current_app_can_administer())
);
create policy organization_invites_write_policy on organization_invites
for all using (
  org_id = (select current_app_org_id()) and current_app_role() = 'owner'
) with check (
  org_id = (select current_app_org_id()) and current_app_role() = 'owner'
);
create policy organization_invites_accept_lookup_policy on organization_invites
for select using (current_app_login_lookup());
create policy organization_invites_accept_update_policy on organization_invites
for update using (current_app_login_lookup()) with check (true);

alter table auth_refresh_tokens enable row level security;
alter table auth_refresh_tokens force row level security;
create policy auth_refresh_tokens_select_policy on auth_refresh_tokens
for select using (
  (org_id = (select current_app_org_id()) and (user_id = current_app_user_id() or current_app_can_administer()))
  or current_app_login_lookup()
);
create policy auth_refresh_tokens_insert_policy on auth_refresh_tokens
for insert with check (
  (org_id = (select current_app_org_id()) and user_id = current_app_user_id())
  or current_app_login_lookup()
);
create policy auth_refresh_tokens_update_policy on auth_refresh_tokens
for update using (
  (org_id = (select current_app_org_id()) and (user_id = current_app_user_id() or current_app_can_administer()))
  or current_app_login_lookup()
) with check (true);

alter table password_reset_tokens enable row level security;
alter table password_reset_tokens force row level security;
create policy password_reset_tokens_select_policy on password_reset_tokens
for select using (
  user_id = current_app_user_id() or current_app_login_lookup() or current_app_can_administer()
);
create policy password_reset_tokens_insert_policy on password_reset_tokens
for insert with check (
  user_id = current_app_user_id() or current_app_login_lookup() or current_app_can_administer()
);
create policy password_reset_tokens_update_policy on password_reset_tokens
for update using (
  user_id = current_app_user_id() or current_app_login_lookup() or current_app_can_administer()
) with check (true);

alter table user_totp_credentials enable row level security;
alter table user_totp_credentials force row level security;
create policy user_totp_credentials_select_policy on user_totp_credentials
for select using (
  user_id = current_app_user_id() or current_app_can_administer()
);
create policy user_totp_credentials_write_policy on user_totp_credentials
for all using (
  user_id = current_app_user_id() or current_app_can_administer()
) with check (
  user_id = current_app_user_id() or current_app_can_administer()
);
