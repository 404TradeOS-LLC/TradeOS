-- Regional supplier catalog and price-observation evidence.
-- These rows preserve raw supplier/source grain and are not current Material
-- prices. Promotion into Material or SupplierPriceUpdate remains a separate,
-- human-reviewed application workflow.

create table supplier_products (
    id                       uuid primary key default gen_random_uuid(),
    org_id                   uuid not null references organizations(id) on delete cascade,
    supplier_id              uuid not null references suppliers(id) on delete restrict,
    material_id              uuid references materials(id) on delete set null,

    supplier_product_key     text not null,
    sku                      text,
    manufacturer_part_number text,
    name                     text not null,
    description              text,
    package_description      text,
    purchase_unit            text,
    package_quantity         numeric(12,4),
    product_url              text,
    canonical_material_key   text,
    availability_status      text not null default 'unknown'
                             check (availability_status in ('available', 'unavailable', 'unknown')),
    is_active                boolean not null default true,
    source_file              text,
    imported_at              timestamptz not null default now(),
    created_at               timestamptz not null default now(),
    updated_at               timestamptz not null default now(),

    constraint supplier_products_package_quantity_nonnegative
        check (package_quantity is null or package_quantity > 0),
    constraint supplier_products_org_supplier_key_unique
        unique (org_id, supplier_id, supplier_product_key)
);

create table supplier_price_observations (
    id                       uuid primary key default gen_random_uuid(),
    org_id                   uuid not null references organizations(id) on delete cascade,
    supplier_product_id      uuid not null references supplier_products(id) on delete cascade,

    observation_key          text not null,
    market_code              text,
    store_name               text,
    city                     text,
    state                    text,
    postal_code              text,
    observed_at              timestamptz not null,
    source_url               text,
    source_file              text,
    source_row               integer check (source_row is null or source_row > 0),
    currency                 text not null default 'USD',
    price_status             text not null default 'unavailable'
                             check (price_status in ('priced', 'unavailable', 'not-listed', 'needs-review')),
    regular_price            numeric(14,4),
    sale_price               numeric(14,4),
    rebate_price             numeric(14,4),
    effective_price          numeric(14,4),
    purchase_unit            text,
    package_quantity         numeric(12,4),
    normalized_unit_price    numeric(14,6),
    normalized_unit          text,
    eligibility_reason       text,
    source_confidence        text
                             check (source_confidence is null or source_confidence in ('low', 'medium', 'high')),
    created_at               timestamptz not null default now(),

    constraint supplier_price_observations_prices_nonnegative
        check (
          (regular_price is null or regular_price >= 0)
          and (sale_price is null or sale_price >= 0)
          and (rebate_price is null or rebate_price >= 0)
          and (effective_price is null or effective_price >= 0)
          and (normalized_unit_price is null or normalized_unit_price >= 0)
          and (package_quantity is null or package_quantity > 0)
        ),
    constraint supplier_price_observations_org_key_unique
        unique (org_id, observation_key)
);

create index idx_supplier_products_org_supplier_active
    on supplier_products(org_id, supplier_id, is_active);

create index idx_supplier_products_org_canonical_key
    on supplier_products(org_id, canonical_material_key);

create index idx_supplier_products_material
    on supplier_products(material_id);

create index idx_supplier_price_observations_org_market_observed
    on supplier_price_observations(org_id, market_code, observed_at desc);

create index idx_supplier_price_observations_product_observed
    on supplier_price_observations(supplier_product_id, observed_at desc);

create index idx_supplier_price_observations_org_status
    on supplier_price_observations(org_id, price_status, observed_at desc);

alter table supplier_products enable row level security;
alter table supplier_products force row level security;

create policy supplier_products_select_policy on supplier_products
for select using (
  org_id = (select public.current_app_org_id())
);

create policy supplier_products_write_policy on supplier_products
for all using (
  org_id = (select public.current_app_org_id())
  and (select public.current_app_can_manage_costbook())
) with check (
  org_id = (select public.current_app_org_id())
  and (select public.current_app_can_manage_costbook())
);

alter table supplier_price_observations enable row level security;
alter table supplier_price_observations force row level security;

create policy supplier_price_observations_select_policy on supplier_price_observations
for select using (
  org_id = (select public.current_app_org_id())
);

create policy supplier_price_observations_write_policy on supplier_price_observations
for all using (
  org_id = (select public.current_app_org_id())
  and (select public.current_app_can_manage_costbook())
) with check (
  org_id = (select public.current_app_org_id())
  and (select public.current_app_can_manage_costbook())
);
