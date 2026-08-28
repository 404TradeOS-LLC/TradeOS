-- Customer portal identity is separate from staff authentication. Raw magic
-- link values never persist; only SHA-256 digests are stored.
create table customer_portal_access_tokens (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organizations(id) on delete cascade,
  customer_id        uuid not null references customers(id) on delete cascade,
  token_hash         text not null unique,
  expires_at         timestamptz not null,
  redeemed_at        timestamptz,
  revoked_at         timestamptz,
  created_by_user_id uuid references users(id) on delete set null,
  created_at         timestamptz not null default now()
);

create index idx_customer_portal_access_tokens_scope
  on customer_portal_access_tokens(org_id, customer_id, expires_at);

create table customer_portal_sessions (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  customer_id      uuid not null references customers(id) on delete cascade,
  access_token_id  uuid not null references customer_portal_access_tokens(id) on delete cascade,
  session_hash     text not null unique,
  expires_at       timestamptz not null,
  revoked_at       timestamptz,
  last_seen_at     timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create index idx_customer_portal_sessions_scope
  on customer_portal_sessions(org_id, customer_id, expires_at);

create or replace function public.current_app_portal_lookup_hash() returns text
language sql stable
as $$ select nullif(current_setting('app.portal_lookup_hash', true), '') $$;

create or replace function public.current_app_portal_session_hash() returns text
language sql stable
as $$ select nullif(current_setting('app.portal_session_hash', true), '') $$;

create or replace function public.current_app_portal_customer_id() returns text
language sql stable
as $$ select nullif(current_setting('app.portal_customer_id', true), '') $$;

create or replace function public.current_app_portal_contract_id() returns text
language sql stable
as $$ select nullif(current_setting('app.portal_contract_id', true), '') $$;

alter function public.current_app_portal_lookup_hash() set search_path = '';
alter function public.current_app_portal_session_hash() set search_path = '';
alter function public.current_app_portal_customer_id() set search_path = '';
alter function public.current_app_portal_contract_id() set search_path = '';

alter table customer_portal_access_tokens enable row level security;
alter table customer_portal_access_tokens force row level security;
create policy customer_portal_access_tokens_lookup_policy on customer_portal_access_tokens
for select using (
  token_hash = (select public.current_app_portal_lookup_hash())
  or (
    org_id = (select public.current_app_org_id())
    and (select public.current_app_role()) in ('owner', 'admin', 'dispatcher', 'estimator')
  )
);
create policy customer_portal_access_tokens_redeem_policy on customer_portal_access_tokens
for update using (
  token_hash = (select public.current_app_portal_lookup_hash())
  and redeemed_at is null
  and revoked_at is null
  and expires_at > now()
) with check (
  token_hash = (select public.current_app_portal_lookup_hash())
);
create policy customer_portal_access_tokens_write_policy on customer_portal_access_tokens
for insert with check (
  org_id = (select public.current_app_org_id())
  and (select public.current_app_role()) in ('owner', 'admin', 'dispatcher', 'estimator')
);
create policy customer_portal_access_tokens_revoke_policy on customer_portal_access_tokens
for update using (
  org_id = (select public.current_app_org_id())
  and (select public.current_app_role()) in ('owner', 'admin', 'dispatcher', 'estimator')
) with check (
  org_id = (select public.current_app_org_id())
);

alter table customer_portal_sessions enable row level security;
alter table customer_portal_sessions force row level security;
create policy customer_portal_sessions_lookup_policy on customer_portal_sessions
for select using (
  session_hash = (select public.current_app_portal_session_hash())
  or (org_id = (select public.current_app_org_id()) and (select public.current_app_can_write()))
);
create policy customer_portal_sessions_write_policy on customer_portal_sessions
for insert with check (
  (
    org_id = (select public.current_app_org_id())
    and (select public.current_app_can_write())
  )
  or (
    org_id = (select public.current_app_org_id())
    and customer_id = (
      select access_token.customer_id
      from customer_portal_access_tokens access_token
      where access_token.id = access_token_id
        and access_token.token_hash = (select public.current_app_portal_lookup_hash())
    )
  )
);
create policy customer_portal_sessions_touch_policy on customer_portal_sessions
for update using (
  session_hash = (select public.current_app_portal_session_hash())
  and revoked_at is null
  and expires_at > now()
) with check (
  session_hash = (select public.current_app_portal_session_hash())
);
create policy customer_portal_sessions_revoke_policy on customer_portal_sessions
for update using (
  org_id = (select public.current_app_org_id())
  and (select public.current_app_role()) in ('owner', 'admin', 'dispatcher', 'estimator')
) with check (
  org_id = (select public.current_app_org_id())
);

-- A portal session may see only the customer it was issued for. The existing
-- organization-wide policies remain the permissive staff policies; this
-- restrictive policy adds the customer predicate only for the portal role.
create policy projects_customer_portal_scope_policy on projects
as restrictive for select using (
  (select public.current_app_role()) <> 'portal_customer'
  or customer_id = (select public.current_app_portal_customer_id())::uuid
);
create policy customers_customer_portal_scope_policy on customers
as restrictive for select using (
  (select public.current_app_role()) <> 'portal_customer'
  or id = (select public.current_app_portal_customer_id())::uuid
);

-- Portal signing is the only customer-originated write. It is deliberately a
-- separate permissive UPDATE policy rather than adding a customer role to the
-- staff-wide current_app_can_write() helper.
create policy contracts_portal_sign_policy on contracts
for update using (
  id::text = (select public.current_app_portal_contract_id())
  and status = 'pending_signature'
  and exists (
    select 1
    from projects
    where projects.id = contracts.project_id
      and projects.org_id = (select public.current_app_org_id())
      and projects.customer_id = (select public.current_app_portal_customer_id())::uuid
  )
) with check (
  id::text = (select public.current_app_portal_contract_id())
  and status = 'signed'
  and exists (
    select 1
    from projects
    where projects.id = contracts.project_id
      and projects.org_id = (select public.current_app_org_id())
      and projects.customer_id = (select public.current_app_portal_customer_id())::uuid
  )
);

create or replace function public.enforce_customer_portal_contract_sign() returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if public.current_app_role() = 'portal_customer' then
    if old.id <> new.id
      or old.project_id <> new.project_id
      or old.proposal_id <> new.proposal_id
      or old.terms_text <> new.terms_text
      or old.contract_amount is distinct from new.contract_amount
      or old.snapshot_json is distinct from new.snapshot_json
      or new.status <> 'signed'
    then
      raise exception 'Customer portal signing may only complete the exact pending contract transition';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists contracts_customer_portal_sign_integrity on contracts;
create trigger contracts_customer_portal_sign_integrity
before update on contracts
for each row execute function public.enforce_customer_portal_contract_sign();

create policy contract_events_portal_sign_policy on contract_events
for insert with check (
  org_id = (select public.current_app_org_id())
  and event_type = 'contract.signed'
  and actor_user_id is null
  and contract_id::text = (select public.current_app_portal_contract_id())
  and exists (
    select 1
    from contracts
    join projects on projects.id = contracts.project_id
    where contracts.id = contract_events.contract_id
      and projects.org_id = (select public.current_app_org_id())
      and projects.customer_id = (select public.current_app_portal_customer_id())::uuid
  )
);

create policy activity_events_portal_sign_policy on activity_events
for insert with check (
  org_id = (select public.current_app_org_id())
  and event_type = 'contract.signed'
  and actor_user_id is null
  and entity_type = 'project'
  and entity_id = (
    select contracts.project_id
    from contracts
    join projects on projects.id = contracts.project_id
    where contracts.id::text = (select public.current_app_portal_contract_id())
      and projects.org_id = (select public.current_app_org_id())
      and projects.customer_id = (select public.current_app_portal_customer_id())::uuid
  )
);
