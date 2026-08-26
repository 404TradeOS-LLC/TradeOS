create table jobs (
  id                          uuid primary key default gen_random_uuid(),
  org_id                      uuid not null references organizations(id) on delete cascade,
  project_id                  uuid not null references projects(id) on delete cascade,
  customer_id                 uuid not null references customers(id) on delete cascade,
  service_address_id          uuid not null references service_addresses(id) on delete cascade,
  job_number                  text not null,
  title                       text not null,
  description                 text not null default '',
  job_type                    text not null,
  status                      text not null default 'unscheduled',
  priority                    text not null default 'medium',
  scheduled_start             timestamptz,
  scheduled_end               timestamptz,
  arrival_window_start        timestamptz,
  arrival_window_end          timestamptz,
  estimated_duration_minutes  integer,
  actual_start                timestamptz,
  actual_end                  timestamptz,
  completed_at                timestamptz,
  completed_by_id             uuid references users(id) on delete set null,
  ready_for_invoice_at        timestamptz,
  created_by_id               uuid not null references users(id) on delete restrict,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  archived_at                 timestamptz
);

create unique index idx_jobs_org_job_number on jobs(org_id, job_number);
create index idx_jobs_org_status on jobs(org_id, status);
create index idx_jobs_project on jobs(project_id);
create index idx_jobs_customer on jobs(customer_id);
create index idx_jobs_service_address on jobs(service_address_id);
create index idx_jobs_scheduled_start on jobs(scheduled_start);
create index idx_jobs_org_archived on jobs(org_id, archived_at);

create table job_assignments (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  job_id           uuid not null references jobs(id) on delete cascade,
  user_id          uuid not null references users(id) on delete restrict,
  assignment_role  text not null,
  is_lead          boolean not null default false,
  assigned_at      timestamptz not null default now(),
  assigned_by_id   uuid not null references users(id) on delete restrict,
  accepted_at      timestamptz,
  declined_at      timestamptz,
  removed_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_job_assignments_org_job on job_assignments(org_id, job_id);
create index idx_job_assignments_org_user_removed on job_assignments(org_id, user_id, removed_at);
create unique index idx_job_assignments_active_user on job_assignments(job_id, user_id) where removed_at is null;
create unique index idx_job_assignments_active_lead on job_assignments(job_id) where removed_at is null and is_lead = true;

create table job_equipment (
  job_id        uuid not null references jobs(id) on delete cascade,
  equipment_id  uuid not null references customer_equipment(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (job_id, equipment_id)
);

create index idx_job_equipment_equipment on job_equipment(equipment_id);

alter table project_tasks add column if not exists job_id uuid references jobs(id) on delete set null;
create index if not exists idx_project_tasks_job_status on project_tasks(job_id, status);

alter table site_visits add column if not exists job_id uuid references jobs(id) on delete set null;
create index if not exists idx_site_visits_job_created on site_visits(job_id, created_at desc);

alter table jobs enable row level security;
alter table jobs force row level security;

create policy jobs_select_policy on jobs
for select using (
  org_id = (select current_app_org_id())
  and (
    current_app_can_administer()
    or exists (
      select 1
      from job_assignments
      where job_assignments.job_id = jobs.id
        and job_assignments.user_id = current_app_user_id()
        and job_assignments.removed_at is null
    )
  )
);

create policy jobs_insert_policy on jobs
for insert with check (
  org_id = (select current_app_org_id())
  and current_app_role() in ('owner', 'admin', 'dispatcher')
);

create policy jobs_update_policy on jobs
for update using (
  org_id = (select current_app_org_id())
  and (
    current_app_can_administer()
    or exists (
      select 1
      from job_assignments
      where job_assignments.job_id = jobs.id
        and job_assignments.user_id = current_app_user_id()
        and job_assignments.removed_at is null
    )
  )
) with check (
  org_id = (select current_app_org_id())
  and (
    current_app_can_administer()
    or exists (
      select 1
      from job_assignments
      where job_assignments.job_id = jobs.id
        and job_assignments.user_id = current_app_user_id()
        and job_assignments.removed_at is null
    )
  )
);

alter table job_assignments enable row level security;
alter table job_assignments force row level security;

create policy job_assignments_select_policy on job_assignments
for select using (
  org_id = (select current_app_org_id())
  and (
    current_app_can_administer()
    or user_id = current_app_user_id()
  )
);

create policy job_assignments_insert_policy on job_assignments
for insert with check (
  org_id = (select current_app_org_id())
  and current_app_role() in ('owner', 'admin', 'dispatcher')
);

create policy job_assignments_update_policy on job_assignments
for update using (
  org_id = (select current_app_org_id())
  and (
    current_app_can_administer()
    or user_id = current_app_user_id()
  )
) with check (
  org_id = (select current_app_org_id())
  and (
    current_app_can_administer()
    or user_id = current_app_user_id()
  )
);

alter table job_equipment enable row level security;
alter table job_equipment force row level security;

create policy job_equipment_select_policy on job_equipment
for select using (
  exists (
    select 1
    from jobs
    where jobs.id = job_equipment.job_id
      and jobs.org_id = (select current_app_org_id())
      and (
        current_app_can_administer()
        or exists (
          select 1
          from job_assignments
          where job_assignments.job_id = jobs.id
            and job_assignments.user_id = current_app_user_id()
            and job_assignments.removed_at is null
        )
      )
  )
);

create policy job_equipment_write_policy on job_equipment
for all using (
  current_app_role() in ('owner', 'admin', 'dispatcher')
  and exists (
    select 1
    from jobs
    where jobs.id = job_equipment.job_id
      and jobs.org_id = (select current_app_org_id())
  )
) with check (
  current_app_role() in ('owner', 'admin', 'dispatcher')
  and exists (
    select 1
    from jobs
    where jobs.id = job_equipment.job_id
      and jobs.org_id = (select current_app_org_id())
  )
);
