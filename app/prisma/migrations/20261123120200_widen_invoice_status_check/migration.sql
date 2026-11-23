-- DES-7 (c): widen the invoices status CHECK to the canonical domain set.
-- InvoicesService.markViewed writes status 'viewed' for a sent invoice, and
-- InvoicesService.void writes the legacy literal 'void'; the original
-- invoices CHECK (20260624100000) only allowed ('draft', 'sent', 'paid',
-- 'overdue', 'void'), so both 'viewed' and the canonical 'voided' /
-- 'partially_paid' were rejected by PostgreSQL (23514) and the portal
-- mark-viewed integration test failed. The new set is the canonical
-- invoiceStatuses from app/domain/contracts.ts ('draft', 'sent', 'viewed',
-- 'partially_paid', 'paid', 'overdue', 'voided') plus the legacy 'void'
-- literal the void() writer still persists and historical rows may carry.
-- Installed NOT VALID (proposal-declined precedent, 20260822210000) so the
-- replacement does not scan the table under lock; the follow-up migration
-- 20261123120300 validates it separately.
alter table invoices drop constraint if exists invoices_status_check;

alter table invoices add constraint invoices_status_check
  check (status in ('draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'voided', 'void')) not valid;
