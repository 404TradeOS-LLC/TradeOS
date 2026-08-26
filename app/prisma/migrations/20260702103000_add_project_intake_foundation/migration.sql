alter table organizations
  add column if not exists logo_url text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists address text,
  add column if not exists default_labor_rate numeric(10,2),
  add column if not exists default_markup_percent numeric(5,2);

alter table customers
  add column if not exists address text,
  add column if not exists notes text;

alter table projects
  add column if not exists job_type text,
  add column if not exists simple_scope text;

alter table proposals
  alter column estimate_id drop not null;

alter table proposals
  add column if not exists scope_of_work text,
  add column if not exists assumptions text,
  add column if not exists exclusions text,
  add column if not exists timeline text,
  add column if not exists price_low numeric(14,2),
  add column if not exists price_high numeric(14,2),
  add column if not exists final_price numeric(14,2),
  add column if not exists payment_schedule_json jsonb,
  add column if not exists pdf_url text;

alter table proposals
  drop constraint if exists proposals_estimate_id_fkey;

alter table proposals
  add constraint proposals_estimate_id_fkey
  foreign key (estimate_id) references estimates(id) on delete set null;

create table if not exists site_visits (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects(id) on delete cascade,
  transcript        text,
  notes             text,
  measurements_json jsonb,
  ai_questions_json jsonb,
  missing_info_json jsonb,
  confidence_score  numeric(5,2),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_site_visits_project_created on site_visits(project_id, created_at desc);

create table if not exists project_files (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  file_type    text not null,
  file_url     text not null,
  file_name    text not null,
  storage_path text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_project_files_project_type on project_files(project_id, file_type);

alter table site_visits enable row level security;
alter table site_visits force row level security;
create policy site_visits_select_policy on site_visits for select using (
  exists (select 1 from projects where projects.id = site_visits.project_id)
);
create policy site_visits_write_policy on site_visits for all using (
  current_app_can_write() and exists (select 1 from projects where projects.id = site_visits.project_id)
) with check (
  current_app_can_write() and exists (select 1 from projects where projects.id = site_visits.project_id)
);

alter table project_files enable row level security;
alter table project_files force row level security;
create policy project_files_select_policy on project_files for select using (
  exists (select 1 from projects where projects.id = project_files.project_id)
);
create policy project_files_write_policy on project_files for all using (
  current_app_can_write() and exists (select 1 from projects where projects.id = project_files.project_id)
) with check (
  current_app_can_write() and exists (select 1 from projects where projects.id = project_files.project_id)
);
