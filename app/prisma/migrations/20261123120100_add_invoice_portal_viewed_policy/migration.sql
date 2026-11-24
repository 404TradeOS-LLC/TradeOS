-- DES-7 (c): portal mark-viewed is the second customer-originated write,
-- after contract signing. A portal session carries app.role =
-- 'portal_customer', so current_app_can_write() is false and the staff
-- invoices / invoice_deliveries / activity write policies all deny it.
-- This migration grants one narrowly scoped portal UPDATE policy + trigger,
-- keyed by a transaction-local app.portal_invoice_id set by
-- InvoicesService.markViewed (same shape as app.portal_contract_id for
-- contract signing), so a portal session never receives staff write
-- privileges. The trigger is the column-level guard: a portal session may
-- only move a sent invoice to viewed, or leave the status alone, and may
-- only set viewedAt from null — every other column is pinned.

create or replace function public.current_app_portal_invoice_id() returns text
language sql stable
as $$ select nullif(current_setting('app.portal_invoice_id', true), '') $$;

alter function public.current_app_portal_invoice_id() set search_path = '';

-- Portal viewing is the only customer-originated invoice write. It is
-- deliberately a separate permissive UPDATE policy rather than adding a
-- customer role to the staff-wide current_app_can_write() helper.
create policy invoices_portal_viewed_policy on invoices
for update using (
  id::text = (select public.current_app_portal_invoice_id())
  and status <> 'draft'
  and exists (
    select 1
    from projects
    where projects.id = invoices.project_id
      and projects.org_id = (select public.current_app_org_id())
      and projects.customer_id = (select public.current_app_portal_customer_id())::uuid
  )
) with check (
  id::text = (select public.current_app_portal_invoice_id())
  and status <> 'draft'
  and exists (
    select 1
    from projects
    where projects.id = invoices.project_id
      and projects.org_id = (select public.current_app_org_id())
      and projects.customer_id = (select public.current_app_portal_customer_id())::uuid
  )
);

create or replace function public.enforce_customer_portal_invoice_viewed() returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if public.current_app_role() = 'portal_customer' then
    if old.id <> new.id
      or old.project_id <> new.project_id
      or old.estimate_id is distinct from new.estimate_id
      or old.proposal_id is distinct from new.proposal_id
      or old.invoice_number <> new.invoice_number
      or old.type <> new.type
      or old.percent_complete is distinct from new.percent_complete
      or old.amount is distinct from new.amount
      or old.subtotal is distinct from new.subtotal
      or old.tax_pct is distinct from new.tax_pct
      or old.tax_amount is distinct from new.tax_amount
      or old.due_date is distinct from new.due_date
      or old.sent_at is distinct from new.sent_at
      or old.paid_at is distinct from new.paid_at
      or old.created_at <> new.created_at
      or old.create_request_key is distinct from new.create_request_key
      or old.create_request_hash is distinct from new.create_request_hash
      or old.viewed_at is not null
      or new.viewed_at is null
      or not (
        (old.status = 'sent' and new.status = 'viewed')
        or new.status = old.status
      )
    then
      raise exception 'Customer portal viewing may only record the first view of a sent invoice';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists invoices_customer_portal_viewed_integrity on invoices;
create trigger invoices_customer_portal_viewed_integrity
before update on invoices
for each row execute function public.enforce_customer_portal_invoice_viewed();

create policy invoice_deliveries_portal_viewed_policy on invoice_deliveries
for insert with check (
  org_id = (select public.current_app_org_id())
  and event_type = 'invoice.viewed'
  and delivery_channel = 'portal'
  and actor_user_id is null
  and invoice_id::text = (select public.current_app_portal_invoice_id())
  and exists (
    select 1
    from invoices
    join projects on projects.id = invoices.project_id
    where invoices.id = invoice_deliveries.invoice_id
      and projects.org_id = (select public.current_app_org_id())
      and projects.customer_id = (select public.current_app_portal_customer_id())::uuid
  )
);

create policy activity_events_portal_viewed_policy on activity_events
for insert with check (
  org_id = (select public.current_app_org_id())
  and event_type = 'invoice.viewed'
  and actor_user_id is null
  and entity_type = 'project'
  and entity_id = (
    select invoices.project_id
    from invoices
    join projects on projects.id = invoices.project_id
    where invoices.id::text = (select public.current_app_portal_invoice_id())
      and projects.org_id = (select public.current_app_org_id())
      and projects.customer_id = (select public.current_app_portal_customer_id())::uuid
  )
);
