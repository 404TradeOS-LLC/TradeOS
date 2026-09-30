# BuilderMuse Costbook Intake

## Source snapshot

Prepared workbook: `BuilderMuse_Costbook_Prepared.xlsx`

The reviewed workbook contains two intentionally separate data classes:

- **21 material-price candidates** in `Costbook_Review`
- **20 escalation/index references** in `Price_Indices`

The workbook itself classifies every material row for review rather than unattended import.

## Material-price candidate boundary

The prepared material rows contain useful normalization work, including package-to-Costbook-unit conversions. Examples include lumber, pipe, electrical, plumbing, HVAC, paint, flooring and windows.

They are **not trusted local production prices yet**. The reviewed workbook does not provide all of the evidence required by the governed Costbook candidate contract:

- exact source/capture date (the workbook carries only a `YYYY-MM` price period)
- exact local geography for the observed price
- supplier SKU
- primary evidence locator such as a product URL, quote, receipt or invoice

TradeOS must not invent those fields. A month-level period must not be converted into an arbitrary first or last day just to satisfy the candidate schema.

`app/modules/costbook/builderMuseIntake.ts` therefore exposes a review-only assessment. A prepared row remains blocked until separately verified provenance supplies all required fields. Only then can `toVerifiedBuilderMuseCandidate()` produce a `CreateCandidateInput`, and that output is still merely an unapproved Costbook research candidate. It must pass the existing named-human review and explicit promotion boundary before any canonical Costbook write.

## Price-index boundary

The 20 `Price_Indices` rows are trend/escalation references. They are not material prices, supplier quotes, labor rates or customer bill rates.

The only supported conversion in this slice is to an `escalation-reference-only` object. No function maps the index value into `materialCostTypical`, `LaborRate`, equipment cost or bill rate.

A future integration may reconcile verified index series with the BLS PPI lane and use them to calculate price-staleness or escalation suggestions. Any resulting dollar recommendation remains review-only until a human accepts it.

## Intended local workflow

For each material row:

1. identify an exact Terre Haute-area supplier/store or other defensible regional source;
2. attach the supplier SKU or product identifier;
3. capture a dated product URL, quote, receipt or invoice;
4. confirm package quantity and normalized unit conversion;
5. create a Costbook research candidate with documented provenance;
6. require named-human review before promotion.

## Explicit non-goals

This slice does not:

- bulk-import the 21 prepared prices into Materials;
- treat `Not specified` geography as Terre Haute;
- manufacture an exact date from `2026-03` or another monthly period;
- treat a vendor/source label as primary evidence;
- import BLS/FRED index values as dollar costs;
- bypass `CostbookCandidateService` review/promotion governance.
