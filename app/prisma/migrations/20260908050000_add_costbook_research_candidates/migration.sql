-- Stage 6 of docs/architecture/COSTBOOK_RESEARCH_INGESTION_DESIGN.md: a
-- persisted, org-scoped queue for researched Costbook candidates awaiting a
-- named human reviewer's approve/reject decision, and an explicit promotion
-- linkage recorded only once an approved candidate is copied through the
-- existing cost-database/costbook services into a real cost_items row.
--
-- Mirrors the supplier_price_updates staged-review precedent (org-scoped
-- queue -> named reviewedByUserId/reviewedAt -> approved/rejected) rather
-- than inventing a new review-queue shape. Additive only: no existing table,
-- column, or row is modified.

create table costbook_research_candidates (
    id                     uuid primary key default gen_random_uuid(),
    org_id                 uuid not null references organizations(id) on delete cascade,

    trade                  text not null,
    category               text not null,
    item_name              text not null,
    description            text,
    unit_of_measure        text not null,

    material_cost_low      numeric(12,4),
    material_cost_typical  numeric(12,4) not null,
    material_cost_high     numeric(12,4),
    labor_hours            numeric(10,4),
    labor_rate_assumption  numeric(10,2),
    equipment_cost         numeric(10,2) not null default 0,

    source_name            text not null,
    source_url             text,
    source_identifier      text,
    source_date            text not null,
    retrieved_at           timestamptz not null,
    regional_basis         text not null,
    confidence             text not null
                           check (confidence in ('low', 'medium', 'high')),
    research_notes         text,
    provenance_status      text not null default 'unverified-legacy'
                           check (provenance_status in ('documented', 'unverified-legacy', 'placeholder')),

    review_status          text not null default 'candidate'
                           check (review_status in ('candidate', 'needs-review', 'approved', 'rejected')),
    reviewed_by_user_id    uuid references users(id) on delete restrict,
    reviewed_at            timestamptz,
    review_notes           text,

    promoted_at            timestamptz,
    promoted_by_user_id    uuid references users(id) on delete restrict,
    promoted_cost_item_id  uuid unique references cost_items(id) on delete set null,

    created_by_user_id     uuid references users(id) on delete set null,
    created_at             timestamptz not null default now(),
    updated_at             timestamptz not null default now(),

    -- A candidate must never be able to claim it was reviewed without a
    -- named human reviewer, and never promoted without both an approved
    -- review and a recorded promoter. Defense in depth alongside the
    -- application-layer isEligibleForCostbookPromotion() gate.
    constraint costbook_research_candidates_review_requires_reviewer
        check (
            review_status not in ('approved', 'rejected')
            or (reviewed_by_user_id is not null and reviewed_at is not null)
        ),
    constraint costbook_research_candidates_promotion_requires_approval
        check (
            promoted_cost_item_id is null
            or (review_status = 'approved' and promoted_at is not null and promoted_by_user_id is not null)
        )
);

create index idx_costbook_research_candidates_org_status_created
    on costbook_research_candidates(org_id, review_status, created_at desc);

alter table costbook_research_candidates enable row level security;
alter table costbook_research_candidates force row level security;

-- Any authenticated org member with costbook.read may see the review queue;
-- app-layer requirePermissions() further gates the routes themselves.
create policy costbook_research_candidates_select_policy on costbook_research_candidates
for select using (
  org_id = (select public.current_app_org_id())
);

-- Creating, reviewing, and promoting a candidate are all owner/admin-only
-- actions today (costbook.write and costbook.manage are both owner/admin-only
-- in app/domain/contracts.ts), so a single write policy covers insert/update
-- the same way materials_write_policy does for the Material catalog.
create policy costbook_research_candidates_write_policy on costbook_research_candidates
for all using (
  org_id = (select public.current_app_org_id())
  and (select public.current_app_can_manage_costbook())
) with check (
  org_id = (select public.current_app_org_id())
  and (select public.current_app_can_manage_costbook())
);
