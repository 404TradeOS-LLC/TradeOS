-- Additive only: tenant-scoped Codes & Permits job assessment (issue #946, TODO 4).
-- No existing table is altered and no existing migration is replayed.
--
-- codes_job_assessment — one row per explicit Project/Estimate assessment:
-- proposed work type, citations with rationale, unknowns, needs-review
-- statuses, owner signoff, and audit fields. Citations are {source_id,
-- rationale} JSON arrays; source_id references a TODO 2 codes_source id (or
-- pilot registry id) by string, NOT by foreign key, so this migration
-- applies cleanly whether or not TODO 2 has landed. It does NOT depend on
-- codes_authority / codes_jurisdiction / codes_source; live jurisdiction
-- resolution against those tables is a follow-up store wiring (the matcher
-- itself needs no change), and until then matching fails closed to
-- needs_verification.
--
-- No grants to anon/authenticated: the backend's request-scoped session
-- (app.org_id / app.user_id / app.role) is the only access path, and the
-- service_role bypass used by deployments is unaffected by FORCE.
CREATE TABLE IF NOT EXISTS public.codes_job_assessment (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  estimate_id uuid REFERENCES public.estimates(id) ON DELETE CASCADE,
  work_type text NOT NULL CONSTRAINT codes_job_assessment_work_type_check CHECK (char_length(work_type) BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'needs_review' CONSTRAINT codes_job_assessment_status_check CHECK (status IN ('needs_review', 'in_review', 'owner_approved', 'needs_verification')),
  citations jsonb NOT NULL DEFAULT '[]'::jsonb CONSTRAINT codes_job_assessment_citations_check CHECK (jsonb_typeof(citations) = 'array'),
  unknowns jsonb NOT NULL DEFAULT '[]'::jsonb CONSTRAINT codes_job_assessment_unknowns_check CHECK (jsonb_typeof(unknowns) = 'array'),
  owner_signoff boolean NOT NULL DEFAULT false,
  signed_off_by text,
  signed_off_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT codes_job_assessment_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS codes_job_assessment_org_project_idx
  ON public.codes_job_assessment (org_id, project_id);
CREATE INDEX IF NOT EXISTS codes_job_assessment_org_estimate_idx
  ON public.codes_job_assessment (org_id, estimate_id);

ALTER TABLE public.codes_job_assessment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.codes_job_assessment FORCE ROW LEVEL SECURITY;

-- Tenant reads: only rows of the session's own org.
CREATE POLICY codes_job_assessment_select_policy ON public.codes_job_assessment
FOR SELECT USING (
  org_id = (SELECT public.current_app_org_id())
);

-- Tenant inserts: own org, and the parent project must belong to the same
-- org; when an estimate is given it must belong to that project and org.
-- Role gating (who may create / sign off) is enforced in the API layer;
-- RLS is the tenant-isolation floor, not the role check.
CREATE POLICY codes_job_assessment_insert_policy ON public.codes_job_assessment
FOR INSERT WITH CHECK (
  org_id = (SELECT public.current_app_org_id())
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = codes_job_assessment.project_id
      AND p.org_id = (SELECT public.current_app_org_id())
  )
  AND (
    codes_job_assessment.estimate_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.estimates e
      WHERE e.id = codes_job_assessment.estimate_id
        AND e.project_id = codes_job_assessment.project_id
        AND e.org_id = (SELECT public.current_app_org_id())
    )
  )
);

-- Tenant updates: only rows of the session's own org, and org_id may not
-- move to another tenant. The WITH CHECK enforces the same parent-reference
-- invariant as the insert policy, so a same-org row cannot be re-pointed at
-- another org's project or estimate.
CREATE POLICY codes_job_assessment_update_policy ON public.codes_job_assessment
FOR UPDATE USING (
  org_id = (SELECT public.current_app_org_id())
) WITH CHECK (
  org_id = (SELECT public.current_app_org_id())
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = codes_job_assessment.project_id
      AND p.org_id = (SELECT public.current_app_org_id())
  )
  AND (
    codes_job_assessment.estimate_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.estimates e
      WHERE e.id = codes_job_assessment.estimate_id
        AND e.project_id = codes_job_assessment.project_id
        AND e.org_id = (SELECT public.current_app_org_id())
    )
  )
);

-- Tenant deletes: only rows of the session's own org.
CREATE POLICY codes_job_assessment_delete_policy ON public.codes_job_assessment
FOR DELETE USING (
  org_id = (SELECT public.current_app_org_id())
);
