create table proposals (
    id                    uuid primary key default gen_random_uuid(),
    project_id            uuid not null references projects(id) on delete cascade,
    estimate_id           uuid not null references estimates(id) on delete cascade,
    status                text not null default 'draft'
                          check (status in ('draft', 'sent', 'viewed', 'accepted', 'rejected')),
    company_name          text,
    show_line_item_detail boolean not null default false,
    terms_and_conditions  text,
    sent_at               timestamptz,
    viewed_at             timestamptz,
    responded_at          timestamptz,
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now()
);
create index idx_proposals_project on proposals(project_id);
create index idx_proposals_estimate on proposals(estimate_id);

create table invoices (
    id               uuid primary key default gen_random_uuid(),
    project_id       uuid not null references projects(id) on delete cascade,
    estimate_id      uuid references estimates(id) on delete set null,
    proposal_id      uuid references proposals(id) on delete set null,
    invoice_number   integer not null,
    type             text not null default 'full'
                     check (type in ('full', 'progress')),
    status           text not null default 'draft'
                     check (status in ('draft', 'sent', 'paid', 'overdue', 'void')),
    percent_complete numeric(5,2),
    amount           numeric(14,2) not null default 0,
    due_date         timestamptz,
    sent_at          timestamptz,
    paid_at          timestamptz,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    unique (project_id, invoice_number)
);
create index idx_invoices_estimate on invoices(estimate_id);
create index idx_invoices_proposal on invoices(proposal_id);

create table invoice_line_items (
    id              uuid primary key default gen_random_uuid(),
    invoice_id      uuid not null references invoices(id) on delete cascade,
    description     text not null,
    quantity        numeric(12,4) not null,
    unit_of_measure text not null,
    unit_cost       numeric(12,4) not null,
    line_cost       numeric(14,2) not null,
    sort_order      integer not null default 0,
    created_at      timestamptz not null default now()
);
create index idx_invoice_line_items_invoice on invoice_line_items(invoice_id);

create table contracts (
    id                 uuid primary key default gen_random_uuid(),
    project_id         uuid not null references projects(id) on delete cascade,
    proposal_id        uuid not null references proposals(id) on delete cascade,
    status             text not null default 'pending_signature'
                       check (status in ('pending_signature', 'signed', 'voided')),
    terms_text         text not null,
    signer_name        text,
    signer_email       text,
    signature_data_url text,
    signature_ip       text,
    signed_at          timestamptz,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);
create index idx_contracts_project on contracts(project_id);
create index idx_contracts_proposal on contracts(proposal_id);

-- RLS: these tables have no direct org_id column, so scope is inherited via
-- the projects join, matching the change_orders pattern exactly. Visibility
-- of the joined project row is already org-restricted by projects' own RLS,
-- so the EXISTS subquery implicitly enforces tenant isolation.

alter table proposals enable row level security;
alter table proposals force row level security;
create policy proposals_select_policy on proposals for select using (
  exists (select 1 from projects where projects.id = proposals.project_id)
);
create policy proposals_write_policy on proposals for all using (
  current_app_can_write() and exists (select 1 from projects where projects.id = proposals.project_id)
) with check (
  current_app_can_write() and exists (select 1 from projects where projects.id = proposals.project_id)
);

alter table invoices enable row level security;
alter table invoices force row level security;
create policy invoices_select_policy on invoices for select using (
  exists (select 1 from projects where projects.id = invoices.project_id)
);
create policy invoices_write_policy on invoices for all using (
  current_app_can_write() and exists (select 1 from projects where projects.id = invoices.project_id)
) with check (
  current_app_can_write() and exists (select 1 from projects where projects.id = invoices.project_id)
);

alter table invoice_line_items enable row level security;
alter table invoice_line_items force row level security;
create policy invoice_line_items_select_policy on invoice_line_items for select using (
  exists (
    select 1 from invoices
    join projects on projects.id = invoices.project_id
    where invoices.id = invoice_line_items.invoice_id
  )
);
create policy invoice_line_items_write_policy on invoice_line_items for all using (
  current_app_can_write() and exists (
    select 1 from invoices
    join projects on projects.id = invoices.project_id
    where invoices.id = invoice_line_items.invoice_id
  )
) with check (
  current_app_can_write() and exists (
    select 1 from invoices
    join projects on projects.id = invoices.project_id
    where invoices.id = invoice_line_items.invoice_id
  )
);

alter table contracts enable row level security;
alter table contracts force row level security;
create policy contracts_select_policy on contracts for select using (
  exists (select 1 from projects where projects.id = contracts.project_id)
);
create policy contracts_write_policy on contracts for all using (
  current_app_can_write() and exists (select 1 from projects where projects.id = contracts.project_id)
) with check (
  current_app_can_write() and exists (select 1 from projects where projects.id = contracts.project_id)
);
