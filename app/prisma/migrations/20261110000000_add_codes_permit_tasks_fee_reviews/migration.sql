-- Additive only: Codes & Permits execution tables (issue #946, TODO 5).
--
--   codes_permit_task — owner-assigned permit/inspection tasks with an
--     explicit permit number/status, official evidence attachment refs
--     only, and append-only change history. No status is ever inferred:
--     permit_status is set only by an explicit human action, and any
--     submit action requires an explicit confirm step at the API layer
--     (see CodesPermitTasksService.submit). No auto-submit exists.
--   codes_fee_review — price-neutral permit-fee review workflow
--     (quoted/verified fee -> pending -> approved/rejected). This table
--     NEVER mutates an estimate: only an approved fee with an explicitly
--     selected CostItem may ever affect estimated cost, and that effect
--     goes through the existing explicit CostItem write semantics, not
--     through this table or its service.
--
-- MERGE DEPENDENCY — READ BEFORE APPLYING: the assessment_id foreign keys
-- below reference public.codes_job_assessment, the tenant-scoped job
-- assessment table owned by TODO 4 of issue #946 (sibling branch
-- feat/codes-permits-jurisdiction-matching-946). That table does NOT exist
-- on main yet, so `prisma migrate deploy` for THIS migration FAILS until
-- TODO 4's migration lands. Merge order: #945 (pilot) -> TODO 2
-- (authority/jurisdiction/version registry) -> TODO 4 (assessment) ->
-- this PR. Do not apply this migration to staging or production before
-- TODO 4. The Prisma schema deliberately declares assessment_id as a
-- plain nullable uuid (no Prisma relation) so client generation and unit
-- tests do not depend on TODO 4's model; only this SQL enforces the FK.
--
-- No source link or AI message counts as a permit. No full model-code
-- text is stored anywhere in these tables: evidence holds official
-- attachment references only, history holds action/actor/timestamp
-- entries only.
--
-- No grants to anon/authenticated: the backend's request-scoped session
-- (app.org_id / app.user_id / app.role) is the only access path, and the
-- service_role bypass used by deployments is unaffected by FORCE.

