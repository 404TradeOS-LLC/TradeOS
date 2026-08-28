-- An executed contract must retain the agreed commercial value and the
-- document content that was presented for signature.
alter table contracts
  add column contract_amount numeric(14,2),
  add column snapshot_json jsonb,
  add column signature_user_agent text;
