---
status: current
owner: platform
last_verified: 2026-08-24
source_of_truth: false
related_code:
  - docs/SPRINT_BACKLOG.md
  - docs/architecture/S021_PORTAL_INVOICE_PRESENTATION_PLAN.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
---

# Session Handoff

## Mission

S021 customer invoice/payment presentation is the sole numbered-sprint
implementation lane. Implementation PR #299 is in review; do not begin another
numbered sprint until S021 merges and its separate completion-evidence
reconciliation is complete.

## Current branch

`feature/s021-customer-invoice-payment-presentation`, based on
`origin/main` `dd9aef806a285abf884bcf5f9046217d106ee360`.

Remote implementation head:
`c2bf03e69670d903af8e0e03673bb5cc3931f98b`.

Implementation PR: #299
https://github.com/404TradeOS-LLC/TradeOS/pull/299

## Current truth

- S021 remains presentation-centric and preserves existing Invoice and Payment
  financial truth, billing authorization, server-derived organization context,
  request-scoped sessions, and forced PostgreSQL RLS.
- The implementation adds server-derived paid amount and balance due,
  recorded-only sanitized payment history, invoice-read billing authorization,
  and customer portal invoice list/detail presentation.
- Overdue and partially-paid states remain derived. No payment processor,
  checkout, ledger, new payment-entry architecture, schema migration, customer
  identity model, or RBAC/RLS redesign shipped.
- Local focused/unit/web/docs checks passed. PostgreSQL integration could not run
  locally because Docker is unavailable; CI must provide the live PostgreSQL/RLS
  evidence.
- S020 remains PLANNED and blocked on founder/legal-signature semantics.
- S022 remains blocked by S016, S020, and S021. S024 remains founder-decision
  blocked. S027 remains BLOCKED/PARTIAL pending authenticated rendered Costbook
  browser evidence and its storage-state secret.

## Active Sprint and Next Eligibility

Active Sprint: S021
Completion status: S019 is DONE with implementation PR #296 and completion
evidence PR #297 merged. S021 is IN_REVIEW through PR #299; completion evidence
is next after implementation merge.
Protected boundary: Do not introduce new money semantics, payment processing,
customer auth, RBAC/RLS policy changes, schema changes, or another numbered
sprint implementation lane.

## Next Eligible Sprint

Sprint ID: NONE
Eligibility: S021 is `IN_REVIEW`; the canonical selector must be rerun only after its implementation merge and separate completion-evidence merge.
Dependencies: S021 depends on S011 and S018, both DONE.
Overlap check: PR #299 is the sole numbered-sprint implementation lane; do not create S020/S022/S024/S027 implementation branches.
Startup prompt: Verify exact-head CI and review state for PR #299, repair only deterministic scoped findings on the same branch, merge when governed checks are green, then create `docs/s021-completion-evidence` for the separate governance-only completion flow. Do not begin another numbered sprint from the implementation branch.
