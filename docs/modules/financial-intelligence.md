# Financial intelligence

## Current implementation

The owner dashboard prefers `GET /api/v1/intelligence/financial-summary`, a read-only organization-scoped aggregate built from existing persisted sources:

- all recorded payments in the current organization week;
- all open and overdue invoice balances after recorded payments;
- all unsigned proposals and the sum of their known final prices;
- unique estimate snapshots linked to accepted proposals, including pre-tax sell, overhead-adjusted cost, projected gross profit, and projected margin.

Each source carries `complete`, `partial`, or `unavailable` coverage plus an explanation. The endpoint uses the authenticated organization id, requires `billing.read`, and runs inside the established request-scoped database session and forced-RLS boundary. Independent source failures return `null` values with unavailable coverage instead of replacing unknown money with zero or blanking healthy sources.

The dashboard retains the earlier payment/invoice/proposal queue calculation as a degraded fallback if the aggregate endpoint itself is unavailable. It labels that state as fallback coverage rather than organization-wide exact coverage.

## Deliberately unavailable

Realized job margin and job profitability remain unavailable because TradeOS does not yet persist actual labor, material, and equipment costs against jobs. The displayed projected committed margin is explicitly estimate-based: accepted proposals select the unique persisted estimate snapshots, cost includes persisted overhead, and sell excludes persisted tax. It is not presented as actual job margin.

## Next increment

Add an organization-scoped actual job-cost ledger that can capture verified:

- field labor time and burdened labor cost;
- material usage and purchase cost;
- equipment usage cost;
- approved adjustments and source provenance.

Only after that source exists should the summary expose realized gross profit, variance from estimate, or actual job margin.
