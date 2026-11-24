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

## Readiness promotion — 2026-11-24: S069 promoted to READY

- Base: `main` at `1388baae`. Branch `docs/promote-s069-ready`, governance-only readiness PR on the founder's word ("promote every sprint that is ready").
- S069 is `READY`: no dependencies; live overlap rechecked 2026-11-24 (sole open PR #1066, CodeQL memberships rate limit — owns no closeout/warranty scope; #1065 Copilot repair lane owns disjoint switcher files); no S069 implementation branch exists.
- Plan doc: `docs/architecture/S069_CLOSEOUT_WARRANTY_WORKSPACE_PLAN.md`. S069 is build work (no punch/closeout/warranty models exist on main) — field completion → punch/closeout documents → customer handoff → warranty record organization, tenant-scoped and auditable, without inventing unsupported warranty promises.
- S071 also has satisfied `Dependencies:` but stays `PLANNED`: the sprint-state validator allows at most one `READY` sprint at a time, so it gets its own promotion after S069 leaves `READY`.
- `Release certification prerequisites:` do not block `READY` (S057/S058 for S069 — both PLANNED, reference-validated only).
- S069 is the next eligible sprint; the 03:00 sprint runner selects it next.

## Sprint implementation — 2026-11-24: S068 implemented (PR pending merge)

- Base: `main` at `c7717c69`. Branch `feat/s068-change-order-certification`, 03:00 sprint runner.
- GAP-1 fixed: approve/reject now record attributable `change_order.approved` / `change_order.rejected` activity events (actor = authenticated staff user, metadata previousStatus/newStatus/coNumber/projectId/amount); explicit draft-only guard added (`canTransitionChangeOrderStatus` returns true for same-status transitions, so approve-from-approved previously re-approved instead of 409ing); `change_order` registered as an `IntelligenceEntityType` so the events are queryable through the typed activity filter.
- Tests: focused service (17 tests) + controller (3 tests); live-PostgreSQL snapshot-stability integration test (`app/tests/s068.change-orders.integration.ts`, CI-verified-only — no Docker on the authoring VM).
- Browser evidence: S068 workflow + capture script + contract test (16/16) + testing doc; PENDING DISPATCH from `main` after merge. Staging promotion waits for the field-closeout run to finish (staging `d2363802`).
- GAP-2 BLOCKED by design: customer portal approve/reject (ADR-010 limits customer-originated writes to signing pending contracts); not built. GAP-3 finding: no downstream roll-up of approved change orders into estimates/invoices/contracts — a roll-up would be a new financial model and needs a founder decision.
- S068 is `IN_REVIEW` on merge; full acceptance still owed (browser-evidence workflow dispatch + run record in a follow-up PR).

## Next Eligible Sprint

Sprint ID: S069
Eligibility: S069 is `READY` (governance-only readiness promotion from current main `1388baae` on Billy's word 2026-11-23 "promote every sprint that is ready"). S071 also has satisfied dependencies but stays `PLANNED` — at most one sprint may be `READY` at a time, so it gets its own promotion after S069 leaves `READY`. S068 is `IN_REVIEW` (implementation merged as PR #1067, `1388baae`, 2026-11-24; browser evidence pending). S059 is `IN_REVIEW` (browser evidence pending).
Dependencies: S069 none.
Overlap check: Live open PRs rechecked 2026-11-24 (main `1388baae`): #1066 (CodeQL memberships rate limit). Owns no S069 scope. No S069 implementation branch exists.
Startup prompt: Implement S069 per `docs/architecture/S069_CLOSEOUT_WARRANTY_WORKSPACE_PLAN.md`.
