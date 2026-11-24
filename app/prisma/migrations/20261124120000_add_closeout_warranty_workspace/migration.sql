-- S069 closeout and warranty workspace. Additive only: three new tables,
-- no existing table is altered and no existing row is touched.
--
-- PunchItem is the project's explicit unresolved-items list; ProjectCloseout
-- is the single per-project handoff record (one row per project); a
-- WarrantyRecord organizes only a warranty the contractor actually gave —
-- coverageText is staff-supplied and must quote the source document. There
-- is no default or invented coverage term, and no warranty given means no
-- WarrantyRecord row. No closeout operation ever mutates a Contract,
-- Proposal, Invoice, or Estimate row.
--
-- All three tables carry a direct org_id (like job_expenses) with forced
-- RLS. The write policies follow the jobs/job_expenses split-policy shape
-- rather than a bare current_app_can_write() FOR ALL policy, for two
-- reasons. First, the service contract authorizes two writes that the
-- helper's original owner/admin/estimator meaning would deny at the
-- database boundary — dispatcher writes (the closeout manager role, which
-- holds crm.write in app/domain/contracts.ts) and the assigned
-- technician's punch resolve (the only technician write in this
-- workspace). Second, the deployed helper no longer means
-- owner/admin/estimator: migration 20260706120000 redefined
-- current_app_can_write() to include dispatcher AND technician, so using
-- it here would let any technician insert punch items and write closeouts
-- and warranties — the RLS integration test caught exactly that (a
-- technician INSERT succeeded). The manager role list is therefore spelled
-- out explicitly as current_app_role() IN ('owner', 'admin', 'estimator',
-- 'dispatcher') in every write policy below; do NOT "simplify" these back
-- to current_app_can_write(). The policies widen writes only to exactly
-- those service-authorized actors; no new role or permission is introduced,
-- and technicians may update only a punch item assigned to them. Reads stay
-- org-scoped for every role. Every write policy also requires each
-- referenced parent to belong to the caller's organization — the project
-- always, and the job / contract / invoice where one is referenced — via
-- an EXISTS check on the parent's org. org_id alone cannot prove that:
-- PostgreSQL foreign-key checks bypass RLS, so a row carrying the caller's
-- org_id with a foreign project_id would otherwise pass the policy. The
-- job check goes through app_job_belongs_to_caller_org() (defined below):
-- jobs are assignment-scoped for non-admins, so a plain EXISTS on jobs
-- would deny service-authorized writes by dispatchers and punch-assigned
-- technicians who were not dispatched to the job.
-- No grants to anon/authenticated: the backend's request-scoped session
-- (app.org_id / app.user_id / app.role) is the only access path.

CREATE TABLE IF NOT EXISTS public.punch_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  title text NOT NULL CONSTRAINT punch_items_title_check CHECK (char_length(title) >= 1),
  description text NOT NULL DEFAULT '' CONSTRAINT punch_items_description_check CHECK (char_length(description) <= 5000),
  status text NOT NULL DEFAULT 'open' CONSTRAINT punch_items_status_check CHECK (status IN ('open', 'in_progress', 'resolved', 'verified')),
  priority text NOT NULL DEFAULT 'medium' CONSTRAINT punch_items_priority_check CHECK (priority IN ('low', 'medium', 'high')),
  assigned_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_to text,
  due_date timestamptz,
  resolved_at timestamptz,
  resolved_by_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT punch_items_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS punch_items_org_project_idx
  ON public.punch_items (org_id, project_id);
CREATE INDEX IF NOT EXISTS punch_items_project_status_idx
  ON public.punch_items (project_id, status);
CREATE INDEX IF NOT EXISTS punch_items_job_status_idx
  ON public.punch_items (job_id, status);
CREATE INDEX IF NOT EXISTS punch_items_assigned_user_status_idx
  ON public.punch_items (assigned_user_id, status);

CREATE TABLE IF NOT EXISTS public.project_closeouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CONSTRAINT project_closeouts_status_check CHECK (status IN ('draft', 'ready', 'handed_off')),
  notes text,
  completed_at timestamptz,
  completed_by_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  handed_off_at timestamptz,
  handed_off_by_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_closeouts_pkey PRIMARY KEY (id),
  CONSTRAINT project_closeouts_project_id_key UNIQUE (project_id)
);
CREATE INDEX IF NOT EXISTS project_closeouts_org_project_idx
  ON public.project_closeouts (org_id, project_id);

CREATE TABLE IF NOT EXISTS public.warranty_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  title text NOT NULL CONSTRAINT warranty_records_title_check CHECK (char_length(title) >= 1),
  coverage_text text NOT NULL CONSTRAINT warranty_records_coverage_text_check CHECK (char_length(coverage_text) >= 1),
  source_type text NOT NULL CONSTRAINT warranty_records_source_type_check CHECK (source_type IN ('contract', 'invoice', 'other')),
  source_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT warranty_records_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS warranty_records_org_project_idx
  ON public.warranty_records (org_id, project_id);
