CREATE TABLE public.estimate_scope_clarifications (
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE ON UPDATE CASCADE,
  question_key text NOT NULL,
  question text NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  answer_kind text NOT NULL,
  detail text,
  PRIMARY KEY (estimate_id, question_key),
  CHECK (
    (answer_kind = 'details' AND detail IS NOT NULL AND char_length(trim(detail)) BETWEEN 1 AND 1000)
    OR (answer_kind = 'site_check_assumption' AND detail IS NULL)
  )
);

ALTER TABLE public.estimate_scope_clarifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_scope_clarifications FORCE ROW LEVEL SECURITY;

CREATE POLICY estimate_scope_clarifications_select_policy
ON public.estimate_scope_clarifications FOR SELECT
USING (
  current_app_role() IN ('owner', 'admin', 'estimator', 'dispatcher', 'technician', 'viewer')
  AND EXISTS (
    SELECT 1 FROM public.estimates e
    WHERE e.id = estimate_id AND e.org_id = current_app_org_id()
  )
);

-- Match billing.write explicitly. The shared write helper includes technicians.
CREATE POLICY estimate_scope_clarifications_insert_policy
ON public.estimate_scope_clarifications FOR INSERT
WITH CHECK (
  current_app_role() IN ('owner', 'admin', 'estimator', 'dispatcher')
  AND EXISTS (
    SELECT 1 FROM public.estimates e
    WHERE e.id = estimate_id AND e.org_id = current_app_org_id() AND e.status = 'draft'
  )
);

CREATE POLICY estimate_scope_clarifications_update_policy
ON public.estimate_scope_clarifications FOR UPDATE
USING (
  current_app_role() IN ('owner', 'admin', 'estimator', 'dispatcher')
  AND EXISTS (
    SELECT 1 FROM public.estimates e
    WHERE e.id = estimate_id AND e.org_id = current_app_org_id() AND e.status = 'draft'
  )
)
WITH CHECK (
  current_app_role() IN ('owner', 'admin', 'estimator', 'dispatcher')
  AND EXISTS (
    SELECT 1 FROM public.estimates e
    WHERE e.id = estimate_id AND e.org_id = current_app_org_id() AND e.status = 'draft'
  )
);
