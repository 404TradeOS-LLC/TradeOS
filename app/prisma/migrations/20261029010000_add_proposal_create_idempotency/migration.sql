-- Proposal create retries reuse one persisted draft per project and request key.
ALTER TABLE proposals
  ADD COLUMN idempotency_key text,
  ADD COLUMN idempotency_hash text,
  ADD CONSTRAINT proposals_idempotency_pair_check
    CHECK ((idempotency_key IS NULL) = (idempotency_hash IS NULL));

CREATE UNIQUE INDEX proposals_project_id_idempotency_key_key
  ON proposals(project_id, idempotency_key);
