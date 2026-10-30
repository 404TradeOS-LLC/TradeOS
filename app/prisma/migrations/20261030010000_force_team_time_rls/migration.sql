-- Force the established RLS posture on Team & Time tables when present.
-- These tables were previously introduced by an independent untracked source,
-- so fresh Prisma-only databases may legitimately lack them. Missing tables
-- are an intentional no-op; never create a different schema to conceal drift.
--
-- RLS policies/grants are NOT introduced or broadened here. The existing
-- application role lacks BYPASSRLS and must continue to fail closed until
-- explicit tenant policies are separately reviewed.
-- Production execution is deferred to the normal protected production path.
DO $team_time_force_rls$
DECLARE
  team_table text;
BEGIN
  FOREACH team_table IN ARRAY ARRAY[
    'team_time_profiles',
    'team_time_shifts',
    'team_time_events'
  ]
  LOOP
    IF to_regclass(format('public.%I', team_table)) IS NULL THEN
      RAISE NOTICE 'Team & Time table public.% is absent; FORCE RLS skipped', team_table;
    ELSE
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', team_table);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', team_table);
    END IF;
  END LOOP;
END
$team_time_force_rls$;
