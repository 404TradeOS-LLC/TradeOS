-- Email/password login needs to find a user by email before any identity is
-- known (no auth_subject, no org_id) — the existing users_select_policy
-- can't help here since it's keyed off the *signed-in* subject. Mirrors the
-- existing current_app_is_provisioning() bootstrap pattern: the API sets a
-- short-lived transaction-local flag, and this is an additional PERMISSIVE
-- policy (Postgres OR's multiple permissive policies together), so it only
-- ever widens visibility for the duration of the login transaction itself —
-- it never narrows or replaces the existing policy.
create or replace function current_app_login_lookup() returns boolean
language sql stable
as $$
  select coalesce(current_setting('app.login_lookup', true) = 'true', false)
$$;

create policy users_login_lookup_policy on users
for select using (
  current_app_login_lookup()
);

-- Once the login transaction has resolved a user (and set app.user_id), it
-- needs to find that user's own active membership to learn which org to
-- issue a token for — scoped to that one user's rows, not every membership.
create policy memberships_login_lookup_policy on organization_memberships
for select using (
  current_app_login_lookup() and user_id = current_app_user_id()
);
