-- Source-controlled equivalent of Supabase staging's
-- 20260924150458 team_time_integrity. Preserve existing constraints/functions.
-- Rehearsed on a disposable Postgres database before protected deployment.
DO $integrity$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.team_time_shifts'::regclass AND conname='team_time_shift_break') THEN
    ALTER TABLE public.team_time_shifts ADD CONSTRAINT team_time_shift_break
      CHECK (break_started_at IS NULL OR (ended_at IS NULL AND break_started_at >= started_at));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.team_time_shifts'::regclass AND conname='team_time_shift_review') THEN
    ALTER TABLE public.team_time_shifts ADD CONSTRAINT team_time_shift_review
      CHECK (status <> 'approved' OR (reviewed_by_id IS NOT NULL AND reviewed_at IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.team_time_shifts'::regclass AND conname='team_time_shift_status') THEN
    ALTER TABLE public.team_time_shifts ADD CONSTRAINT team_time_shift_status
      CHECK ((ended_at IS NULL AND status='open') OR (ended_at IS NOT NULL AND status IN ('pending','approved')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.team_time_shifts'::regclass AND conname='team_time_shift_times') THEN
    ALTER TABLE public.team_time_shifts ADD CONSTRAINT team_time_shift_times
      CHECK (ended_at IS NULL OR ended_at>started_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.team_time_shifts'::regclass AND conname='team_time_no_completed_overlap') THEN
    ALTER TABLE public.team_time_shifts ADD CONSTRAINT team_time_no_completed_overlap
      EXCLUDE USING gist (org_id WITH =,worker_user_id WITH =,tstzrange(started_at,ended_at,'[)') WITH &&)
      WHERE (ended_at IS NOT NULL);
  END IF;
END
$integrity$;

CREATE SCHEMA IF NOT EXISTS tradeos_private;
DO $audit$
BEGIN
  IF to_regprocedure('tradeos_private.audit_team_time_shift()') IS NULL THEN
    EXECUTE $definition$
      CREATE FUNCTION tradeos_private.audit_team_time_shift()
      RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
      BEGIN
        INSERT INTO public.team_time_events(org_id,shift_id,actor_user_id,action,before_record,after_record)
        VALUES(new.org_id,new.id,new.last_actor_id,new.last_action,
          CASE WHEN tg_op='UPDATE' THEN to_jsonb(old) ELSE NULL END,to_jsonb(new));
        RETURN new;
      END
      $function$
    $definition$;
    -- The trigger owner invokes this. No public direct EXECUTE surface.
    REVOKE EXECUTE ON FUNCTION tradeos_private.audit_team_time_shift() FROM PUBLIC;
  END IF;
END
$audit$;
DO $trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgrelid='public.team_time_shifts'::regclass
      AND tgname='team_time_shift_audit' AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER team_time_shift_audit AFTER INSERT OR UPDATE ON public.team_time_shifts
      FOR EACH ROW EXECUTE FUNCTION tradeos_private.audit_team_time_shift();
  END IF;
END
$trigger$;
