create table if not exists brand_profiles (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null unique references organizations(id) on delete cascade,
  company_display_name    text,
  tagline                 text,
  primary_color           text,
  secondary_color         text,
  accent_color            text,
  logo_url                text,
  logo_dark_url           text,
  logo_light_url          text,
  icon_url                text,
  watermark_url           text,
  cover_image_url         text,
  default_document_theme  text,
  proposal_style          text,
  invoice_style           text,
  contract_style          text,
  email_signature         text,
  website_url             text,
  phone                   text,
  email                   text,
  address_line_1          text,
  address_line_2          text,
  city                    text,
  state                   text,
  postal_code             text,
  license_number          text,
  insurance_summary       text,
  bonding_summary         text,
  years_in_business       integer,
  service_areas_json      jsonb,
  certifications_json     jsonb,
  social_links_json       jsonb,
  review_links_json       jsonb,
  financing_links_json    jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table if not exists brand_assets (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  brand_profile_id uuid not null references brand_profiles(id) on delete cascade,
  type             text not null,
  label            text,
  url              text not null,
  mime_type        text,
  size_bytes       integer,
  width            integer,
  height           integer,
  created_at       timestamptz not null default now()
);

create table if not exists brand_document_settings (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null unique references organizations(id) on delete cascade,
  brand_profile_id         uuid not null unique references brand_profiles(id) on delete cascade,
  show_powered_by_tradeos  boolean not null default false,
  show_license_number      boolean not null default true,
  show_insurance_summary   boolean not null default true,
  show_google_rating       boolean not null default false,
  show_social_links        boolean not null default true,
  default_cover_mode       text,
  default_header_style     text,
  default_footer_style     text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_brand_assets_org_type on brand_assets(organization_id, type);
create index if not exists idx_brand_assets_profile on brand_assets(brand_profile_id);

alter table brand_profiles enable row level security;
alter table brand_profiles force row level security;
create policy brand_profiles_select_policy on brand_profiles
for select using (
  organization_id = (select current_app_org_id())
);
create policy brand_profiles_write_policy on brand_profiles
for all using (
  organization_id = (select current_app_org_id()) and (select current_app_can_administer())
) with check (
  organization_id = (select current_app_org_id()) and (select current_app_can_administer())
);

alter table brand_assets enable row level security;
alter table brand_assets force row level security;
create policy brand_assets_select_policy on brand_assets
for select using (
  organization_id = (select current_app_org_id())
);
create policy brand_assets_write_policy on brand_assets
for all using (
  organization_id = (select current_app_org_id()) and (select current_app_can_administer())
) with check (
  organization_id = (select current_app_org_id()) and (select current_app_can_administer())
);

alter table brand_document_settings enable row level security;
alter table brand_document_settings force row level security;
create policy brand_document_settings_select_policy on brand_document_settings
for select using (
  organization_id = (select current_app_org_id())
);
create policy brand_document_settings_write_policy on brand_document_settings
for all using (
  organization_id = (select current_app_org_id()) and (select current_app_can_administer())
) with check (
  organization_id = (select current_app_org_id()) and (select current_app_can_administer())
);
