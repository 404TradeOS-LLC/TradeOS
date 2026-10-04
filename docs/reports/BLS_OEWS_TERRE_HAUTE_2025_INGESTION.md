# BLS OEWS Terre Haute labor-ingestion record

## Source

- Publisher: U.S. Bureau of Labor Statistics (BLS)
- Program: Occupational Employment and Wage Statistics (OEWS)
- Reference period: May 2025
- Geography: Terre Haute, IN Metropolitan Statistical Area
- Area code: `0045460` (CBSA 45460)
- Counties: Clay, Sullivan, Vermillion, and Vigo
- BLS release: `https://www.bls.gov/regions/midwest/news-release/2026/occupationalemploymentandwages_terrehaute_20260710.htm`
- BLS release date: 2026-07-10

The first TradeOS ingestion slice records official wage observations as **Costbook research candidates** for review context. It does not write directly to organization LaborRate records and does not infer payroll burden, benefits, overhead, markup, margin, or customer bill rate.

## Initial contractor-trade slice

| SOC | Occupation | P10 | P25 | Median | P75 | P90 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 47-2111 | Electricians | $21.56 | $24.22 | $37.33 | $43.22 | $47.84 |
| 47-2152 | Plumbers, Pipefitters, and Steamfitters | $22.17 | $29.53 | $43.39 | $48.07 | $48.07 |
| 47-2031 | Carpenters | $18.72 | $23.77 | $29.12 | $35.55 | $38.75 |
| 49-9021 | Heating, Air Conditioning, and Refrigeration Mechanics and Installers | $18.35 | $23.29 | $26.11 | $33.04 | $39.06 |
| 47-2141 | Painters, Construction and Maintenance | $17.13 | $18.37 | $22.06 | $28.00 | $29.49 |
| 47-2073 | Operating Engineers and Other Construction Equipment Operators | $20.85 | $24.17 | $29.63 | $40.40 | $44.46 |
| 47-2211 | Sheet Metal Workers | $17.73 | $22.71 | $36.44 | $42.77 | $47.39 |

The validated MVP source specification also supplies mean/median and employment for three additional core trades whose percentile detail is not asserted in this repository slice:

| SOC | Occupation | Employment | Mean | Median |
| --- | --- | ---: | ---: | ---: |
| 47-2181 | Roofers | 80 | $25.08 | $23.89 |
| 47-2051 | Cement Masons and Concrete Finishers | 50 | $27.70 | $28.84 |
| 47-2061 | Construction Laborers | 500 | $23.32 | $21.85 |

Those rows are retained without invented percentiles. The complete observed distribution is retained in candidate research notes. The median (P50) is preserved as benchmark evidence only; this adapter deliberately does **not** populate `laborRateAssumption` or `laborHours`.

That distinction is required because the existing generic research-candidate promotion path maps `laborRateAssumption` into both `hourlyCost` and `billRate`. A raw BLS employee wage is not a safe customer bill rate and therefore must not be placed in that promotable field until TradeOS has organization-specific loaded-cost and bill-rate inputs.

## Governance boundary

These records are source-backed reference wages, not production labor pricing.

Pipeline for this slice:

```text
BLS OEWS observation
  -> TradeOS Costbook research candidate (benchmark evidence only)
  -> named-human review context
  -> future organization-specific labor-pricing step
  -> existing Costbook LaborRate/CostItem service boundary
```

The current Costbook research-candidate controls remain authoritative:

- candidate creation does not imply approval;
- `provenanceStatus` is `documented` because the source, SOC identifier, reference period, geography, and retrieved timestamp are retained;
- `confidence` is `high` for source quality, not for contractor-specific bill-rate suitability;
- organization-specific burden, benefits, payroll taxes, overhead, markup, and margin remain separate inputs;
- existing estimate/proposal/contract/invoice pricing snapshots are not repriced;
- no Athena or other automated actor may approve/promote these candidates autonomously;
- this adapter intentionally omits promotable labor-rate fields so a BLS wage cannot become a customer bill rate through the current promotion mapping.

## Implementation

`app/modules/costbook/blsOewsTerreHaute.ts` contains the vetted source records and maps them into the existing `CreateCandidateInput` contract as benchmark-only evidence. `app/modules/costbook/blsOewsIngestion.ts` submits those records idempotently to the existing tenant-scoped research-review queue; it never writes a `LaborRate`. `app/modules/costbook/laborBenchmarks.ts` supplies the explicit Terre Haute → Indiana → national fallback selector and the transparent ECEC-derived burden calculation used by the Costbook foundation.

`app/tests/costbook-bls-oews.test.ts` verifies:

- all ten source-backed records parse through the canonical research-candidate schema;
- the published P10/P25/P50/P75/P90 values remain fixed for every record;
- exact source URL and May 2025 source date remain fixed;
- provenance is documented and region-specific;
- every candidate starts in the normal `candidate` review state;
- `laborRateAssumption`, `laborHours`, and `billRate` are not invented.

## Explicit limitation

This repository slice prepares source-backed benchmark candidates but does **not** mutate a live tenant database by itself and does not yet provide the organization-specific labor-pricing step required to turn a wage benchmark into a loaded cost and customer bill rate.

A follow-up implementation should collect or calculate organization-specific payroll burden, benefits, overhead, and pricing policy before creating a real LaborRate. That follow-up must continue to use the existing Costbook service boundary and human-review controls.

## ECEC burden rule

The Costbook foundation records the validated June 2026 BLS ECEC private-construction values as national evidence: wages $36.13/hour and benefits $15.84/hour. When TradeOS combines the $15.84 national benefit dollars with an OEWS wage, the result is labelled `inferred` / `MEDIUM` confidence and explicitly says that national benefits were applied to a local or state wage. ECEC legally required benefits are already inside the total benefit figure, so payroll taxes are not added a second time. Contractor overhead, profit, and customer markup remain separate organization inputs.

## Fallback rule

OEWS benchmark resolution prefers area code `0045460`, then Indiana state code `18`, then national `US`. A fallback retains the geography of the selected source row and records that Terre Haute was unavailable; it is never relabelled as a Terre Haute observation. The repository does not invent state/national numeric fixtures when the source ingestion has not supplied them.
