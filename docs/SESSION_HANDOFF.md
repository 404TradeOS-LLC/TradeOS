---
status: current
owner: platform
last_verified: 2026-11-24
source_of_truth: true
related_docs:
  - docs/TRADEOS_BIBLE.md
  - docs/ENGINEERING_COMMAND_CENTER.md
  - docs/CURRENT_STATE.md
  - docs/SPRINT_BACKLOG.md
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
---

## Sprint implementation — 2026-11-24: S068 implemented (PR pending merge)

- Base: `main` at `c7717c69`. Branch `feat/s068-change-order-certification`, 03:00 sprint runner.
- GAP-1 fixed: approve/reject now record attributable `change_order.approved` / `change_order.rejected` activity events (actor = authenticated staff user, metadata previousStatus/newStatus/coNumber/projectId/amount); explicit draft-only guard added (`canTransitionChangeOrderStatus` returns true for same-status transitions, so approve-from-approved previously re-approved instead of 409ing); `change_order` registered as an `IntelligenceEntityType` so the events are queryable through the typed activity filter.
- Tests: focused service (17 tests) + controller (3 tests); live-PostgreSQL snapshot-stability integration test (`app/tests/s068.change-orders.integration.ts`, CI-verified-only — no Docker on the authoring VM).
- Browser evidence: S068 workflow + capture script + contract test (16/16) + testing doc; PENDING DISPATCH from `main` after merge. Staging promotion waits for the field-closeout run to finish (staging `d2363802`).
- GAP-2 BLOCKED by design: customer portal approve/reject (ADR-010 limits customer-originated writes to signing pending contracts); not built. GAP-3 finding: no downstream roll-up of approved change orders into estimates/invoices/contracts — a roll-up would be a new financial model and needs a founder decision.
- S068 is `IN_REVIEW` on merge; full acceptance still owed (browser-evidence workflow dispatch + run record in a follow-up PR).

## Next Eligible Sprint

Sprint ID: NONE
Eligibility: No numbered sprint is currently `READY`. S068 is `IN_REVIEW` (browser evidence pending); S069 and S071 have satisfied `Dependencies:` but stay `PLANNED` — each needs its own governance-only readiness promotion, S069 first; S059 is `IN_REVIEW` (browser evidence pending).
Dependencies: none (no READY sprint).
Overlap check: Live open PRs rechecked 2026-11-24 (main `c7717c69` at implementation start): zero open PRs; the main-port lane (#1065, switcher defects) owns disjoint files; no S068 implementation branch existed before this run.
Startup prompt: Dispatch the S068 browser-evidence workflow from `main` after the implementation PR merges (see `docs/testing/S068_CHANGE_ORDER_EVIDENCE.md`); then promote S069 with a governance-only readiness PR per the Next Sprint Protocol.
