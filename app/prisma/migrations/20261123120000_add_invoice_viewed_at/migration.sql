-- DES-7 (c): record when a customer first views an invoice in the portal.
-- Additive nullable column only: legacy rows stay NULL (never viewed), no
-- backfill, no index. The status CHECK widening the writer needs lives in
-- 20261123120200_widen_invoice_status_check (installed NOT VALID, validated
-- by 20261123120300) — this migration adds the column only. The writer is
-- InvoicesService.markViewed, reached from CustomerPortalService.getInvoice;
-- it sets viewedAt on first portal view and is idempotent on repeat views.
ALTER TABLE invoices ADD COLUMN viewed_at timestamptz;
