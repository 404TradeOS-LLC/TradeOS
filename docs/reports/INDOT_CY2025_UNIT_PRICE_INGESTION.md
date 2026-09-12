# INDOT CY2025 unit-price benchmark ingestion

## Source

- Publisher: Indiana Department of Transportation (INDOT)
- Dataset: CY2025 Unit Price Summary
- Source workbook: `https://www.in.gov/indot/doing-business-with-indot/files/CY2025-Unit-Price-Summary.xlsx`
- Index page: `https://www.in.gov/indot/doing-business-with-indot/home/contracts/standards/indot-pay-items-listunit-price-summaries/`
- Regional basis: Indiana statewide awarded INDOT contracts

INDOT describes these summaries as the high, low, and average unit bid prices for every pay item included in an awarded INDOT project during the prior year, with prices taken from the low bid for each contract.

## Important pricing boundary

These values are **composite installed construction unit prices**. They may reflect labor, material, equipment, mobilization, overhead, project conditions, quantities, and contractor bidding behavior.

They are therefore not equivalent to:

- raw material cost;
- employee wage;
- equipment-only cost;
- organization-specific loaded labor cost; or
- a TradeOS customer bill rate.

The existing `CostbookResearchCandidate` contract currently requires a `materialCostTypical` field and does not have a dedicated composite installed-unit-price field. For that reason this slice deliberately does **not** map INDOT values into the promotable research-candidate contract.

## Full-workbook parser

`scripts/parse-indot-cy2025-unit-prices.py` parses the authoritative XLSX workbook directly with Python standard-library ZIP/XML support; no AI row extraction and no spreadsheet dependency are required.

The parser:

- resolves the workbook's actual first worksheet through XLSX relationships;
- reads shared strings and inline/numeric cells;
- locates the pay-item table by semantic column headers rather than fixed row numbers;
- reads every row whose pay-item identifier matches the INDOT `NNN-NNNNN` format;
- preserves pay-item number, description, unit, low price, average price, high price, and total quantity;
- rejects duplicate pay-item numbers, negative numeric values, missing required values, and rows where `low > average` or `average > high`;
- validates the workbook boundaries against first pay item `105-06807` and last pay item `809-94971`;
- emits `app/data/indot-cy2025-unit-prices.json` with row count, distinct units, source metadata, and the complete normalized row set.

A full-workbook read of the current CY2025 source reports 782 data rows and 18 distinct unit codes. The checked-in parser computes the authoritative row count from the workbook at execution time rather than trusting extractor-generated counts.

## Source-verified regression sample

| Pay item | Description | Unit | Low | Average | High | Total quantity |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| 201-01015 | CLEARING AND GRUBBING | LS | $5,000.00 | $33,043.33 | $120,000.00 | 10 |
| 203-02000 | EXCAVATION, COMMON | CYS | $1.00 | $27.29 | $505.00 | 1,304,735 |
| 211-09194 | B BORROW | TON | $125.00 | $125.00 | $125.00 | 10 |
| 301-12231 | COMPACTED AGGREGATE, NO. 2 | CYS | $47.00 | $86.71 | $1,200.00 | 5,909 |
| 301-12232 | COMPACTED AGGREGATE, NO. 5 | CYS | $45.00 | $91.90 | $490.00 | 7,362 |
| 301-12234 | COMPACTED AGGREGATE, NO. 53 | CYS | $50.00 | $100.00 | $600.00 | 8,000 |

The workbook's final column is **quantity**, not observation count. TradeOS therefore preserves it as `totalQuantity` and does not infer a bid-count/sample-size field that the source does not provide.

## Current implementation

`app/modules/costbook/indotUnitPrice2025.ts` stores a small source-verified regression sample and source constants.

`app/tests/costbook-indot-unit-price.test.ts` locks that sample, provenance, deterministic lookup behavior, and the corrected total-quantity semantics.

`scripts/parse-indot-cy2025-unit-prices.py` is the full-workbook normalization path. It can download the current authoritative workbook or accept a local workbook through `--input`, then writes the full normalized JSON snapshot through `--output`.

This work performs no production Costbook write, no tenant mutation, and no automatic price promotion.

## Next architecture step

Add a reviewed Costbook evidence contract for **installed unit-price benchmarks** that can represent a composite price without misclassifying it as material, labor, or equipment cost. Only after that contract exists should INDOT benchmarks enter the normal review/promotion workflow.

The reviewed evidence path should preserve pay-item number, source year, total quantity, state-level geography, retrieval timestamp, source workbook URL, and immutable source identity for every row.
