-- Keep migration history under the migration administrator's control. RLS is
-- intentionally not forced here: Prisma connects as the table owner through
-- DATABASE_ADMIN_URL and must continue to record successfully applied
-- migrations, while non-owner roles receive no policy-backed access.
alter table public._prisma_migrations enable row level security;
revoke all privileges on table public._prisma_migrations from public;

do $security$
declare
  protected_role text;
begin
  for protected_role in
    select rolname
    from pg_catalog.pg_roles
    where rolname = any (array['tradeos_app', 'anon', 'authenticated'])
  loop
    execute format(
      'revoke all privileges on table public._prisma_migrations from %I',
      protected_role
    );
  end loop;
end
$security$;

-- The login lookup flag is deliberately available before an authenticated
-- identity is known. Preserve that bootstrap flow, but prevent a qualifying
-- auth row from being reassigned to a different organization, user,
-- membership, token, or inviter during an UPDATE.
create or replace function public.enforce_auth_record_identity()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_table_schema <> 'public' then
    raise exception 'auth record identity guard invoked outside public schema'
      using errcode = '42501';
  end if;

  if tg_table_name = 'organization_invites' then
    if row(
      new.id,
      new.org_id,
      new.email,
      new.role,
      new.token_hash,
      new.invited_by_user_id,
      new.expires_at,
      new.created_at
    ) is distinct from row(
      old.id,
      old.org_id,
      old.email,
      old.role,
      old.token_hash,
      old.invited_by_user_id,
      old.expires_at,
      old.created_at
    ) then
      raise exception 'organization invite identity fields are immutable'
        using errcode = '42501';
    end if;
  elsif tg_table_name = 'auth_refresh_tokens' then
    if row(
      new.id,
      new.org_id,
      new.user_id,
      new.membership_id,
      new.token_hash,
      new.expires_at,
      new.created_at
    ) is distinct from row(
      old.id,
      old.org_id,
      old.user_id,
      old.membership_id,
      old.token_hash,
      old.expires_at,
      old.created_at
    ) then
      raise exception 'refresh token identity fields are immutable'
        using errcode = '42501';
    end if;
  elsif tg_table_name = 'password_reset_tokens' then
    if row(
      new.id,
      new.user_id,
      new.token_hash,
      new.expires_at,
      new.created_at
    ) is distinct from row(
      old.id,
      old.user_id,
      old.token_hash,
      old.expires_at,
      old.created_at
    ) then
      raise exception 'password reset token identity fields are immutable'
        using errcode = '42501';
    end if;
  else
    raise exception 'auth record identity guard invoked for unexpected table'
      using errcode = '42501';
  end if;

  return new;
end
$function$;

drop trigger if exists organization_invites_identity_guard on public.organization_invites;
create trigger organization_invites_identity_guard
before update on public.organization_invites
for each row execute function public.enforce_auth_record_identity();

drop trigger if exists auth_refresh_tokens_identity_guard on public.auth_refresh_tokens;
create trigger auth_refresh_tokens_identity_guard
before update on public.auth_refresh_tokens
for each row execute function public.enforce_auth_record_identity();

drop trigger if exists password_reset_tokens_identity_guard on public.password_reset_tokens;
create trigger password_reset_tokens_identity_guard
before update on public.password_reset_tokens
for each row execute function public.enforce_auth_record_identity();

drop policy if exists organization_invites_accept_update_policy on public.organization_invites;
create policy organization_invites_accept_update_policy on public.organization_invites
for update using (
  public.current_app_login_lookup()
) with check (
  public.current_app_login_lookup()
);

drop policy if exists auth_refresh_tokens_update_policy on public.auth_refresh_tokens;
create policy auth_refresh_tokens_update_policy on public.auth_refresh_tokens
for update using (
  (
    org_id = (select public.current_app_org_id())
    and (
      user_id = public.current_app_user_id()
      or public.current_app_can_administer()
    )
  )
  or public.current_app_login_lookup()
) with check (
  (
    org_id = (select public.current_app_org_id())
    and (
      user_id = public.current_app_user_id()
      or public.current_app_can_administer()
    )
  )
  or public.current_app_login_lookup()
);

drop policy if exists password_reset_tokens_update_policy on public.password_reset_tokens;
create policy password_reset_tokens_update_policy on public.password_reset_tokens
for update using (
  user_id = public.current_app_user_id()
  or public.current_app_login_lookup()
  or public.current_app_can_administer()
) with check (
  user_id = public.current_app_user_id()
  or public.current_app_login_lookup()
  or public.current_app_can_administer()
);

-- Pin every helper's lookup behavior. The two helpers that invoke another
-- application function are redefined with a schema-qualified reference
-- before their search paths are emptied.
create or replace function public.current_app_can_write() returns boolean
language sql stable
as $function$
  select coalesce(
    public.current_app_role() in ('owner', 'admin', 'estimator', 'dispatcher', 'technician'),
    false
  )
$function$;

create or replace function public.current_app_can_administer() returns boolean
language sql stable
as $function$
  select coalesce(
    public.current_app_role() in ('owner', 'admin', 'dispatcher'),
    false
  )
$function$;

alter function public.current_app_user_id() set search_path = '';
alter function public.current_app_org_id() set search_path = '';
alter function public.current_app_auth_subject() set search_path = '';
alter function public.current_app_role() set search_path = '';
alter function public.current_app_can_write() set search_path = '';
alter function public.current_app_can_administer() set search_path = '';
alter function public.current_app_is_provisioning() set search_path = '';
alter function public.current_app_login_lookup() set search_path = '';
