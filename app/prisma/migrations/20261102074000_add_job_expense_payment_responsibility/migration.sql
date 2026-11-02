-- Additive follow-up to the job_expenses baseline. Existing records retain
-- their prior contractor-cost behavior, while future customer-paid purchases
-- can be recorded separately without inflating the contractor's actual costs.
-- This does not change existing RLS policies, grants or tenant boundaries.
-- The CHECK applies to new and updated rows immediately. Historical rows
-- require a separately approved VALIDATE CONSTRAINT deployment step after
-- confirming locks and migration ledger on staging; do not validate here.
SET lock_timeout = '5s';

ALTER TABLE public.job_expenses
  ADD COLUMN IF NOT EXISTS payment_responsibility text NOT NULL DEFAULT 'contractor';

ALTER TABLE public.job_expenses
  ADD CONSTRAINT job_expenses_payment_responsibility_check
  CHECK (payment_responsibility IN ('contractor', 'customer')) NOT VALID;

RESET lock_timeout;
