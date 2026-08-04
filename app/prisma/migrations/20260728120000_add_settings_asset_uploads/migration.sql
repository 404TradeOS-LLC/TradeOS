-- Persists Settings Console brand asset storage metadata (bucket/path/content
-- type/size), replacing the earlier design where the display URL alone was
-- trusted as the asset's identity. This table lives in the application's own
-- Postgres schema (Prisma-managed, forced RLS) -- it is unrelated to Supabase
-- Storage's own storage.objects/storage.buckets tables, which carry no
-- per-row RLS policies under the revised architecture (see accompanying
-- application-code proposal): all Storage reads/writes go through a
-- server-only service_role client that bypasses Storage RLS entirely, so
-- authorization for these uploads is enforced here and at the application
-- layer, not by Storage-level policies.
create table if not exists settings_asset_uploads (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  asset_key      text not null,
  storage_bucket text not null,
  storage_path   text not null,
  content_type   text not null,
  size_bytes     integer not null,
  uploaded_by    uuid references users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint settings_asset_uploads_asset_key_check
    check (asset_key in ('logoUrl', 'darkLogoUrl', 'iconUrl', 'watermarkUrl')),
  constraint settings_asset_uploads_org_asset_key_unique
    unique (org_id, asset_key)
);

create index if not exists idx_settings_asset_uploads_org_id on settings_asset_uploads(org_id);

alter table settings_asset_uploads enable row level security;
alter table settings_asset_uploads force row level security;

-- Any org member may read (matches organization_settings' own select policy --
-- the Settings Console page itself is readable by any authenticated member).
create policy settings_asset_uploads_select_policy on settings_asset_uploads
for select using (
  org_id = (select current_app_org_id())
);

-- Only admin-equivalent roles may write, matching requireOrgAdmin's
-- team.manage/company.manage/settings.manage permission set at the
-- application layer, and organization_settings'/brand_profiles' own
-- current_app_can_administer()-gated write policy at this layer.
create policy settings_asset_uploads_write_policy on settings_asset_uploads
for all using (
  org_id = (select current_app_org_id()) and (select current_app_can_administer())
) with check (
  org_id = (select current_app_org_id()) and (select current_app_can_administer())
);
