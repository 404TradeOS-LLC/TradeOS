-- Contract phase for invoice line-item selling-price storage.
-- This migration is safe only after production rollout evidence confirms
-- no old backend writers remain. The expand migration already backfilled
-- unit_price/line_total and synchronized both column pairs during rollout.

drop trigger if exists invoice_line_item_price_columns_sync on invoice_line_items;
drop function if exists public.sync_invoice_line_item_price_columns();

alter table invoice_line_items
  drop column unit_cost,
  drop column line_cost;
