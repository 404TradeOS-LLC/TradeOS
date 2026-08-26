# TradeOS Costbook Pricing Sanity Rules

This document outlines the pricing sanity and validation checks implemented to identify potential anomalies in item costs.

## Minimum Cost Thresholds
The total cost of a cost item (labor + material + equipment) must meet or exceed a unit-specific threshold to prevent unrealistically low prices:

| Unit | Description | Min Cost |
|------|-------------|----------|
| `SF` | Square Feet | $0.05 |
| `LF` | Linear Feet | $0.10 |
| `EA` | Each | $0.25 |
| `HR` | Hour | $12.00 |
| `CY` | Cubic Yard | $8.00 |
| `SQ` | Square (100 SF) | $5.00 |
| `CF` | Cubic Foot | $0.50 |
| *Other* | Any other unit | $0.01 |

## Suspicious Labor Ratio Guard
A labor ratio check is run to flag items with abnormally high labor ratios:
\[\frac{\text{laborCost}}{\text{laborCost} + \text{materialCost} + \text{equipmentCost}} > 0.98\]

### Labor-Only Whitelist Keywords
If an item's labor ratio is above $98\%$, it is whitelisted (allowed to pass) if its name contains one or more of the following keywords representing professional services, inspections, management, coordination, or labor-only tasks:

`inspection`, `engineer`, `permit`, `per day`, `per visit`, `meeting`, `report`, `review`, `consult`, `test`, `walk`, `plan`, `coordination`, `photos`, `documentation`, `closeout`, `manager`, `superintendent`, `foreman`, `officer`, `preparation`, `processing`, `photography`, `cleanup`, `clean`, `general labor`, `stack`, `labor add-on`, `hoa`, `survey`, `callback`, `warranty`, `rfi`, `submittal`, `safety`, `oac`, `subcontractor`, `back charge`, `change order`, `zoning`, `preconstruction`, `kickoff`, `hand stock`, `load calculation`, `engineering`, `repair`, `install`, `design`, `estimate`, `bid`, `scheduling`, `permitting`, `administration`, `supervision`, `project management`, `technical writing`, `drafting`, `as-built`, `audit`, `punch list`, `measurement`, `trip`, `estimator`, `scheduler`, `liaison`, `rate`.
