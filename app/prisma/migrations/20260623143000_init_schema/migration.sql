-- TradeOS Cost Book — Initial Schema
-- Postgres / Supabase conventions: uuid PKs, timestamptz audit columns, RLS-ready (owner/org scoping columns included but RLS policies are Phase 2).
-- This migration is part of the planning scaffold only. Do not apply to a live project without review.

create extension if not exists "pgcrypto";

-- ============================================================
-- ORGANIZATIONS / USERS (minimal — full auth model is Phase 2)
-- ============================================================

create table organizations (
    id              uuid primary key default gen_random_uuid(),
    name            text not null,
    region_code     text,                       -- default region for pricing adjustments
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create table users (
    id              uuid primary key default gen_random_uuid(),
    auth_subject    text not null unique,
    email           text not null unique,
    full_name       text,
    is_active       boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create table organization_memberships (
    id              uuid primary key default gen_random_uuid(),
    org_id          uuid not null references organizations(id) on delete cascade,
    user_id         uuid not null references users(id) on delete cascade,
    role            text not null default 'owner',  -- owner | admin | estimator | viewer
    status          text not null default 'active',  -- active | invited | disabled
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (org_id, user_id)
);
create index idx_organization_memberships_user on organization_memberships(user_id);

create table organization_membership_audits (
    id              uuid primary key default gen_random_uuid(),
    org_id          uuid not null references organizations(id) on delete cascade,
    membership_id   uuid not null,
    user_id         uuid not null,
    action          text not null,                   -- created | updated | disabled
    actor_user_id   uuid,
    actor_role      text,
    before_state    jsonb,
    after_state     jsonb,
    created_at      timestamptz not null default now()
);
create index idx_org_membership_audits_org_membership_created on organization_membership_audits(org_id, membership_id, created_at desc);
create index idx_org_membership_audits_user_created on organization_membership_audits(user_id, created_at desc);

-- RLS foundation: these helper functions are intended to back future
-- row-level security policies once the app starts setting session variables
-- per request (for example via `SET LOCAL app.user_id` and `app.org_id`).
create or replace function current_app_user_id() returns uuid
language sql stable
as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

create or replace function current_app_org_id() returns uuid
language sql stable
as $$
  select nullif(current_setting('app.org_id', true), '')::uuid
$$;

-- ============================================================
-- COST BOOK HIERARCHY
-- ============================================================

create table divisions (
    id              uuid primary key default gen_random_uuid(),
    org_id          uuid references organizations(id) on delete cascade,
    code            text not null,               -- e.g. "02" (Sitework)
    name            text not null,
    sort_order      integer not null default 0,
    created_at      timestamptz not null default now(),
    unique (org_id, code)
);

create table categories (
    id              uuid primary key default gen_random_uuid(),
    division_id     uuid not null references divisions(id) on delete cascade,
    code            text not null,               -- e.g. "02-200" (Excavation)
    name            text not null,
    sort_order      integer not null default 0,
    created_at      timestamptz not null default now(),
    unique (division_id, code)
);

create table subcategories (
    id              uuid primary key default gen_random_uuid(),
    category_id     uuid not null references categories(id) on delete cascade,
    code            text not null,               -- e.g. "02-200-10" (Residential Excavation)
    name            text not null,
    sort_order      integer not null default 0,
    created_at      timestamptz not null default now(),
    unique (category_id, code)
);

-- ============================================================
-- REGIONS / PRICE ADJUSTMENTS
-- ============================================================

create table regions (
    id              uuid primary key default gen_random_uuid(),
    org_id          uuid references organizations(id) on delete cascade,
    code            text not null,               -- e.g. "US-TX-AUSTIN"
    name            text not null,
    labor_index     numeric(6,4) not null default 1.0000,   -- multiplier vs base rate
    material_index  numeric(6,4) not null default 1.0000,
    created_at      timestamptz not null default now(),
    unique (org_id, code)
);

-- ============================================================
-- MATERIALS
-- ============================================================

create table suppliers (
    id              uuid primary key default gen_random_uuid(),
    org_id          uuid references organizations(id) on delete cascade,
    name            text not null,
    contact_email   text,
    contact_phone   text,
    website         text,
    api_integration_key text,                     -- placeholder for Phase 2+ supplier feeds
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create table materials (
    id              uuid primary key default gen_random_uuid(),
    org_id          uuid references organizations(id) on delete cascade,
    sku             text,
    name            text not null,
    unit_of_measure text not null,                 -- e.g. "SF", "CY", "EA", "LF"
    unit_cost       numeric(12,4) not null,
    waste_factor_pct numeric(5,2) not null default 0,   -- e.g. 10.00 = 10%
    supplier_id     uuid references suppliers(id) on delete set null,
    last_price_update timestamptz,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index idx_materials_org on materials(org_id);
create index idx_materials_supplier on materials(supplier_id);

create table material_price_audits (
    id              uuid primary key default gen_random_uuid(),
    org_id          uuid not null references organizations(id) on delete cascade,
    material_id     uuid not null references materials(id) on delete restrict,
    material_name   text not null,
    old_unit_cost   numeric(12,4) not null,
    new_unit_cost   numeric(12,4) not null,
    source          text not null default 'manual',
    actor_user_id   uuid,
    actor_role      text,
    created_at      timestamptz not null default now()
);
create index idx_material_price_audits_org_created on material_price_audits(org_id, created_at desc);
create index idx_material_price_audits_material_created on material_price_audits(material_id, created_at desc);

-- Queued-review staging area for supplier-fed price proposals. A sync job
-- (run through runWithBackgroundDatabaseSession) enqueues rows here instead
-- of writing straight to materials, so a human approves/rejects before any
-- price actually changes. Approval writes the same material_price_audits
-- trail a manual edit would.
create table supplier_price_updates (
    id                  uuid primary key default gen_random_uuid(),
    org_id              uuid not null references organizations(id) on delete cascade,
    supplier_id         uuid not null references suppliers(id) on delete restrict,
    material_id         uuid not null references materials(id) on delete restrict,
    current_unit_cost   numeric(12,4) not null,
    proposed_unit_cost  numeric(12,4) not null,
    status              text not null default 'pending'
                        check (status in ('pending', 'approved', 'rejected')),
    source              text not null default 'supplier-feed',
    requested_by_job    text,
    reviewed_by_user_id uuid references users(id) on delete set null,
    reviewed_at         timestamptz,
    created_at          timestamptz not null default now()
);
create index idx_supplier_price_updates_org_status_created on supplier_price_updates(org_id, status, created_at desc);
create index idx_supplier_price_updates_material on supplier_price_updates(material_id);
create index idx_supplier_price_updates_supplier on supplier_price_updates(supplier_id);

-- ============================================================
-- LABOR
-- ============================================================

create table labor_rates (
    id              uuid primary key default gen_random_uuid(),
    org_id          uuid references organizations(id) on delete cascade,
    trade           text not null,                 -- e.g. "Carpenter", "Laborer", "Operator"
    base_hourly_rate numeric(10,2) not null,
    burden_pct      numeric(5,2) not null default 0,  -- taxes/insurance/benefits as % of base rate
    region_id       uuid references regions(id) on delete set null,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index idx_labor_rates_org on labor_rates(org_id);

-- ============================================================
-- EQUIPMENT
-- ============================================================

create table equipment (
    id              uuid primary key default gen_random_uuid(),
    org_id          uuid references organizations(id) on delete cascade,
    name            text not null,                 -- e.g. "Mini Excavator, 5T"
    ownership_cost_per_hour numeric(10,2) not null default 0,  -- depreciation, interest, insurance, storage
    operating_cost_per_hour numeric(10,2) not null default 0,  -- fuel, maintenance, consumables
    daily_rate      numeric(10,2),                  -- optional flat daily alternative
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index idx_equipment_org on equipment(org_id);

-- ============================================================
-- SUBCONTRACTORS
-- ============================================================

create table subcontractors (
    id              uuid primary key default gen_random_uuid(),
    org_id          uuid references organizations(id) on delete cascade,
    name            text not null,
    trade           text,
    contact_email   text,
    contact_phone   text,
    default_markup_pct numeric(5,2) not null default 0,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- ============================================================
-- COST ITEMS (the atomic priced unit, references labor/material/equipment as a blend)
-- ============================================================

create table cost_items (
    id              uuid primary key default gen_random_uuid(),
    org_id          uuid references organizations(id) on delete cascade,
    subcategory_id  uuid not null references subcategories(id) on delete cascade,
    code            text not null,                  -- e.g. "02-200-10-001"
    name            text not null,                  -- e.g. "Excavation Per Cubic Yard"
    unit_of_measure text not null,
    production_rate numeric(12,4),                  -- units per labor-hour (nullable if pure material/equipment item)
    labor_rate_id   uuid references labor_rates(id) on delete set null,
    material_id     uuid references materials(id) on delete set null,
    equipment_id    uuid references equipment(id) on delete set null,
    subcontractor_id uuid references subcontractors(id) on delete set null,
    notes           text,
    is_active       boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (org_id, code)
);
create index idx_cost_items_subcategory on cost_items(subcategory_id);
create index idx_cost_items_org on cost_items(org_id);

-- ============================================================
-- ASSEMBLIES (composed of multiple cost items, not duplicated pricing)
-- ============================================================

create table assemblies (
    id              uuid primary key default gen_random_uuid(),
    org_id          uuid references organizations(id) on delete cascade,
    code            text not null,                  -- e.g. "ASM-DECK-COMPOSITE-12X16"
    name            text not null,                  -- e.g. "Composite Deck, 12x16, Standard"
    unit_of_measure text not null,                  -- e.g. "EA", "SF"
    description     text,
    is_active       boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (org_id, code)
);

create table assembly_items (
    id              uuid primary key default gen_random_uuid(),
    assembly_id     uuid not null references assemblies(id) on delete cascade,
    cost_item_id    uuid references cost_items(id) on delete cascade,
    child_assembly_id uuid references assemblies(id) on delete cascade,  -- supports nested assemblies
    quantity_per_unit numeric(12,4) not null,        -- quantity of cost_item/child_assembly per 1 unit of parent assembly
    sort_order      integer not null default 0,
    check (
        (cost_item_id is not null and child_assembly_id is null)
        or (cost_item_id is null and child_assembly_id is not null)
    )
);
create index idx_assembly_items_assembly on assembly_items(assembly_id);

-- ============================================================
-- CUSTOMERS / PROJECTS
-- ============================================================

create table customers (
    id              uuid primary key default gen_random_uuid(),
    org_id          uuid references organizations(id) on delete cascade,
    name            text not null,
    email           text,
    phone           text,
    billing_address text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create table projects (
    id              uuid primary key default gen_random_uuid(),
    org_id          uuid references organizations(id) on delete cascade,
    customer_id     uuid references customers(id) on delete set null,
    name            text not null,
    site_address    text,
    region_id       uuid references regions(id) on delete set null,
    status          text not null default 'lead',    -- lead | estimating | proposed | won | lost | active | complete
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index idx_projects_org on projects(org_id);
create index idx_projects_customer on projects(customer_id);

-- ============================================================
-- ESTIMATES
-- ============================================================

create table estimates (
    id              uuid primary key default gen_random_uuid(),
    org_id          uuid references organizations(id) on delete cascade,
    project_id      uuid not null references projects(id) on delete cascade,
    version         integer not null default 1,
    status          text not null default 'draft',   -- draft | sent | approved | rejected | superseded
    overhead_pct    numeric(5,2) not null default 0,
    profit_pct      numeric(5,2) not null default 0,
    target_margin_pct numeric(5,2),                   -- optional, for target-margin pricing mode
    subtotal_cost   numeric(14,2) not null default 0,  -- computed: sum of line item costs
    total_price     numeric(14,2) not null default 0,  -- computed: subtotal + overhead + profit
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index idx_estimates_project on estimates(project_id);

create table estimate_line_items (
    id              uuid primary key default gen_random_uuid(),
    estimate_id     uuid not null references estimates(id) on delete cascade,
    cost_item_id    uuid references cost_items(id) on delete set null,
    assembly_id     uuid references assemblies(id) on delete set null,
    description     text not null,
    quantity        numeric(12,4) not null,
    unit_of_measure text not null,
    unit_cost       numeric(12,4) not null,            -- snapshot of computed unit cost at time of estimate
    line_cost       numeric(14,2) not null,             -- quantity * unit_cost
    sort_order      integer not null default 0,
    created_at      timestamptz not null default now(),
    check (
        (cost_item_id is not null and assembly_id is null)
        or (cost_item_id is null and assembly_id is not null)
    )
);
create index idx_line_items_estimate on estimate_line_items(estimate_id);

-- ============================================================
-- CHANGE ORDERS
-- ============================================================

create table change_orders (
    id              uuid primary key default gen_random_uuid(),
    project_id      uuid not null references projects(id) on delete cascade,
    estimate_id     uuid references estimates(id) on delete set null,   -- originating estimate, if any
    co_number       integer not null,
    description     text not null,
    status          text not null default 'draft',     -- draft | sent | approved | rejected
    amount          numeric(14,2) not null default 0,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (project_id, co_number)
);

create table change_order_line_items (
    id              uuid primary key default gen_random_uuid(),
    change_order_id uuid not null references change_orders(id) on delete cascade,
    cost_item_id    uuid references cost_items(id) on delete set null,
    description     text not null,
    quantity        numeric(12,4) not null,
    unit_cost       numeric(12,4) not null,
    line_cost       numeric(14,2) not null,
    sort_order      integer not null default 0
);
create index idx_co_line_items_co on change_order_line_items(change_order_id);
