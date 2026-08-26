# TradeOS Costbook Normalization Rules

This document outlines the standard normalization steps applied to cost items.

## Text Case & Whitespace
1. **Name**: Title cased with specific exceptions. Leading and trailing whitespace is stripped.
2. **Category**: Trimmed and converted to standard Title Case (e.g., `Drywall`, `Trim`).
3. **Notes**: Leading and trailing whitespace is stripped.

## Acronym Whitelist
The following acronyms must always be fully capitalized (all-caps) when they appear as separate words in names:
`SF`, `LF`, `EA`, `HR`, `CY`, `SQ`, `CF`, `OSB`, `LVL`, `OC`, `PSL`, `RC`, `ICF`, `CMU`, `PT`, `PVA`, `PSI`, `STC`, `RSIC`, `EPS`, `RO`, `TV`, `RV`, `EIFS`, `ERV`, `HRV`, `AFUE`, `BTU`, `SEER`, `PVC`, `ABS`, `CPVC`, `HDPE`, `EMT`, `RGS`, `GFCI`, `AFCI`, `UV`, `IAQ`, `HVAC`, `MEP`, `OAC`, `RFI`, `HOA`, `PPE`, `WC`, `CO`, `PM`, `EV`, `SWPPP`, `TPO`, `EPDM`, `BUR`, `LVP`, `LVT`, `SLU`, `PRV`, `GFI`, `DWV`, `CSST`, `MDF`, `PEX`.

## Unit Normalization Mapping
Legacy units must be normalized to standard values:
- `sq ft`, `sqft`, `square feet` $\rightarrow$ `SF`
- `lin ft`, `linft`, `lineal feet` $\rightarrow$ `LF`
- `each` $\rightarrow$ `EA`
- `hour`, `hr` $\rightarrow$ `HR`
- `cubic yard`, `cub yd` $\rightarrow$ `CY`
- `square` $\rightarrow$ `SQ`
- `cubic foot` $\rightarrow$ `CF`

## Precision & Formatting
- **Pricing Fields**: All decimal values for `laborCost`, `materialCost`, and `equipmentCost` must be rounded to exactly two decimal places (`%.2f`).
