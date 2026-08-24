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

S021 customer invoice/payment presentation is complete. Implementation PR #299
merged as `514c94900263744ac8cf498c6b06da336e097512`; completion-evidence PR
#300 is merged. This branch records the founder decisions that resolve S014,
S020, and S024 boundaries. Do not begin another numbered sprint until the
canonical selector identifies an eligible READY sprint.

## Current branch

`docs/founder-decisions-s014-s020-s024`, based on
`origin/main` `f371e23d4133296e9b616c3e847cb423b76cc1ca`.

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
- Exact-head GitHub verification passed the required app unit/typecheck/build,
  PostgreSQL-backed integration/RLS, web unit/lint/build, docs, governance,
  branch-currency, dependency, and review gates.
- ADR-006 accepts Brand Studio as the canonical organization-brand source and
  keeps Settings as a compatibility/administration adapter; S014 is decision-
  complete after this governance PR merges.
- ADR-007 accepts authenticated in-app contract acceptance/signature evidence
  for S020 and forbids formal e-signature claims or new identity architecture.
- ADR-008 accepts metadata-first AI retention/privacy/cost controls for S024;
  raw prompt/output/tool content is not retained by default and metadata has a
  90-day default retention period. S024 is decision-complete after this PR.
- S015 is the lowest-numbered planned candidate and requires readiness
  promotion. S016 is unblocked by S014; S020 is planned with its decision
  blocker resolved; S022 remains blocked by S016/S020/S021; and S027 remains
  BLOCKED/PARTIAL pending authenticated rendered Costbook browser evidence.

## Next Eligible Sprint

Sprint ID: NONE
Eligibility: No numbered sprint is currently `READY`; S015 is the lowest-numbered planned candidate and needs a governance-only readiness promotion. S016 is unblocked but planned, S020 is unblocked but planned, S022 remains dependency-blocked, and S027 remains environment-evidence blocked.
Dependencies: none
Overlap check: no numbered implementation lane is active; this is governance-only founder-decision evidence for S014, S020, and S024.
Startup prompt: After this decision-evidence merge, rerun the canonical selector and promote only the lowest-numbered eligible sprint, expected to be S015. Do not implement S016, S020, or S024 concurrently.
