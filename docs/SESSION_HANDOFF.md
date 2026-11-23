---
status: current
owner: platform
last_verified: 2026-11-23
source_of_truth: true
related_docs:
  - docs/TRADEOS_BIBLE.md
  - docs/ENGINEERING_COMMAND_CENTER.md
  - docs/CURRENT_STATE.md
  - docs/SPRINT_BACKLOG.md
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
---

## Readiness promotion — 2026-11-23: S068 promoted to READY

- Base: `main` at `bf23a3f5`. Branch `docs/promote-s068-s069-s071-ready`, governance-only readiness PR on the founder's word ("promote every sprint that is ready").
- S068 is `READY`: no dependencies; live overlap rechecked 2026-11-23 (open PRs #1044, #1045, #1048, #1049, #1052, #1053 — none owns change-order scope); no S068 implementation branch exists.
- Plan doc: `docs/architecture/S068_CHANGE_ORDER_CUSTOMER_WORKFLOW_PLAN.md`. S068 certifies the implemented change-order contract (draft/approved/rejected state machine, portal review, audit, downstream visibility without mutating historical snapshots).
- S069 and S071 also have satisfied `Dependencies:` but stay `PLANNED`: the sprint-state validator (`scripts/sprint-state-check.mjs`) allows at most one `READY` sprint at a time, so each gets its own promotion after S068 leaves `READY`. Their plan docs were drafted during this promotion and removed from the branch — they regenerate from current main at their own promotion time, per the #619 stale-branch lesson.
- `Release certification prerequisites:` do not block `READY` (S054/S059 for S068 — S054 PLANNED, S059 IN_REVIEW, reference-validated only).
- S068 is the next eligible sprint; the 03:00 sprint runner selects it next.

## Sprint start — 2026-11-23: S059 implemented (merged PR #1032)

- Base: `main` at `76b8da0a`. Branch `feat/s059-portal-certification`, PR #1032 merged 2026-11-23 as squash `0a3aeefe`.
- S059 is `IN_REVIEW`: GAP-1 detail-page access-required repair + web tests, live-PostgreSQL portal integration tests (11 tests), S059 browser-evidence workflow + capture script + contract test, evidence document `docs/architecture/S059_CERTIFICATION_EVIDENCE.md`.
- Browser capture vs staging is dispatched from `main` now that the PR has merged; the run artifact is recorded in the evidence document in a follow-up PR. Expired-token/session browser states (B6/E4) are BLOCKED on staging-DB write access (owner: Billy); live-PostgreSQL expiry evidence is the substitute in the merged PR.
- Staging head `7c428acd` vs main `255bbc41`: the portal-surface diff is PR #937 (redaction) + PR #1001 (session-hash scoping). A staging browser run certifies the staging surface; #1001 is proven on main only by the live-DB integration tests until staging is promoted.

## Next Eligible Sprint

Sprint ID: S068
Eligibility: S068 is `READY` (governance-only readiness promotion from current main `bf23a3f5` on Billy's word 2026-11-23 "promote every sprint that is ready"). S069 and S071 also have satisfied dependencies but stay `PLANNED` — at most one sprint may be `READY` at a time, so each gets its own promotion after S068 leaves `READY`. S059 is `IN_REVIEW` (implementation merged as PR #1032, `0a3aeefe`, 2026-11-23; browser evidence pending). S046/S048/S050 remain blocked.
Dependencies: S068 none.
Overlap check: Live open PRs rechecked 2026-11-23 (main `bf23a3f5`): #1044, #1045, #1048, #1049, #1052, #1053. None owns S068 scope. No S068 implementation branch exists.
Startup prompt: Implement S068 per `docs/architecture/S068_CHANGE_ORDER_CUSTOMER_WORKFLOW_PLAN.md`.