CREATE INDEX IF NOT EXISTS warranty_records_project_idx
  ON public.warranty_records (project_id);
CREATE INDEX IF NOT EXISTS warranty_records_contract_idx
  ON public.warranty_records (contract_id);
CREATE INDEX IF NOT EXISTS warranty_records_invoice_idx
  ON public.warranty_records (invoice_id);

-- Forced RLS on all three tables.
ALTER TABLE public.punch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.punch_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.project_closeouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_closeouts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_records FORCE ROW LEVEL SECURITY;

-- Parent-ownership probe for jobs. The project / contract / invoice
-- checks below are plain EXISTS subqueries because those parents are
-- org-visible to every role (projects is org-scoped; contracts and
-- invoices compose through projects). Jobs is different: its SELECT
-- policy hides a job from anyone who is neither an administrator nor
-- assigned to it, so a plain EXISTS on jobs would deny
-- service-authorized writes — the assigned technician resolving their
-- punch item, a dispatcher creating or updating a closeout linked to a
-- job they were not dispatched to. This probe answers only whether the
-- job belongs to the caller's session organization, bypassing the
-- caller's row visibility (SECURITY DEFINER, owner postgres). It is
-- read-only, STABLE, pins search_path, and reveals nothing cross-org:
-- it returns false for any job outside the caller's own org, exactly as
-- a not-found would. It is deliberately left with the default PUBLIC
-- execute grant: migrations run before role provisioning in
-- scripts/deploy-migrations.sh, so a GRANT TO tradeos_app here would
-- fail on a fresh database.
CREATE OR REPLACE FUNCTION public.app_job_belongs_to_caller_org(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = p_job_id
      AND jobs.org_id = (SELECT current_app_org_id())
  );
$$;

-- Portal completion probe for the closeout checklist. A portal_customer
-- session cannot read jobs at all (jobs_select_policy permits only
-- administrators and actively assigned users), so a portal checklist
-- computed from a plain jobs read would always report the completed-job
-- artifact missing — a handed-off project would show ready: false to its
-- own customer. This probe answers only which completed jobs belong to
-- the caller's project, bypassing the caller's row visibility (SECURITY
-- DEFINER, owner postgres) exactly like app_job_belongs_to_caller_org
-- above — verified live: under a portal_customer session a direct jobs
-- read returns zero rows while this probe returns the project's
-- completed jobs. It is read-only, STABLE, pins search_path, and reveals
-- nothing cross-org or cross-customer: for a portal session it answers
-- only for a project owned by the portal customer (the EXISTS on
-- projects enforces that in the function body, not via RLS); for staff
-- it answers for the caller's own org. It returns the completed job ids
-- (an empty array when none) so the checklist keeps its { count, ids }
-- shape. It is deliberately left with the default PUBLIC execute grant,
-- like app_job_belongs_to_caller_org: migrations run before role
-- provisioning in scripts/deploy-migrations.sh, so a GRANT TO
-- tradeos_app here would fail on a fresh database. Only the portal
-- checklist path and the portal closeout document's job query call it —
-- staff paths keep the plain jobs read.
CREATE OR REPLACE FUNCTION public.app_completed_job_ids_for_project(p_project_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(jobs.id), '{}'::uuid[])
  FROM public.jobs
  WHERE jobs.project_id = p_project_id
    AND jobs.org_id = (SELECT current_app_org_id())
    AND jobs.status = 'completed'
    AND (
      (SELECT current_app_role()) <> 'portal_customer'
      OR EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = p_project_id
          AND projects.org_id = (SELECT current_app_org_id())
          AND projects.customer_id = (SELECT public.current_app_portal_customer_id())::uuid
      )
    );
$$;

-- Punch items: org-scoped reads for every role. Writes are staff-manager
-- roles (owner/admin/dispatcher, plus legacy estimator — spelled out
-- explicitly, NOT via current_app_can_write(), which the deployed
-- 20260706120000 definition widened to include technician); the one
-- field-staff write — the assigned technician resolving their own punch
-- item — is the update carve-out,
-- mirroring the jobs/job_expenses assigned-technician update shape. A
-- technician may update only a punch item assigned to them, and the
-- WITH CHECK pins the row to that same assignee so the assignment itself
-- cannot be moved by a technician write.
CREATE POLICY punch_items_select_policy ON public.punch_items
FOR SELECT USING (
  org_id = (SELECT current_app_org_id())
);

