-- DES-7 (c): record when a customer first views an invoice in the portal.
-- Additive nullable column only: legacy rows stay NULL (never viewed), no
-- backfill, no index, no constraint change. The writer is
-- InvoicesService.markViewed, reached from CustomerPortalService.getInvoice;
-- it sets viewedAt on first portal view and is idempotent on repeat views.
ALTER TABLE invoices ADD COLUMN viewed_at timestamptz;
