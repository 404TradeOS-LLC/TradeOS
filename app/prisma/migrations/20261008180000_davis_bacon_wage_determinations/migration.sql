-- Davis-Bacon prevailing-wage determinations (SAM.gov key-free feed).
-- Public reference data, org-scoped like every other tenant table so the
-- established RLS policies apply. No backfill; rows are written by the
-- Davis-Bacon sync job only.

create table davis_bacon_determinations (
    id text primary key,
    org_id uuid not null references organizations (id) on delete cascade,
    wd_number text not null,
    revision_number integer not null,
    state text not null,
    state_name text,
    counties jsonb not null default '[]'::jsonb,
    construction_types jsonb not null default '[]'::jsonb,
    modified_date text,
    is_active boolean not null default true,
    source text not null default 'sam.gov',
    fetched_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (org_id, wd_number)
);

create index idx_davis_bacon_determinations_org_state
    on davis_bacon_determinations (org_id, state);

create table davis_bacon_rates (
    id text primary key,
    org_id uuid not null references organizations (id) on delete cascade,
    determination_id text not null references davis_bacon_determinations (id) on delete cascade,
    wd_number text not null,
    revision_number integer not null,
    rate_identifier text not null,
    identifier_date text,
    occupation text not null,
    base_rate numeric(12, 2) not null,
    rate_unit text not null default 'hour',
    fringe numeric(12, 2),
    fringe_expression text,
    created_at timestamptz not null default now()
);

create index idx_davis_bacon_rates_org_wd
    on davis_bacon_rates (org_id, wd_number);
create index idx_davis_bacon_rates_org_occupation
    on davis_bacon_rates (org_id, occupation);

-- Tenant RLS, same pattern as every other tenant table: org-scoped select,
-- org-scoped writes gated on the write capability.
alter table davis_bacon_determinations enable row level security;
alter table davis_bacon_determinations force row level security;
create policy davis_bacon_determinations_select_policy
    on davis_bacon_determinations for select
    using (org_id = (select current_app_org_id()));
create policy davis_bacon_determinations_write_policy
    on davis_bacon_determinations for all
    using (org_id = (select current_app_org_id()) and (select current_app_can_write()))
    with check (org_id = (select current_app_org_id()) and (select current_app_can_write()));

alter table davis_bacon_rates enable row level security;
alter table davis_bacon_rates force row level security;
create policy davis_bacon_rates_select_policy
    on davis_bacon_rates for select
    using (org_id = (select current_app_org_id()));
create policy davis_bacon_rates_write_policy
    on davis_bacon_rates for all
    using (org_id = (select current_app_org_id()) and (select current_app_can_write()))
    with check (org_id = (select current_app_org_id()) and (select current_app_can_write()));
