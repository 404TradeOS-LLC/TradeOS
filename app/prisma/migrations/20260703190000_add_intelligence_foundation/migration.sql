create table if not exists activity_events (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  entity_type    text not null,
  entity_id      uuid not null,
  event_type     text not null,
  title          text not null,
  description    text,
  actor_user_id  uuid references users(id) on delete set null,
  metadata_json  jsonb,
  occurred_at    timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
create index if not exists idx_activity_events_entity on activity_events(org_id, entity_type, entity_id, occurred_at desc);
create index if not exists idx_activity_events_type on activity_events(org_id, event_type, occurred_at desc);

create table if not exists notifications (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organizations(id) on delete cascade,
  entity_type        text not null,
  entity_id          uuid not null,
  category           text not null,
  title              text not null,
  body               text not null,
  priority           text not null default 'medium',
  action_url         text,
  activity_event_id  uuid references activity_events(id) on delete set null,
  created_by_user_id uuid references users(id) on delete set null,
  read_at            timestamptz,
  archived_at        timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists idx_notifications_state on notifications(org_id, read_at, archived_at, created_at desc);
create index if not exists idx_notifications_entity on notifications(org_id, entity_type, entity_id);

create table if not exists attachments (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations(id) on delete cascade,
  entity_type         text not null,
  entity_id           uuid not null,
  kind                text not null,
  file_name           text not null,
  mime_type           text,
  file_url            text not null,
  preview_url         text,
  storage_path        text,
  size_bytes          integer,
  duration_seconds    integer,
  metadata_json       jsonb,
  uploaded_by_user_id uuid references users(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index if not exists idx_attachments_entity on attachments(org_id, entity_type, entity_id, created_at desc);
create index if not exists idx_attachments_kind on attachments(org_id, kind, created_at desc);

create table if not exists comments (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organizations(id) on delete cascade,
  entity_type        text not null,
  entity_id          uuid not null,
  parent_comment_id  uuid references comments(id) on delete set null,
  body               text not null,
  author_user_id     uuid references users(id) on delete set null,
  mentions_json      jsonb,
  reactions_json     jsonb,
  resolved_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_comments_entity on comments(org_id, entity_type, entity_id, created_at asc);
create index if not exists idx_comments_parent on comments(org_id, parent_comment_id);

create table if not exists tags (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  name         text not null,
  slug         text not null,
  color        text,
  description  text,
  created_at   timestamptz not null default now(),
  unique(org_id, slug)
);
create index if not exists idx_tags_name on tags(org_id, name);

create table if not exists tag_assignments (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations(id) on delete cascade,
  tag_id              uuid not null references tags(id) on delete cascade,
  entity_type         text not null,
  entity_id           uuid not null,
  assigned_by_user_id uuid references users(id) on delete set null,
  created_at          timestamptz not null default now(),
  unique(org_id, tag_id, entity_type, entity_id)
);
create index if not exists idx_tag_assignments_entity on tag_assignments(org_id, entity_type, entity_id);

create table if not exists saved_views (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organizations(id) on delete cascade,
  entity_type        text not null,
  name               text not null,
  description        text,
  filter_json        jsonb not null,
  sort_json          jsonb,
  is_shared          boolean not null default false,
  created_by_user_id uuid references users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_saved_views_entity on saved_views(org_id, entity_type, updated_at desc);

create table if not exists recent_items (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  user_id        uuid not null references users(id) on delete cascade,
  entity_type    text not null,
  entity_id      uuid not null,
  title          text not null,
  subtitle       text,
  href           text not null,
  keywords_json  jsonb,
  metadata_json  jsonb,
  updated_at_iso text,
  last_viewed_at timestamptz not null default now(),
  view_count     integer not null default 1,
  unique(org_id, user_id, entity_type, entity_id)
);
create index if not exists idx_recent_items_user on recent_items(org_id, user_id, last_viewed_at desc);

create table if not exists feature_flags (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  key           text not null,
  description   text,
  enabled       boolean not null default false,
  scope_type    text not null default 'org',
  scope_key     text,
  metadata_json jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(org_id, key, scope_type, scope_key)
);
create index if not exists idx_feature_flags_key on feature_flags(org_id, key);

do $$
declare
  tenant_table text;
begin
  foreach tenant_table in array array[
    'activity_events',
    'notifications',
    'attachments',
    'comments',
    'tags',
    'tag_assignments',
    'saved_views',
    'recent_items',
    'feature_flags'
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
