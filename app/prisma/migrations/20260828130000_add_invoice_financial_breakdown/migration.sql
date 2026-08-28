-- Preserve the composition of an invoice total so customer documents can
-- itemize subtotal, tax, payments applied, and the remaining balance.
alter table invoices
  add column subtotal numeric(14,2) not null default 0,
  add column tax_pct numeric(5,2) not null default 0,
  add column tax_amount numeric(14,2) not null default 0;

-- Existing invoices predate the breakdown columns. Their persisted amount is
-- the only authoritative total available, so backfill it as a zero-tax
-- subtotal rather than inventing a tax allocation.
update invoices
set subtotal = amount,
    tax_pct = 0,
    tax_amount = 0
where subtotal = 0 and amount <> 0;
