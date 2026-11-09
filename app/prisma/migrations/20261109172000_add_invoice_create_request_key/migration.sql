-- Nullable fields keep existing invoices and unkeyed writers compatible.
ALTER TABLE invoices
  ADD COLUMN create_request_key text,
  ADD COLUMN create_request_hash text,
  ADD CONSTRAINT invoices_create_request_pair_check
    CHECK ((create_request_key IS NULL) = (create_request_hash IS NULL));

CREATE UNIQUE INDEX invoices_project_create_request_key
  ON invoices(project_id, create_request_key);
