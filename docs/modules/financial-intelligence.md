# Financial intelligence

## Current production increment

The owner dashboard derives its first financial-intelligence summary from existing organization-scoped sources:

- recorded payments from `GET /api/v1/payments/current-week`;
- backend-computed invoice `balanceDue` values from the invoice work queue;
- unsigned proposal amounts from the proposal work queue.

The dashboard does not recompute invoice balances, infer missing proposal prices, or treat a failed request as zero. Bounded queue dollar totals are labeled as floors when the exact organization-wide count exceeds the loaded rows. Proposal opportunity is labeled as known prices only when records are missing an amount or the queue is paginated.

## Deliberately unavailable

Committed margin and job profitability remain unavailable until TradeOS has an organization-wide, verified job-cost summary. The dashboard must not derive margin from a bounded recent-project fan-out or from estimate sell price alone.

## Next increment

Add a read-only, organization-scoped financial summary endpoint that returns:

- recognized payments by period;
- open and overdue receivables;
- accepted and unsigned proposal value;
- committed estimate cost and sell totals;
- verified actual job costs;
- source coverage and generated-at timestamps.

All values must preserve unknown/partial states and existing tenant/RLS boundaries.
