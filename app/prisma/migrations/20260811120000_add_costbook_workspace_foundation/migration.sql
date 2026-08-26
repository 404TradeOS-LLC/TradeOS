create table if not exists costbook_workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references organizations(id) on delete cascade,
  status text not null default 'foundation',
  setup_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint costbook_workspaces_status_check check (status in ('foundation', 'active', 'archived'))
);

create table if not exists costbook_workspace_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  costbook_workspace_id uuid not null references costbook_workspaces(id) on delete cascade,
  event_type text not null,
  actor_user_id uuid,
  actor_role text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint costbook_workspace_events_same_org_check check (
    organization_id is not null
  )
);

create index if not exists idx_costbook_workspace_events_org_created
  on costbook_workspace_events(organization_id, created_at desc);

create index if not exists idx_costbook_workspace_events_workspace_created
  on costbook_workspace_events(costbook_workspace_id, created_at desc);

create or replace function public.current_app_can_manage_costbook() returns boolean
language sql stable
set search_path = ''
as $function$
  select coalesce(public.current_app_role() in ('owner', 'admin'), false)
$function$;

create or replace function public.enforce_costbook_workspace_event_org()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  workspace_org uuid;
begin
  select organization_id
    into workspace_org
    from public.costbook_workspaces
   where id = new.costbook_workspace_id;

  if workspace_org is null then
    raise exception 'costbook workspace event references a missing workspace'
      using errcode = '23503';
  end if;

  if new.organization_id <> workspace_org then
    raise exception 'costbook workspace event organization must match workspace organization'
      using errcode = '23514';
  end if;

  return new;
end
$function$;

drop trigger if exists costbook_workspace_events_org_guard on public.costbook_workspace_events;
create trigger costbook_workspace_events_org_guard
before insert or update on public.costbook_workspace_events
for each row execute function public.enforce_costbook_workspace_event_org();

alter table costbook_workspaces enable row level security;
alter table costbook_workspaces force row level security;

create policy costbook_workspaces_select_policy on costbook_workspaces
for select using (
  organization_id = (select public.current_app_org_id())
);

create policy costbook_workspaces_write_policy on costbook_workspaces
for all using (
  organization_id = (select public.current_app_org_id())
  and (select public.current_app_can_manage_costbook())
) with check (
  organization_id = (select public.current_app_org_id())
  and (select public.current_app_can_manage_costbook())
);

alter table costbook_workspace_events enable row level security;
alter table costbook_workspace_events force row level security;

create policy costbook_workspace_events_select_policy on costbook_workspace_events
for select using (
  organization_id = (select public.current_app_org_id())
);

create policy costbook_workspace_events_insert_policy on costbook_workspace_events
for insert with check (
  organization_id = (select public.current_app_org_id())
  and (select public.current_app_can_manage_costbook())
);
