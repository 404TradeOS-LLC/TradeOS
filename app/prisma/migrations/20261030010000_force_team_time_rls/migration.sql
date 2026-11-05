-- Team & Time RLS enforcement after source-controlled foundation and integrity.
-- A missing table is a HARD ERROR so Prisma cannot record a misleading
-- "applied" migration on a database where these tables are installed later.
-- This changes table-owner posture only. The deployed Edge Function uses the
-- bypass-RLS service_role; its tenant authorization is independently tested.
-- Never interpret FORCE here as service-role tenant isolation.
DO $team_time_force_rls$
DECLARE
  team_table text;
  missing_tables text[] := ARRAY[]::text[];
BEGIN
  FOREACH team_table IN ARRAY ARRAY[
    'team_time_profiles',
    'team_time_shifts',
    'team_time_events'
  ] LOOP
    IF to_regclass(format('public.%I', team_table)) IS NULL THEN
      missing_tables := array_append(missing_tables,team_table);
    END IF;
  END LOOP;
  IF array_length(missing_tables,1) IS NOT NULL THEN
    RAISE EXCEPTION 'Team & Time schema missing: %; restore foundation/integrity before FORCE RLS',array_to_string(missing_tables,', ')
      USING ERRCODE='42P01';
  END IF;
  FOREACH team_table IN ARRAY ARRAY[
    'team_time_profiles',
    'team_time_shifts',
    'team_time_events'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',team_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',team_table);
  END LOOP;
END
$team_time_force_rls$;
