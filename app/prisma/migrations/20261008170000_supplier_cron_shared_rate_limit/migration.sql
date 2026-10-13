-- Shared, atomic rate limiting for the Vercel supplier-sync endpoint.
-- Private, non-tenant operational state; never reachable from the Data API.
-- All callers use the same database across horizontally scaled instances.
create schema if not exists tradeos_private;
revoke all on schema tradeos_private from public;

create table if not exists tradeos_private.supplier_cron_rate_limits (
  key_hash text primary key,
  hits integer not null check (hits > 0),
  reset_at timestamptz not null
);
revoke all on tradeos_private.supplier_cron_rate_limits from public;

create or replace function tradeos_private.consume_supplier_cron_rate_limit(
  p_key_hash text,
  p_window_ms integer
) returns table (total_hits integer, window_resets_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_window interval;
begin
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$'
     or p_window_ms < 1000 or p_window_ms > 86400000 then
    raise exception 'Invalid supplier cron rate limit arguments' using errcode = '22023';
  end if;
  v_window := make_interval(secs => p_window_ms / 1000.0::double precision);

  return query
  insert into tradeos_private.supplier_cron_rate_limits as limits
    (key_hash, hits, reset_at)
  values (p_key_hash, 1, v_now + v_window)
  on conflict (key_hash) do update
  set hits = case when limits.reset_at <= v_now then 1 else limits.hits + 1 end,
      reset_at = case when limits.reset_at <= v_now then v_now + v_window else limits.reset_at end
  returning limits.hits, limits.reset_at;
end
$function$;

revoke all on function tradeos_private.consume_supplier_cron_rate_limit(text, integer) from public;
