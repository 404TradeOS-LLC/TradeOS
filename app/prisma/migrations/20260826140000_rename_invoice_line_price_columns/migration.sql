-- Invoice line values are selling-price allocations. Rename the legacy cost
-- columns without changing data, precision, defaults, or invoice behavior.
ALTER TABLE "invoice_line_items" RENAME COLUMN "unit_cost" TO "unit_price";
ALTER TABLE "invoice_line_items" RENAME COLUMN "line_cost" TO "line_total";
