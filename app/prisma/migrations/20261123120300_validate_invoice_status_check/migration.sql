-- DES-7 (c): validate the widened invoices_status_check installed by
-- 20261123120200. Validated separately from installation so PostgreSQL can
-- use the lower-lock VALIDATE CONSTRAINT path for the scan (same shape as
-- the proposal-declined precedent, 20260822211000).
alter table invoices validate constraint invoices_status_check;
