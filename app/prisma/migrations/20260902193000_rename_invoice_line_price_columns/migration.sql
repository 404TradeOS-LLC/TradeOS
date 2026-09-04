-- Expand the invoice line-item selling-price storage without breaking a
-- still-serving backend that writes the legacy cost column names. New code
-- uses unit_price/line_total; the trigger keeps both representations in sync
-- until a later contract migration can remove the legacy aliases safely.

alter table invoice_line_items
  add column unit_price numeric(12,4),
  add column line_total numeric(14,2);

update invoice_line_items
set unit_price = unit_cost,
    line_total = line_cost;

create or replace function public.sync_invoice_line_item_price_columns()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.unit_price is null then
      new.unit_price := new.unit_cost;
    elsif new.unit_cost is null or new.unit_price is distinct from new.unit_cost then
      new.unit_cost := new.unit_price;
    end if;
    if new.line_total is null then
      new.line_total := new.line_cost;
    elsif new.line_cost is null or new.line_total is distinct from new.line_cost then
      new.line_cost := new.line_total;
    end if;
  else
    if new.unit_price is distinct from old.unit_price
       and new.unit_cost is not distinct from old.unit_cost then
      new.unit_cost := new.unit_price;
    elsif new.unit_cost is distinct from old.unit_cost
       and new.unit_price is not distinct from old.unit_price then
      new.unit_price := new.unit_cost;
    elsif new.unit_price is distinct from new.unit_cost then
      new.unit_cost := new.unit_price;
    end if;
    if new.line_total is distinct from old.line_total
       and new.line_cost is not distinct from old.line_cost then
      new.line_cost := new.line_total;
    elsif new.line_cost is distinct from old.line_cost
       and new.line_total is not distinct from old.line_total then
      new.line_total := new.line_cost;
    elsif new.line_total is distinct from new.line_cost then
      new.line_cost := new.line_total;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists invoice_line_item_price_columns_sync on invoice_line_items;
create trigger invoice_line_item_price_columns_sync
before insert or update on invoice_line_items
for each row execute function public.sync_invoice_line_item_price_columns();

alter table invoice_line_items
  alter column unit_price set not null,
  alter column line_total set not null;
