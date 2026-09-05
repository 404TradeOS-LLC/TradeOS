-- Custom estimate line items are intentionally allowed to be entered without
-- referencing a Costbook item or assembly. Keep cost_item_id and assembly_id
-- mutually exclusive when either source is present, but do not require one.

alter table estimate_line_items
  drop constraint if exists estimate_line_items_check;

alter table estimate_line_items
  drop constraint if exists estimate_line_items_source_exclusivity_check;

alter table estimate_line_items
  add constraint estimate_line_items_source_exclusivity_check
  check (not (cost_item_id is not null and assembly_id is not null));
