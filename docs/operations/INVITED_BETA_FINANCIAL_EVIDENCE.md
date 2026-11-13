# Invited beta financial continuity evidence

This bounded regression covers synthetic saved Estimate inputs through finalized
Estimate reload, Proposal creation/reload and idempotent replay. It does not
certify a deployed browser journey or reproduce either historical discrepancy.

`app/tests/proposals.idempotency.integration.ts` uses the real custom-line service to persist
3 × $0.70 = $2.10, 8 × $5,335 = $42,680.00 and 1 × $7,125.37 in separate Estimates,
with zero overhead and markup. The real Estimate service recalculates and
finalizes each one. The app-role request session then reloads the exact stored
Decimal total and creates a Proposal without an explicit price override. The
Proposal must retain that exact amount and Estimate/Project identity. After an
administrative synthetic change to the source Estimate, replay must return the
original Proposal and preserve its saved price, with no range substituted.

The reported $1,670 deck and Estimate $2.10 → Proposal $42,680 incidents remain
OPEN. Repository handoff and invited-beta notes name the discrepancies but do
not supply original Estimate/Proposal IDs, quantities, pricing mode, overhead,
markup/margin, tax or saved-line payloads. Matching example dollar amounts are
not proof of a shared input or root cause. The unrelated motion-design $1,670
fixture is not authoritative pricing evidence.

To close either incident, retain the redacted original record IDs and saved
line/pricing inputs, establish the expected result from the authoritative
pricing/snapshot contract, reproduce the discrepancy, and add that actual
input as a regression. Then run the matching-SHA authenticated browser/PDF
acceptance evidence before changing the beta financial gate.