-- A portal session may read only the rows of its own customer's
-- projects. The org-scoped SELECT policy above stays the permissive
-- staff policy; this restrictive policy adds the customer predicate only
-- for the portal role, replicating the projects/customers portal-scope
-- pattern from 20260828150000_add_customer_portal_identity (the project
-- join is the same shape the contract/invoice portal policies use).
-- Without it a portal_customer session could read every customer's punch
-- items in the organization.
CREATE POLICY punch_items_customer_portal_scope_policy ON public.punch_items
AS RESTRICTIVE FOR SELECT USING (
  (SELECT public.current_app_role()) <> 'portal_customer'
  OR EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = punch_items.project_id
      AND projects.org_id = (SELECT current_app_org_id())
      AND projects.customer_id = (SELECT public.current_app_portal_customer_id())::uuid
  )
);

CREATE POLICY punch_items_insert_policy ON public.punch_items
FOR INSERT WITH CHECK (
  org_id = (SELECT current_app_org_id())
  AND (current_app_role() IN ('owner', 'admin', 'estimator', 'dispatcher'))
  AND EXISTS (SELECT 1 FROM public.projects WHERE projects.id = punch_items.project_id AND projects.org_id = (SELECT current_app_org_id()))
  AND (punch_items.job_id IS NULL OR public.app_job_belongs_to_caller_org(punch_items.job_id))
);

CREATE POLICY punch_items_update_policy ON public.punch_items
FOR UPDATE USING (
  org_id = (SELECT current_app_org_id())
  AND (
    current_app_role() IN ('owner', 'admin', 'estimator', 'dispatcher')
    OR (current_app_role() = 'technician' AND assigned_user_id = current_app_user_id())
  )
  AND EXISTS (SELECT 1 FROM public.projects WHERE projects.id = punch_items.project_id AND projects.org_id = (SELECT current_app_org_id()))
  AND (punch_items.job_id IS NULL OR public.app_job_belongs_to_caller_org(punch_items.job_id))
) WITH CHECK (
  org_id = (SELECT current_app_org_id())
  AND (
    current_app_role() IN ('owner', 'admin', 'estimator', 'dispatcher')
    OR (current_app_role() = 'technician' AND assigned_user_id = current_app_user_id())
  )
  AND EXISTS (SELECT 1 FROM public.projects WHERE projects.id = punch_items.project_id AND projects.org_id = (SELECT current_app_org_id()))
  AND (punch_items.job_id IS NULL OR public.app_job_belongs_to_caller_org(punch_items.job_id))
);

CREATE POLICY punch_items_delete_policy ON public.punch_items
FOR DELETE USING (
  org_id = (SELECT current_app_org_id())
  AND (current_app_role() IN ('owner', 'admin', 'estimator', 'dispatcher'))
);

-- Project closeouts: org-scoped reads for every role; writes are the
-- staff-manager roles only (owner/admin/dispatcher, plus legacy estimator
-- — spelled out explicitly, NOT via current_app_can_write()).
CREATE POLICY project_closeouts_select_policy ON public.project_closeouts
FOR SELECT USING (
  org_id = (SELECT current_app_org_id())
);

-- Portal customer scope: see punch_items_customer_portal_scope_policy
-- above — a portal session reads only its own customer's projects.
CREATE POLICY project_closeouts_customer_portal_scope_policy ON public.project_closeouts
AS RESTRICTIVE FOR SELECT USING (
  (SELECT public.current_app_role()) <> 'portal_customer'
  OR EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_closeouts.project_id
      AND projects.org_id = (SELECT current_app_org_id())
      AND projects.customer_id = (SELECT public.current_app_portal_customer_id())::uuid
  )
);

CREATE POLICY project_closeouts_insert_policy ON public.project_closeouts
FOR INSERT WITH CHECK (
  org_id = (SELECT current_app_org_id())
  AND (current_app_role() IN ('owner', 'admin', 'estimator', 'dispatcher'))
  AND EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_closeouts.project_id AND projects.org_id = (SELECT current_app_org_id()))
  AND (project_closeouts.job_id IS NULL OR public.app_job_belongs_to_caller_org(project_closeouts.job_id))
);

CREATE POLICY project_closeouts_update_policy ON public.project_closeouts
FOR UPDATE USING (
  org_id = (SELECT current_app_org_id())
  AND (current_app_role() IN ('owner', 'admin', 'estimator', 'dispatcher'))
  AND EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_closeouts.project_id AND projects.org_id = (SELECT current_app_org_id()))
  AND (project_closeouts.job_id IS NULL OR public.app_job_belongs_to_caller_org(project_closeouts.job_id))
) WITH CHECK (
  org_id = (SELECT current_app_org_id())
  AND (current_app_role() IN ('owner', 'admin', 'estimator', 'dispatcher'))
  AND EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_closeouts.project_id AND projects.org_id = (SELECT current_app_org_id()))
  AND (project_closeouts.job_id IS NULL OR public.app_job_belongs_to_caller_org(project_closeouts.job_id))
);

