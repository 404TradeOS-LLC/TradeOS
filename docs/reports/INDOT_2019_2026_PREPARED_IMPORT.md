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

A production ingestion endpoint should be organization-scoped from authenticated context, idempotent by source + year + item code, preserve all provenance, and require named-human review before any operational Costbook promotion.

## Idempotency keys

Recommended current-reference key:

`INDOT:CURRENT:{price_year}:{item_code}`

Recommended history key:

`INDOT:HISTORY:{price_year}:{item_code}`

## Next implementation

1. Add a composite installed-unit-price benchmark persistence model/migration.
2. Add authenticated owner/admin bulk import service.
3. Stream/parse the prepared workbook without trusting client-supplied organization IDs.
4. Upsert current reference rows and historical observations using the deterministic keys above.
5. Add counts for created/updated/skipped/rejected rows and expose human-review state before Costbook use.
