-- Additive expansion of first-party Job Expenses. No prior expense is
-- deleted or reclassified. Existing rows default to USD and contractor-paid.
SET lock_timeout = '5s';

ALTER TABLE public.job_expenses
  ADD COLUMN currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN description text NOT NULL DEFAULT '',
  ADD COLUMN receipt_storage_path text,
  ADD COLUMN receipt_file_name text,
  ADD COLUMN receipt_content_type text,
  ADD COLUMN receipt_size_bytes integer,
  ADD COLUMN idempotency_key uuid,
  ADD COLUMN voided_at timestamptz,
  ADD COLUMN voided_by_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  ADD COLUMN void_reason text NOT NULL DEFAULT '';

ALTER TABLE public.job_expenses
  ADD CONSTRAINT job_expenses_currency_check CHECK (currency = 'USD') NOT VALID,
  ADD CONSTRAINT job_expenses_description_check CHECK (char_length(description) <= 2000) NOT VALID,
  ADD CONSTRAINT job_expenses_void_reason_check CHECK (char_length(void_reason) <= 500) NOT VALID,
  ADD CONSTRAINT job_expenses_receipt_metadata_check CHECK (
    (receipt_storage_path IS NULL AND receipt_file_name IS NULL AND receipt_content_type IS NULL AND receipt_size_bytes IS NULL)
    OR (receipt_storage_path IS NOT NULL AND receipt_file_name IS NOT NULL
        AND receipt_content_type IN ('image/png', 'image/jpeg', 'application/pdf')
        AND receipt_size_bytes BETWEEN 1 AND 6291456
        AND char_length(receipt_storage_path) <= 500
        AND char_length(receipt_file_name) BETWEEN 1 AND 200)
  ) NOT VALID,
  ADD CONSTRAINT job_expenses_void_consistency_check CHECK (
    (voided_at IS NULL AND voided_by_id IS NULL) OR
    (voided_at IS NOT NULL AND voided_by_id IS NOT NULL)
  ) NOT VALID;

CREATE UNIQUE INDEX job_expenses_org_job_idempotency_key_idx
  ON public.job_expenses (org_id, job_id, idempotency_key);
CREATE INDEX job_expenses_org_job_voided_idx
  ON public.job_expenses (org_id, job_id, voided_at);

-- Audit is append-only. Existing Job Expense row-level visibility rules
-- remain authoritative, and event SELECT/INSERT both check the job owner.
CREATE TABLE public.job_expense_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  expense_id uuid NOT NULL REFERENCES public.job_expenses(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('created', 'updated', 'receipt_linked', 'voided')),
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_expense_events_org_job_expense_created_idx
  ON public.job_expense_events (org_id, job_id, expense_id, created_at);

ALTER TABLE public.job_expense_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_expense_events FORCE ROW LEVEL SECURITY;

CREATE POLICY job_expense_events_select_policy ON public.job_expense_events
FOR SELECT USING (
  org_id = (SELECT current_app_org_id())
  AND EXISTS (
    SELECT 1 FROM public.job_expenses e
    JOIN public.jobs j ON j.id = e.job_id
    WHERE e.id = job_expense_events.expense_id
      AND e.org_id = job_expense_events.org_id
      AND e.job_id = job_expense_events.job_id
      AND j.org_id = (SELECT current_app_org_id())
      AND (current_app_can_administer() OR EXISTS (
        SELECT 1 FROM public.job_assignments a
        WHERE a.job_id = j.id
          AND a.user_id = current_app_user_id()
          AND a.removed_at IS NULL
          AND a.declined_at IS NULL
      ))
  )
);

CREATE POLICY job_expense_events_insert_policy ON public.job_expense_events
FOR INSERT WITH CHECK (
  org_id = (SELECT current_app_org_id())
  AND actor_user_id = current_app_user_id()
  AND EXISTS (
    SELECT 1 FROM public.job_expenses e
    JOIN public.jobs j ON j.id = e.job_id
    WHERE e.id = job_expense_events.expense_id
      AND e.org_id = job_expense_events.org_id
      AND e.job_id = job_expense_events.job_id
      AND j.org_id = (SELECT current_app_org_id())
      AND (current_app_role() IN ('owner', 'admin', 'dispatcher') OR EXISTS (
        SELECT 1 FROM public.job_assignments a
        WHERE a.job_id = j.id
          AND a.user_id = current_app_user_id()
          AND a.removed_at IS NULL
          AND a.declined_at IS NULL
      ))
  )
);
-- No UPDATE or DELETE policies for expense events.
RESET lock_timeout;