CREATE POLICY project_closeouts_delete_policy ON public.project_closeouts
FOR DELETE USING (
  org_id = (SELECT current_app_org_id())
  AND (current_app_role() IN ('owner', 'admin', 'estimator', 'dispatcher'))
);

-- Warranty records: org-scoped reads for every role; writes are the
-- staff-manager roles only (owner/admin/dispatcher, plus legacy estimator
-- — spelled out explicitly, NOT via current_app_can_write()).
CREATE POLICY warranty_records_select_policy ON public.warranty_records
FOR SELECT USING (
  org_id = (SELECT current_app_org_id())
);

-- Portal customer scope: see punch_items_customer_portal_scope_policy
-- above — a portal session reads only its own customer's projects.
CREATE POLICY warranty_records_customer_portal_scope_policy ON public.warranty_records
AS RESTRICTIVE FOR SELECT USING (
  (SELECT public.current_app_role()) <> 'portal_customer'
  OR EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = warranty_records.project_id
      AND projects.org_id = (SELECT current_app_org_id())
      AND projects.customer_id = (SELECT public.current_app_portal_customer_id())::uuid
  )
);

CREATE POLICY warranty_records_insert_policy ON public.warranty_records
FOR INSERT WITH CHECK (
  org_id = (SELECT current_app_org_id())
  AND (current_app_role() IN ('owner', 'admin', 'estimator', 'dispatcher'))
  AND EXISTS (SELECT 1 FROM public.projects WHERE projects.id = warranty_records.project_id AND projects.org_id = (SELECT current_app_org_id()))
  AND (warranty_records.job_id IS NULL OR public.app_job_belongs_to_caller_org(warranty_records.job_id))
  AND (warranty_records.contract_id IS NULL OR EXISTS (SELECT 1 FROM public.contracts JOIN public.projects ON projects.id = contracts.project_id WHERE contracts.id = warranty_records.contract_id AND projects.org_id = (SELECT current_app_org_id())))
  AND (warranty_records.invoice_id IS NULL OR EXISTS (SELECT 1 FROM public.invoices JOIN public.projects ON projects.id = invoices.project_id WHERE invoices.id = warranty_records.invoice_id AND projects.org_id = (SELECT current_app_org_id())))
);

CREATE POLICY warranty_records_update_policy ON public.warranty_records
FOR UPDATE USING (
  org_id = (SELECT current_app_org_id())
  AND (current_app_role() IN ('owner', 'admin', 'estimator', 'dispatcher'))
  AND EXISTS (SELECT 1 FROM public.projects WHERE projects.id = warranty_records.project_id AND projects.org_id = (SELECT current_app_org_id()))
  AND (warranty_records.job_id IS NULL OR public.app_job_belongs_to_caller_org(warranty_records.job_id))
  AND (warranty_records.contract_id IS NULL OR EXISTS (SELECT 1 FROM public.contracts JOIN public.projects ON projects.id = contracts.project_id WHERE contracts.id = warranty_records.contract_id AND projects.org_id = (SELECT current_app_org_id())))
  AND (warranty_records.invoice_id IS NULL OR EXISTS (SELECT 1 FROM public.invoices JOIN public.projects ON projects.id = invoices.project_id WHERE invoices.id = warranty_records.invoice_id AND projects.org_id = (SELECT current_app_org_id())))
) WITH CHECK (
  org_id = (SELECT current_app_org_id())
  AND (current_app_role() IN ('owner', 'admin', 'estimator', 'dispatcher'))
  AND EXISTS (SELECT 1 FROM public.projects WHERE projects.id = warranty_records.project_id AND projects.org_id = (SELECT current_app_org_id()))
  AND (warranty_records.job_id IS NULL OR public.app_job_belongs_to_caller_org(warranty_records.job_id))
  AND (warranty_records.contract_id IS NULL OR EXISTS (SELECT 1 FROM public.contracts JOIN public.projects ON projects.id = contracts.project_id WHERE contracts.id = warranty_records.contract_id AND projects.org_id = (SELECT current_app_org_id())))
  AND (warranty_records.invoice_id IS NULL OR EXISTS (SELECT 1 FROM public.invoices JOIN public.projects ON projects.id = invoices.project_id WHERE invoices.id = warranty_records.invoice_id AND projects.org_id = (SELECT current_app_org_id())))
);

CREATE POLICY warranty_records_delete_policy ON public.warranty_records
FOR DELETE USING (
  org_id = (SELECT current_app_org_id())
  AND (current_app_role() IN ('owner', 'admin', 'estimator', 'dispatcher'))
);
