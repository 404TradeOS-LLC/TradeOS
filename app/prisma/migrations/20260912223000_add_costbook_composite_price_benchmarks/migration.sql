-- Trusted reference-price persistence for composite installed-unit-price evidence
-- such as INDOT awarded-bid unit price summaries. These rows are Costbook
-- benchmark/history evidence only; they are deliberately separate from raw
-- Material/LaborRate/Equipment pricing and cannot be promoted automatically.

create table costbook_composite_price_benchmarks (
    id                  uuid primary key default gen_random_uuid(),
    org_id              uuid not null references organizations(id) on delete cascade,

    source_name         text not null,
    source_identifier   text not null,
    source_year         integer not null check (source_year between 1900 and 2200),
    source_url          text,
    source_file         text,
    source_row          integer check (source_row is null or source_row > 0),
    retrieved_at        timestamptz not null default now(),

    section             text,
    item_code           text not null,
    description         text not null,
    unit_of_measure     text not null,

    low_price           numeric(14,4),
    weighted_avg_price  numeric(14,4) not null,
    high_price          numeric(14,4),
    source_quantity     numeric(18,4),
    total_extended      numeric(18,4),

    geography           text not null,
    price_basis         text not null,
    catalog_status      text,
    review_status       text not null default 'reference'
                        check (review_status in ('reference', 'needs-review', 'reviewed', 'rejected')),

    imported_by_user_id uuid references users(id) on delete set null,
    imported_at         timestamptz not null default now(),
    updated_at          timestamptz not null default now(),

    constraint costbook_composite_price_benchmarks_price_order
        check (
          (low_price is null or high_price is null or low_price <= high_price)
          and (low_price is null or weighted_avg_price >= low_price)
          and (high_price is null or weighted_avg_price <= high_price)
        ),
    constraint costbook_composite_price_benchmarks_nonnegative
        check (
          weighted_avg_price >= 0
          and (low_price is null or low_price >= 0)
          and (high_price is null or high_price >= 0)
          and (source_quantity is null or source_quantity >= 0)
          and (total_extended is null or total_extended >= 0)
        ),
    constraint costbook_composite_price_benchmarks_source_identifier_unique
        unique (org_id, source_identifier),
    constraint costbook_composite_price_benchmarks_source_item_unique
        unique (org_id, source_name, source_year, item_code)
);

create index idx_costbook_composite_price_benchmarks_org_item_year
    on costbook_composite_price_benchmarks(org_id, item_code, source_year desc);

create index idx_costbook_composite_price_benchmarks_org_section_year
    on costbook_composite_price_benchmarks(org_id, section, source_year desc);

create index idx_costbook_composite_price_benchmarks_org_review
    on costbook_composite_price_benchmarks(org_id, review_status, updated_at desc);

alter table costbook_composite_price_benchmarks enable row level security;
alter table costbook_composite_price_benchmarks force row level security;

create policy costbook_composite_price_benchmarks_select_policy
on costbook_composite_price_benchmarks
for select using (
  org_id = (select public.current_app_org_id())
);

create policy costbook_composite_price_benchmarks_write_policy
on costbook_composite_price_benchmarks
for all using (
  org_id = (select public.current_app_org_id())
  and (select public.current_app_can_manage_costbook())
) with check (
  org_id = (select public.current_app_org_id())
  and (select public.current_app_can_manage_costbook())
);
