-- Athena daily Gemini spend cap (founder-approved 2026-11-26). Additive only:
-- one read-only function, no table altered, no existing row touched.
--
-- The spend cap must be enforced per organization, but the generation-runs
-- SELECT policy is actor-scoped (administrators see all rows, other members
-- see only their own). A plain generation-runs read from the kernel would
-- therefore give every non-admin actor a separate $1 budget: after an owner
-- exhausts the org's budget, a technician with no personal spend would still
-- see $0 and keep making paid calls. This function answers only the org-wide
-- total for the caller's own session organization, bypassing the caller's row
-- visibility (SECURITY DEFINER, owner postgres) exactly like
-- app_job_belongs_to_caller_org in
-- 20261124120000_add_closeout_warranty_workspace. It is read-only, STABLE,
-- pins search_path, and reveals nothing cross-org: the org comes from the
-- session (current_app_org_id()), never from an untrusted argument — the
-- p_org_id argument must equal the session org or the call raises 42501, so
-- a caller can never ask for another org's spend, and a call with no session
-- org raises instead of silently returning 0 (fail closed).
--
-- The sum covers chargeable attempts, not just successful drafts: status
-- 'succeeded' plus status 'failed' rows that carry a non-null estimatedUsd
-- (a safety-blocked or empty Gemini response still consumes input tokens;
-- the kernel persists those as failed rows with their usage, so blocked
-- attempts count toward the cap instead of burning spend invisibly).
--
-- It is deliberately left with the default PUBLIC execute grant, like
-- app_job_belongs_to_caller_org: migrations run before role provisioning in
-- scripts/deploy-migrations.sh, so a GRANT TO tradeos_app here would fail on
-- a fresh database; provision-app-role.sql grants execute on all public
-- functions to tradeos_app on every deploy.

CREATE OR REPLACE FUNCTION public.athena_org_daily_spend_usd(
  p_org_id uuid,
  p_day_start timestamptz,
  p_day_end timestamptz
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF public.current_app_org_id() IS NULL
     OR public.current_app_org_id() IS DISTINCT FROM p_org_id THEN
    RAISE EXCEPTION 'Athena spend lookup requires the caller''s own organization session'
      USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT COALESCE(SUM(estimated_usd), 0)
    FROM public.athena_generation_runs
    WHERE org_id = p_org_id
      AND status IN ('succeeded', 'failed')
      AND created_at >= p_day_start
      AND created_at < p_day_end
      AND estimated_usd IS NOT NULL
  );
END;
$function$;
