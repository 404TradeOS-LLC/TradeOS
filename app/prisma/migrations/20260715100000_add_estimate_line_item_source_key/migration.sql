alter table estimate_line_items
  add column source_key text;

create unique index estimate_line_items_estimate_id_source_key_key
  on estimate_line_items(estimate_id, source_key);
