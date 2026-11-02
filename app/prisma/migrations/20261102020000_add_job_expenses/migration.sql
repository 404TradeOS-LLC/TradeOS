-- Additive only: actual job costs (v1). No existing table is altered.
-- Amounts are integer cents so totals are exact; the API never accepts
-- fractional cents. Category reuses the estimate cost-type vocabulary
-- (labor, material, equipment, disposal, subcontractor, other) so actuals
-- roll up against estimate line items without a second taxonomy.
-- incurred_on is a calendar date (stored as timestamptz at UTC midnight).
-- No grants to anon/authenticated: the backend's request-scoped session
-- (app.org_id / app.user_id / app.role) is the only access path, and the
-- service_role bypass used by deployments is unaffected by FORCE.
CREATE TABLE IF NOT EXISTS public.job_expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CONSTRAINT job_expenses_amount_cents_check CHECK (amount_cents > 0),
  category text NOT NULL CONSTRAINT job_expenses_category_check CHECK (category IN ('labor', 'material', 'equipment', 'disposal', 'subcontractor', 'other')),
  vendor text NOT NULL DEFAULT '' CONSTRAINT job_expenses_vendor_check CHECK (char_length(vendor) <= 200),
  receipt_note text NOT NULL DEFAULT '' CONSTRAINT job_expenses_receipt_note_check CHECK (char_length(receipt_note) <= 2000),
  incurred_on timestamptz NOT NULL,
  created_by_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_expenses_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS job_expenses_org_job_idx
  ON public.job_expenses (org_id, job_id);
CREATE INDEX IF NOT EXISTS job_expenses_job_incurred_idx
  ON public.job_expenses (job_id, incurred_on DESC);

-- Organization scope is inherited through the job join (mirroring the jobs
-- table's own visibility): office administrators see every job in the org,
-- other roles see only jobs they are actively assigned to. Write access
-- follows the same visibility: office roles (owner/admin/dispatcher) plus
-- technicians assigned to the job, so field staff can record costs on site.
ALTER TABLE public.job_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_expenses FORCE ROW LEVEL SECURITY;

CREATE POLICY job_expenses_select_policy ON public.job_expenses
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_expenses.job_id
      AND j.org_id = (SELECT current_app_org_id())
      AND (
        current_app_can_administer()
        OR EXISTS (
          SELECT 1 FROM public.job_assignments a
          WHERE a.job_id = j.id
            AND a.user_id = current_app_user_id()
            AND a.removed_at IS NULL
        )
      )
  )
);

CREATE POLICY job_expenses_insert_policy ON public.job_expenses
FOR INSERT WITH CHECK (
  org_id = (SELECT current_app_org_id())
  AND EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_expenses.job_id
      AND j.org_id = (SELECT current_app_org_id())
      AND (
        current_app_role() IN ('owner', 'admin', 'dispatcher')
        OR EXISTS (
          SELECT 1 FROM public.job_assignments a
          WHERE a.job_id = j.id
            AND a.user_id = current_app_user_id()
            AND a.removed_at IS NULL
        )
      )
  )
);

CREATE POLICY job_expenses_update_policy ON public.job_expenses
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_expenses.job_id
      AND j.org_id = (SELECT current_app_org_id())
      AND (
        current_app_can_administer()
        OR EXISTS (
          SELECT 1 FROM public.job_assignments a
          WHERE a.job_id = j.id
            AND a.user_id = current_app_user_id()
            AND a.removed_at IS NULL
        )
      )
  )
) WITH CHECK (
  org_id = (SELECT current_app_org_id())
  AND EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_expenses.job_id
      AND j.org_id = (SELECT current_app_org_id())
      AND (
        current_app_can_administer()
        OR EXISTS (
          SELECT 1 FROM public.job_assignments a
          WHERE a.job_id = j.id
            AND a.user_id = current_app_user_id()
            AND a.removed_at IS NULL
        )
      )
  )
);

CREATE POLICY job_expenses_delete_policy ON public.job_expenses
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_expenses.job_id
      AND j.org_id = (SELECT current_app_org_id())
      AND (
        current_app_can_administer()
        OR EXISTS (
          SELECT 1 FROM public.job_assignments a
          WHERE a.job_id = j.id
            AND a.user_id = current_app_user_id()
            AND a.removed_at IS NULL
        )
      )
  )
);
