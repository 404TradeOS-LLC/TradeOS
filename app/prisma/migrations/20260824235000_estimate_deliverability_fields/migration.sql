-- Estimate deliverability: contractor-editable scope and tax-aware totals.
-- Existing rows retain their current math and are placed in a General section.

alter table estimates
  add column tax_pct numeric(5, 2) not null default 0,
  add column tax_amount numeric(14, 2) not null default 0;

alter table estimate_line_items
  add column section text not null default 'General',
  add column cost_type text not null default 'other',
  add column taxable boolean not null default false;

alter table estimates
  add constraint estimates_tax_pct_range check (tax_pct >= 0 and tax_pct <= 100);

alter table estimate_line_items
  add constraint estimate_line_items_cost_type_check
    check (cost_type in ('labor', 'material', 'equipment', 'disposal', 'subcontractor', 'other'));
