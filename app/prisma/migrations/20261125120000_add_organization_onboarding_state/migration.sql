-- DES-3 slice 2: persisted onboarding state. Additive only: one new table,
-- no existing table is altered and no existing row is touched.
--
-- OrganizationOnboardingState is the single per-organization onboarding
-- record (one row per org). Slice 1 kept the wizard session-scoped and
-- recorded completion only through the draft estimate it created, with skip
-- as a browser-scoped cookie. This table persists the wizard itself:
-- - status: in_progress (resuming), skipped (org-scoped skip, replacing
--   the cookie), completed (a draft estimate was built).
-- - current_step / work_types / scope_text: resume where the org left off.
-- - labor_rate_cents / region: the labor baseline ($48/hr default) and
--   optional region the wizard collects. They are defaults for the org's
--   first estimate, pre-filled on resume and returned by GET /state for
--   future estimate-flow consumers. They are NOT copied onto
--   organizations.default_labor_rate / region_code: those are owner-managed
--   settings values (settings UI / provisioning), and the estimate engine
--   reads neither today — wiring the engine to the persisted baseline is a
--   follow-up slice, not this one.
--
-- The table carries a direct org_id (like project_closeouts) with forced
-- RLS. The write policies spell the manager role list out explicitly as
-- current_app_role() IN ('owner', 'admin', 'estimator', 'dispatcher') —
-- the same shape as the S069 closeout policies — and do NOT use
-- current_app_can_write(): migration 20260706120000 redefined that helper
-- to include dispatcher AND technician, so using it here would let any
-- technician write onboarding state. Reads stay org-scoped for every
-- role. No grants to anon/authenticated: the backend's request-scoped
-- session (app.org_id / app.user_id / app.role) is the only access path.

CREATE TABLE IF NOT EXISTS public.organization_onboarding_states (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'in_progress' CONSTRAINT organization_onboarding_states_status_check CHECK (status IN ('in_progress', 'skipped', 'completed')),
  current_step smallint NOT NULL DEFAULT 1 CONSTRAINT organization_onboarding_states_current_step_check CHECK (current_step IN (1, 2)),
  work_types text[] NOT NULL DEFAULT '{}'::text[],
  scope_text text CONSTRAINT organization_onboarding_states_scope_text_check CHECK (scope_text IS NULL OR char_length(scope_text) <= 10000),
  labor_rate_cents integer CONSTRAINT organization_onboarding_states_labor_rate_cents_check CHECK (labor_rate_cents IS NULL OR (labor_rate_cents >= 100 AND labor_rate_cents <= 50000)),
  region text CONSTRAINT organization_onboarding_states_region_check CHECK (region IS NULL OR char_length(region) <= 120),
  skipped_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_onboarding_states_pkey PRIMARY KEY (id),
  CONSTRAINT organization_onboarding_states_org_id_key UNIQUE (org_id)
);
CREATE INDEX IF NOT EXISTS organization_onboarding_states_org_idx
  ON public.organization_onboarding_states (org_id);

-- Forced RLS on the new table.
ALTER TABLE public.organization_onboarding_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_onboarding_states FORCE ROW LEVEL SECURITY;

-- Org-scoped reads for every role; writes are the staff-manager roles
-- only (owner/admin/dispatcher, plus legacy estimator — spelled out
-- explicitly, NOT via current_app_can_write()).
CREATE POLICY organization_onboarding_states_select_policy ON public.organization_onboarding_states
FOR SELECT USING (
  org_id = (SELECT current_app_org_id())
);

CREATE POLICY organization_onboarding_states_insert_policy ON public.organization_onboarding_states
FOR INSERT WITH CHECK (
  org_id = (SELECT current_app_org_id())
  AND (current_app_role() IN ('owner', 'admin', 'estimator', 'dispatcher'))
);

CREATE POLICY organization_onboarding_states_update_policy ON public.organization_onboarding_states
FOR UPDATE USING (
  org_id = (SELECT current_app_org_id())
  AND (current_app_role() IN ('owner', 'admin', 'estimator', 'dispatcher'))
) WITH CHECK (
  org_id = (SELECT current_app_org_id())
  AND (current_app_role() IN ('owner', 'admin', 'estimator', 'dispatcher'))
);

CREATE POLICY organization_onboarding_states_delete_policy ON public.organization_onboarding_states
FOR DELETE USING (
  org_id = (SELECT current_app_org_id())
  AND (current_app_role() IN ('owner', 'admin', 'estimator', 'dispatcher'))
);
