-- Rehearse on a disposable copy and use a coordinated invoice-write window:
-- the unique index is built transactionally and may block invoice traffic.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE invoices
  ADD COLUMN create_request_key text,
  ADD COLUMN create_request_hash text,
  ADD CONSTRAINT invoices_create_request_pair_check
    CHECK ((create_request_key IS NULL) = (create_request_hash IS NULL)) NOT VALID;

CREATE UNIQUE INDEX invoices_project_create_request_key
  ON invoices(project_id, create_request_key);
COMMIT;
