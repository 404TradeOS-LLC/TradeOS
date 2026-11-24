-- DES-10-F7: governed public-portal proposal approval + signature.
--
-- Third customer-originated write, after contract signing
-- (20260828150000) and invoice mark-viewed (20261123120100). Same shape: a
-- narrowly scoped portal UPDATE policy + trigger keyed by a
-- transaction-local app.portal_proposal_id set by
-- ProposalsService.acceptAsPortalCustomer / declineAsPortalCustomer, so a
-- portal session never receives staff write privileges.
--
-- The trigger is the column-level guard: a portal session may only move a
-- sent/viewed proposal to accepted (with a drawn signature + printed name
-- attributed to the token holder's email on file) or declined (with an
-- optional reason), and may set only respondedAt, the signature columns,
-- and declined_reason. Every other column — scope, prices, terms, payment
-- schedule — is pinned, so the portal displays what the proposal already
-- says and cannot rewrite it.
--
-- Accepting also moves the owning project to 'awarded', mirroring the
-- staff accept path. That project write gets its own narrow policy +
-- trigger below: estimating -> awarded only, for the project of the portal
-- proposal only. Declining deliberately does NOT touch the project: a
-- project may carry several proposals, and declining one must not un-award
-- a project won through another (the staff reject path sets 'estimating'
-- unconditionally; the portal path does not copy that quirk).

alter table proposals add column if not exists signer_name text;
alter table proposals add column if not exists signer_email text;
alter table proposals add column if not exists signature_data_url text;
alter table proposals add column if not exists signature_ip_reported text;
alter table proposals add column if not exists signature_user_agent_reported text;
alter table proposals add column if not exists signed_at timestamptz;
alter table proposals add column if not exists declined_reason text;

create or replace function public.current_app_portal_proposal_id() returns text
language sql stable
as $$ select nullif(current_setting('app.portal_proposal_id', true), '') $$;

alter function public.current_app_portal_proposal_id() set search_path = '';

-- The project award below is keyed by the owning project id directly
-- (set by the service next to the proposal id), not by a subquery over
-- proposals: a subquery would re-enter the proposals SELECT policy, whose
-- EXISTS over projects re-enters the projects policy evaluation for the
-- same UPDATE — PostgreSQL rejects that cycle as infinite recursion
-- (42P17). Both settings are transaction-local, set by the service only
-- after it asserted the proposal belongs to this session's customer, so
-- the direct id is no wider than the subquery would have been.
create or replace function public.current_app_portal_proposal_project_id() returns text
language sql stable
as $$ select nullif(current_setting('app.portal_proposal_project_id', true), '') $$;

alter function public.current_app_portal_proposal_project_id() set search_path = '';

-- Portal approval / decline is the only customer-originated proposal write.
-- It is deliberately a separate permissive UPDATE policy rather than adding
-- a customer role to the staff-wide current_app_can_write() helper.
create policy proposals_portal_response_policy on proposals
for update using (
  id::text = (select public.current_app_portal_proposal_id())
  and status in ('sent', 'viewed')
  and exists (
    select 1
    from projects
    where projects.id = proposals.project_id
      and projects.org_id = (select public.current_app_org_id())
      and projects.customer_id = (select public.current_app_portal_customer_id())::uuid
  )
) with check (
  id::text = (select public.current_app_portal_proposal_id())
  and status in ('accepted', 'declined')
  and (status = 'declined' or (signer_name is not null and signature_data_url is not null and signed_at is not null))
  and exists (
    select 1
    from projects
    where projects.id = proposals.project_id
      and projects.org_id = (select public.current_app_org_id())
      and projects.customer_id = (select public.current_app_portal_customer_id())::uuid
  )
);

