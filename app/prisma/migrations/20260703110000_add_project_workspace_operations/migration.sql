alter table change_orders
  add column if not exists schedule_impact_days integer,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_at timestamptz;

alter table site_visits
  add column if not exists details_json jsonb;

create table if not exists project_tasks (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  title        text not null,
  status       text not null default 'todo' check (status in ('todo', 'in_progress', 'blocked', 'completed')),
  assigned_to  text,
  due_date     timestamptz,
  priority     text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  notes        text,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_project_tasks_project_status on project_tasks(project_id, status);
create index if not exists idx_project_tasks_project_due_date on project_tasks(project_id, due_date);

alter table project_tasks enable row level security;
alter table project_tasks force row level security;
create policy project_tasks_select_policy on project_tasks for select using (
  exists (select 1 from projects where projects.id = project_tasks.project_id)
);
create policy project_tasks_write_policy on project_tasks for all using (
  current_app_can_write() and exists (select 1 from projects where projects.id = project_tasks.project_id)
) with check (
  current_app_can_write() and exists (select 1 from projects where projects.id = project_tasks.project_id)
);
