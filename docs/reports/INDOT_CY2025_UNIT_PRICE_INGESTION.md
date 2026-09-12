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

The existing `CostbookResearchCandidate` contract currently requires a `materialCostTypical` field and does not have a dedicated composite installed-unit-price field. For that reason this first slice deliberately does **not** map INDOT values into the promotable research-candidate contract.

## First vetted slice

| Pay item | Description | Unit | Low | Average | High | Observations |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| 201-01015 | CLEARING AND GRUBBING | LS | $5,000.00 | $33,043.33 | $120,000.00 | 10 |
| 203-02000 | EXCAVATION, COMMON | CYS | $1.00 | $27.29 | $505.00 | 1,304,735 |
| 211-09194 | B BORROW | TON | $125.00 | $125.00 | $125.00 | 10 |
| 301-12231 | COMPACTED AGGREGATE, NO. 2 | CYS | $47.00 | $86.71 | $1,200.00 | 5,909 |
| 301-12232 | COMPACTED AGGREGATE, NO. 5 | CYS | $45.00 | $91.90 | $490.00 | 7,362 |
| 301-12234 | COMPACTED AGGREGATE, NO. 53 | CYS | $50.00 | $100.00 | $600.00 | 8,000 |

## Current implementation

`app/modules/costbook/indotUnitPrice2025.ts` stores the first typed benchmark slice with exact pay-item identifiers, units, low/average/high observations, source URLs, and statewide regional basis.

`app/tests/costbook-indot-unit-price.test.ts` locks the initial benchmark values and provenance.

This slice performs no production Costbook write, no tenant mutation, and no automatic price promotion.

## Next architecture step

Add a reviewed Costbook evidence contract for **installed unit-price benchmarks** that can represent a composite price without misclassifying it as material, labor, or equipment cost. Only after that contract exists should INDOT benchmarks enter the normal review/promotion workflow.

A future INDOT loader should also preserve pay-item number, source year, observation count/quantity basis, state-level geography, retrieval timestamp, and source workbook URL for every row.
