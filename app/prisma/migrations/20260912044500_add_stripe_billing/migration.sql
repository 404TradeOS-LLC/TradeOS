-- Stripe Billing foundation for TradeOS SaaS subscriptions.
-- Subscription state is tenant-scoped and webhook-driven. Stripe remains the
-- authority for payment/subscription state; TradeOS stores the synchronized
-- projection used for product entitlements and UI.

create table if not exists organization_billing (
  org_id                     uuid primary key references organizations(id) on delete cascade,
  stripe_customer_id         text unique,
  stripe_subscription_id     text unique,
  plan                        text,
  billing_interval            text,
  status                      text not null default 'none',
  price_id                    text,
  trial_ends_at               timestamptz,
  current_period_ends_at      timestamptz,
  cancel_at_period_end        boolean not null default false,
  last_invoice_status         text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint organization_billing_plan_check check (plan is null or plan in ('starter', 'pro', 'business', 'scale')),
  constraint organization_billing_interval_check check (billing_interval is null or billing_interval in ('monthly', 'annual'))
);

create index if not exists idx_organization_billing_customer on organization_billing(stripe_customer_id);
create index if not exists idx_organization_billing_subscription on organization_billing(stripe_subscription_id);

alter table organization_billing enable row level security;
alter table organization_billing force row level security;

create policy organization_billing_select_policy on organization_billing
for select using (org_id = (select current_app_org_id()));

create policy organization_billing_write_policy on organization_billing
for all using (
  org_id = (select current_app_org_id()) and (select current_app_can_administer())
) with check (
  org_id = (select current_app_org_id()) and (select current_app_can_administer())
);

create table if not exists stripe_webhook_events (
  stripe_event_id             text primary key,
  org_id                      uuid not null references organizations(id) on delete cascade,
  event_type                  text not null,
  stripe_created_at           timestamptz,
  processed_at                timestamptz not null default now()
);

create index if not exists idx_stripe_webhook_events_org_processed
  on stripe_webhook_events(org_id, processed_at desc);

alter table stripe_webhook_events enable row level security;
alter table stripe_webhook_events force row level security;

create policy stripe_webhook_events_select_policy on stripe_webhook_events
for select using (
  org_id = (select current_app_org_id()) and (select current_app_can_administer())
);

create policy stripe_webhook_events_insert_policy on stripe_webhook_events
for insert with check (
  org_id = (select current_app_org_id()) and (select current_app_can_administer())
);
