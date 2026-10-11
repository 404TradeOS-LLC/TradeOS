-- Short-lived, single-use OAuth authorization states for the ABC Supply
-- sandbox reauthorization flow (issue #711).
--
-- The application role never touches this table directly: FORCE ROW LEVEL
-- SECURITY is enabled with no policies, and all access goes through the
-- SECURITY DEFINER wrappers below. This mirrors the supplier refresh-token
-- Vault migration (20261007031500_add_supplier_refresh_token_vault): the
-- create wrapper binds each state to the initiating tenant session, and the
-- consume wrapper validates expiry and consumes the state atomically exactly
-- once. The state token itself is the callback credential, so only its
-- HMAC-SHA256 (keyed with the server-side ABC_OAUTH_STATE_HMAC_SECRET) is
-- stored; the same holds for the browser-binding secret that ties the
-- callback to the initiating browser (RFC 6749 section 10.12).

create table if not exists public.abc_oauth_authorization_states (
  id uuid not null primary key default gen_random_uuid(),
  org_id uuid not null,
  user_id uuid not null,
  supplier_id uuid not null,
  state_hash text not null,
  code_verifier text not null,
  redirect_uri text not null,
  browser_binding_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create unique index if not exists abc_oauth_authorization_states_state_hash_uniq
  on public.abc_oauth_authorization_states (state_hash);

alter table public.abc_oauth_authorization_states enable row level security;
alter table public.abc_oauth_authorization_states force row level security;

create or replace function tradeos_private.create_abc_oauth_state(
  p_org_id uuid,
  p_user_id uuid,
  p_supplier_id uuid,
  p_state_hash text,
  p_code_verifier text,
  p_redirect_uri text,
  p_browser_binding_hash text,
  p_ttl_seconds integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if public.current_app_user_id() is null
     or public.current_app_user_id() is distinct from p_user_id
     or public.current_app_org_id() is distinct from p_org_id then
    raise exception 'ABC OAuth state creation requires the initiating tenant session'
      using errcode = '42501';
  end if;

  insert into public.abc_oauth_authorization_states
    (org_id, user_id, supplier_id, state_hash, code_verifier, redirect_uri,
     browser_binding_hash, expires_at)
  values
    (p_org_id, p_user_id, p_supplier_id, p_state_hash, p_code_verifier, p_redirect_uri,
     p_browser_binding_hash, now() + make_interval(secs => p_ttl_seconds));
end;
$function$;

create or replace function tradeos_private.consume_abc_oauth_state(
  p_state_hash text,
  p_browser_binding_hash text
)
returns table (
  org_id uuid,
  user_id uuid,
  supplier_id uuid,
  code_verifier text,
  redirect_uri text
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  -- Best-effort hygiene: drop long-expired rows while consuming.
  delete from public.abc_oauth_authorization_states
  where expires_at < now() - interval '1 day';

  -- The browser-binding hash must match: a state presented from any other
  -- browser (e.g. a stolen authorize URL) is rejected WITHOUT consuming
  -- the row, so the legitimate initiating browser can still complete the
  -- flow and an attacker cannot burn the state.
  return query
  update public.abc_oauth_authorization_states as state_row
  set consumed_at = now()
  where state_row.state_hash = p_state_hash
    and state_row.browser_binding_hash = p_browser_binding_hash
    and state_row.consumed_at is null
    and state_row.expires_at > now()
  returning
    state_row.org_id,
    state_row.user_id,
    state_row.supplier_id,
    state_row.code_verifier,
    state_row.redirect_uri;
end;
$function$;

revoke all on function tradeos_private.create_abc_oauth_state(uuid, uuid, uuid, text, text, text, text, integer) from public;
revoke all on function tradeos_private.consume_abc_oauth_state(text, text) from public;
