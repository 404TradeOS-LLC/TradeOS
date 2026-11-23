-- DES-10-F2: Review readiness checklist (Figma 378:443 / 287:240). Two
-- persisted review attestations that gate estimate finalization.
--
--   exclusions_reviewed_at     — the estimator confirmed the exclusions
--     that will appear on the customer proposal have been reviewed.
--     Exclusions themselves live on the proposal form
--     ("Exclusions override"); the estimate carries only the review
--     attestation, not a copy of the exclusion text.
--   price_sources_reviewed_at  — the estimator confirmed each line's
--     Costbook price source (source name / region / freshness shown in
--     the Items-stage cost preview) was reviewed before adding.
--
-- Additive only: two nullable timestamp columns on the org-scoped
-- estimates table. No backfill: existing rows get NULL (not reviewed),
-- which is the only honest value — no review happened before this
-- checklist existed, so no existing estimate may finalize until the
-- checklist is completed in the Review stage. No RLS change: the new
-- columns ride the existing estimate row, which is already org-scoped
-- with forced RLS; no new role or permission. A duplicated estimate
-- starts with NULL flags and must be re-reviewed; the flags are never
-- copied by duplicateFromVersion. Rollback: drop the two columns (no
-- data depends on them beyond the finalize gate).
--
-- Omitted Figma items, by design: item 01 (reconcile the $1,670
-- difference) depends on DES-10-F4 (no imported-draft concept exists,
-- needs a product decision); item 02 (review the footing assumption)
-- depends on DES-10-F1 (persisted clarification contract, Codex lane).

alter table estimates
  add column if not exists exclusions_reviewed_at timestamptz,
  add column if not exists price_sources_reviewed_at timestamptz;