CREATE TABLE IF NOT EXISTS public.codes_permit_task (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  assessment_id uuid REFERENCES public.codes_job_assessment(id) ON DELETE SET NULL,
  task_kind text NOT NULL CONSTRAINT codes_permit_task_task_kind_check CHECK (task_kind IN ('permit', 'inspection')),
  title text NOT NULL CONSTRAINT codes_permit_task_title_check CHECK (char_length(title) BETWEEN 1 AND 300),
  permit_number text CONSTRAINT codes_permit_task_permit_number_check CHECK (permit_number IS NULL OR char_length(permit_number) BETWEEN 1 AND 120),
  permit_status text NOT NULL DEFAULT 'not_submitted' CONSTRAINT codes_permit_task_permit_status_check CHECK (permit_status IN ('not_submitted', 'submitted', 'under_review', 'approved', 'denied', 'inspection_scheduled', 'inspection_passed', 'inspection_failed')),
  assignee_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  due_date date,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT codes_permit_task_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS codes_permit_task_org_project_idx
  ON public.codes_permit_task (org_id, project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS codes_permit_task_org_assignee_idx
  ON public.codes_permit_task (org_id, assignee_id, due_date);
CREATE INDEX IF NOT EXISTS codes_permit_task_assessment_idx
  ON public.codes_permit_task (assessment_id);

CREATE TABLE IF NOT EXISTS public.codes_fee_review (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  estimate_id uuid REFERENCES public.estimates(id) ON DELETE SET NULL,
  assessment_id uuid REFERENCES public.codes_job_assessment(id) ON DELETE SET NULL,
  fee_cents integer CONSTRAINT codes_fee_review_fee_cents_check CHECK (fee_cents IS NULL OR fee_cents >= 0),
  fee_source text CONSTRAINT codes_fee_review_fee_source_check CHECK (fee_source IS NULL OR fee_source IN ('quoted', 'verified')),
  currency text NOT NULL DEFAULT 'USD' CONSTRAINT codes_fee_review_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'pending' CONSTRAINT codes_fee_review_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  cost_item_id uuid REFERENCES public.cost_items(id) ON DELETE SET NULL,
  note text CONSTRAINT codes_fee_review_note_check CHECK (note IS NULL OR char_length(note) <= 2000),
  reviewed_by text CONSTRAINT codes_fee_review_reviewed_by_check CHECK (reviewed_by IS NULL OR char_length(reviewed_by) <= 200),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT codes_fee_review_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS codes_fee_review_org_project_idx
  ON public.codes_fee_review (org_id, project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS codes_fee_review_org_estimate_idx
  ON public.codes_fee_review (org_id, estimate_id);
CREATE INDEX IF NOT EXISTS codes_fee_review_assessment_idx
  ON public.codes_fee_review (assessment_id);

ALTER TABLE public.codes_permit_task ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.codes_permit_task FORCE ROW LEVEL SECURITY;
ALTER TABLE public.codes_fee_review ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.codes_fee_review FORCE ROW LEVEL SECURITY;

-- Permit tasks: every role in the org may read its own org's rows (the
-- service layer narrows technicians to tasks assigned to them); only
-- owner/admin may create or delete; updates are owner/admin, or the
-- assigned technician on their own task (status/evidence only, enforced
-- by the service — RLS grants the row, never the inference).
CREATE POLICY codes_permit_task_select_policy ON public.codes_permit_task
FOR SELECT USING (
  org_id = (SELECT public.current_app_org_id())
);
CREATE POLICY codes_permit_task_insert_policy ON public.codes_permit_task
FOR INSERT WITH CHECK (
  org_id = (SELECT public.current_app_org_id())
  AND (SELECT public.current_app_can_administer())
);
CREATE POLICY codes_permit_task_update_policy ON public.codes_permit_task
FOR UPDATE USING (
  org_id = (SELECT public.current_app_org_id())
  AND (
    (SELECT public.current_app_can_administer())
    OR (assignee_id = (SELECT public.current_app_user_id()))
  )
) WITH CHECK (
  org_id = (SELECT public.current_app_org_id())
  AND (
    (SELECT public.current_app_can_administer())
    OR (assignee_id = (SELECT public.current_app_user_id()))
  )
);
CREATE POLICY codes_permit_task_delete_policy ON public.codes_permit_task
FOR DELETE USING (
  org_id = (SELECT public.current_app_org_id())
  AND (SELECT public.current_app_can_administer())
);

-- Fee reviews: reads are org-scoped for every role (technicians review
-- fees read-only); every write is owner/admin only. A rejected or pending
-- fee, or one with no explicitly selected CostItem, is a financial no-op
-- by construction — no policy here ever writes to estimates.
CREATE POLICY codes_fee_review_select_policy ON public.codes_fee_review
FOR SELECT USING (
  org_id = (SELECT public.current_app_org_id())
);
CREATE POLICY codes_fee_review_insert_policy ON public.codes_fee_review
FOR INSERT WITH CHECK (
  org_id = (SELECT public.current_app_org_id())
  AND (SELECT public.current_app_can_administer())
);
CREATE POLICY codes_fee_review_update_policy ON public.codes_fee_review
FOR UPDATE USING (
  org_id = (SELECT public.current_app_org_id())
  AND (SELECT public.current_app_can_administer())
) WITH CHECK (
  org_id = (SELECT public.current_app_org_id())
  AND (SELECT public.current_app_can_administer())
);
CREATE POLICY codes_fee_review_delete_policy ON public.codes_fee_review
FOR DELETE USING (
  org_id = (SELECT public.current_app_org_id())
  AND (SELECT public.current_app_can_administer())
);
