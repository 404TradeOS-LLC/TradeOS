-- Additive only. Legacy display names never grant personal task access.
alter table public.project_tasks add column assigned_user_id uuid references public.users(id) on delete set null;
create index idx_project_tasks_assigned_user_status_due on public.project_tasks(assigned_user_id, status, due_date);

-- The historical generic write helper includes technicians. Exclude them
-- from this table's broad office policy before adding the narrow path.
alter policy project_tasks_write_policy on public.project_tasks using (
  current_app_can_write() and current_app_role() <> 'technician'
  and exists (select 1 from projects p where p.id = project_tasks.project_id)
) with check (
  current_app_can_write() and current_app_role() <> 'technician'
  and exists (select 1 from projects p where p.id = project_tasks.project_id)
);

create policy project_tasks_assigned_technician_update on public.project_tasks
for update using (
  current_app_role() = 'technician'
  and assigned_user_id = current_app_user_id()
  and exists (select 1 from organization_memberships m join users u on u.id = m.user_id where m.org_id = current_app_org_id() and m.user_id = current_app_user_id() and m.status = 'active' and m.role = 'technician' and u.is_active)
  and exists (select 1 from projects p where p.id = project_tasks.project_id and p.org_id = current_app_org_id())
  and exists (select 1 from jobs j join job_assignments a on a.job_id = j.id
    where j.id = project_tasks.job_id and j.org_id = current_app_org_id()
      and j.archived_at is null and j.status not in ('completed', 'cancelled')
      and a.org_id = current_app_org_id() and a.user_id = current_app_user_id()
      and a.removed_at is null and a.declined_at is null)
) with check (
  current_app_role() = 'technician' and assigned_user_id = current_app_user_id()
  and exists (select 1 from organization_memberships m join users u on u.id = m.user_id where m.org_id = current_app_org_id() and m.user_id = current_app_user_id() and m.status = 'active' and m.role = 'technician' and u.is_active)
  and exists (select 1 from projects p where p.id = project_tasks.project_id and p.org_id = current_app_org_id())
  and exists (select 1 from jobs j join job_assignments a on a.job_id = j.id
    where j.id = project_tasks.job_id and j.org_id = current_app_org_id()
      and j.archived_at is null and j.status not in ('completed', 'cancelled')
      and a.org_id = current_app_org_id() and a.user_id = current_app_user_id()
      and a.removed_at is null and a.declined_at is null)
);

-- RLS constrains rows; this trigger constrains technician-writable columns.
create function public.guard_field_task_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.current_app_role() = 'technician' and
    (to_jsonb(new) - array['status', 'completed_at', 'updated_at']) is distinct from
    (to_jsonb(old) - array['status', 'completed_at', 'updated_at']) then
    raise exception 'Technicians may update task status only' using errcode = '42501';
  end if;
  if public.current_app_role() = 'technician' then
    new.updated_at := greatest(old.updated_at + interval '1 millisecond', date_trunc('milliseconds', clock_timestamp()));
    new.completed_at := case when new.status = 'completed' then coalesce(old.completed_at, date_trunc('milliseconds', clock_timestamp())) else null end;
  end if;
  return new;
end;
$$;
create trigger guard_field_task_update before update on public.project_tasks
for each row execute function public.guard_field_task_update();
