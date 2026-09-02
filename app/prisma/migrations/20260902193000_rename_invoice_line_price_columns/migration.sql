-- Rename the legacy invoice line-item cost columns to their customer-facing
-- selling-price names. RENAME preserves all values, constraints, indexes, and
-- row-level-security policies while keeping the existing Prisma field/API
-- contract (unitPrice/lineTotal) unchanged.

alter table invoice_line_items
  rename column unit_cost to unit_price;

alter table invoice_line_items
  rename column line_cost to line_total;