create or replace function public.enforce_customer_portal_proposal_response() returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if public.current_app_role() = 'portal_customer' then
    if old.id <> new.id
      or old.project_id <> new.project_id
      or old.estimate_id is distinct from new.estimate_id
      or old.company_name is distinct from new.company_name
      or old.show_line_item_detail <> new.show_line_item_detail
      or old.scope_of_work is distinct from new.scope_of_work
      or old.assumptions is distinct from new.assumptions
      or old.exclusions is distinct from new.exclusions
      or old.timeline is distinct from new.timeline
      or old.price_low is distinct from new.price_low
      or old.price_high is distinct from new.price_high
      or old.final_price is distinct from new.final_price
      or old.payment_schedule_json is distinct from new.payment_schedule_json
      or old.pdf_url is distinct from new.pdf_url
      or old.terms_and_conditions is distinct from new.terms_and_conditions
      or old.sent_at is distinct from new.sent_at
      or old.viewed_at is distinct from new.viewed_at
      or old.idempotency_key is distinct from new.idempotency_key
      or old.idempotency_hash is distinct from new.idempotency_hash
      or old.created_at <> new.created_at
      or old.status not in ('sent', 'viewed')
      or new.status not in ('accepted', 'declined')
      or old.responded_at is not null
      or new.responded_at is null
      or (new.status = 'accepted' and (
        new.signer_name is null
        or btrim(new.signer_name) = ''
        or new.signer_email is null
        or btrim(new.signer_email) = ''
        or new.signature_data_url is null
        or new.signature_data_url !~ '^data:image/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$'
        or new.signed_at is null
        or new.declined_reason is not null
      ))
      or (new.status = 'declined' and (
        new.signer_name is not null
        or new.signer_email is not null
        or new.signature_data_url is not null
        or new.signature_ip_reported is not null
        or new.signature_user_agent_reported is not null
        or new.signed_at is not null
        or (new.declined_reason is not null and char_length(new.declined_reason) > 500)
      ))
    then
      raise exception 'Customer portal proposal response may only record the governed accept or decline of the sent proposal';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists proposals_customer_portal_response_integrity on proposals;
create trigger proposals_customer_portal_response_integrity
before update on proposals
for each row execute function public.enforce_customer_portal_proposal_response();

create policy proposal_deliveries_portal_response_policy on proposal_deliveries
for insert with check (
  org_id = (select public.current_app_org_id())
  and event_type in ('proposal.accepted', 'proposal.declined')
  and delivery_channel = 'portal'
  and actor_user_id is null
  and proposal_id::text = (select public.current_app_portal_proposal_id())
  and exists (
    select 1
    from proposals
    join projects on projects.id = proposals.project_id
    where proposals.id = proposal_deliveries.proposal_id
      and projects.org_id = (select public.current_app_org_id())
      and projects.customer_id = (select public.current_app_portal_customer_id())::uuid
  )
);

create policy activity_events_portal_proposal_response_policy on activity_events
for insert with check (
  org_id = (select public.current_app_org_id())
  and event_type in ('proposal.accepted', 'proposal.declined')
  and actor_user_id is null
  and entity_type = 'project'
  and entity_id = (
    select proposals.project_id
    from proposals
    join projects on projects.id = proposals.project_id
    where proposals.id::text = (select public.current_app_portal_proposal_id())
      and projects.org_id = (select public.current_app_org_id())
      and projects.customer_id = (select public.current_app_portal_customer_id())::uuid
  )
);

-- Accepting a proposal awards its project (staff accept parity). Narrowly
-- scoped to the project id the service sets next to the proposal id,
-- estimating -> awarded only. See the note on
-- current_app_portal_proposal_project_id above for why this is a direct id
-- comparison and not a subquery over proposals.
create policy projects_portal_proposal_award_policy on projects
for update using (
  id::text = (select public.current_app_portal_proposal_project_id())
  and status = 'estimating'
  and org_id = (select public.current_app_org_id())
  and customer_id = (select public.current_app_portal_customer_id())::uuid
) with check (
  id::text = (select public.current_app_portal_proposal_project_id())
  and status = 'awarded'
  and org_id = (select public.current_app_org_id())
  and customer_id = (select public.current_app_portal_customer_id())::uuid
);

create or replace function public.enforce_customer_portal_proposal_award() returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if public.current_app_role() = 'portal_customer' then
    if old.id <> new.id
      or old.org_id is distinct from new.org_id
      or old.customer_id is distinct from new.customer_id
      or old.name <> new.name
      or old.job_type is distinct from new.job_type
      or old.site_address is distinct from new.site_address
      or old.simple_scope is distinct from new.simple_scope
      or old.region_id is distinct from new.region_id
      or old.created_at <> new.created_at
      or old.status <> 'estimating'
      or new.status <> 'awarded'
    then
      raise exception 'Customer portal proposal acceptance may only award the project of the accepted proposal';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists projects_customer_portal_proposal_award_integrity on projects;
create trigger projects_customer_portal_proposal_award_integrity
before update on projects
for each row execute function public.enforce_customer_portal_proposal_award();
