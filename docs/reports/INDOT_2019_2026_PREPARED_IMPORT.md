# INDOT 2019–2026 prepared Costbook import

## Prepared source

TradeOS now has a reviewed prepared-workbook contract for `INDOT_Costbook_Prepared_2019_2026.xlsx`.

Verified workbook sheets:

- `Costbook_Import`
- `Price_History`
- `Current_Catalog`
- `Current_No_Price`
- `Historical_Not_Current`
- `Summary`

The prepared dataset contains 4,551 current catalog items, 3,418 current Costbook reference-price rows, 1,133 current items without price history, 15,131 historical price records spanning 2019–2025, and 368 historical items no longer in the current catalog.

## Semantics

INDOT unit prices are installed/composite awarded-bid benchmarks. They are not raw material-only prices. The importer must preserve `price_basis`, geography, source file/row, year, low/high/weighted-average price, quantity, and catalog/review status.

## Ingestion contract

`Costbook_Import` is the current-reference input. Its prepared columns are:

`external_id,item_code,section_code,description,unit,unit_cost,price_year,low_price,high_price,source_quantity,total_bid_amount,price_basis,geography,catalog_status,row_status,comments,supplemental_description_required,source_file,source_row`

`Price_History` is the longitudinal benchmark input. Its prepared columns are:

`price_year,item_code,section_code,description_as_published,unit,weighted_avg_price,low_price,high_price,source_quantity,total_bid_amount,current_catalog,canonical_description,canonical_unit,source_file,source_row,source_total_check`

## Required write boundary

The prepared workbook must be imported as INDOT benchmark/reference evidence. Do not map `unit_cost` or `weighted_avg_price` into raw `materialCostTypical`, labor rate, equipment-only cost, or customer bill rate.

The implemented ingestion endpoint is organization-scoped from authenticated context, idempotent by source + year + item code, preserves provenance, and remains isolated from production Material/LaborRate/Equipment/customer-price writes.

## Idempotency keys

Recommended current-reference key:

`INDOT:CURRENT:{price_year}:{item_code}`

Recommended history key:

`INDOT:HISTORY:{price_year}:{item_code}`

## Implementation status

1. Composite installed-unit-price benchmark persistence model/migration: implemented.
2. Authenticated owner/admin bulk import service: implemented.
3. Prepared-workbook loader that rejects caller-supplied organization scope: implemented.
4. Idempotent current/history upsert path using deterministic source/year/item identity: implemented.
5. Production tenant import evidence and read/query UI remain follow-up after merge and migration deployment.
