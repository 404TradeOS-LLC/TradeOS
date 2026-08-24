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

Backlog acceleration after S019 completion. S019 is DONE; this governance-only
lane promotes S021 to READY while recording S020's founder/legal-signature
blocker and S027's separate environment-evidence blocker. No numbered sprint
implementation has started.

## Current branch

`docs/s021-readiness`, based on refreshed `origin/main` at
`4412704bbf81c9cf26da94d6b22cfe556fc231de`.

## Current truth

- S019 implementation PR #296 merged as
  `9291ccd58624326b1bb142d47d50f97f85b413e3`; separate completion-evidence PR
  #297 merged as `4412704bbf81c9cf26da94d6b22cfe556fc231de`.
- S021 depends on S011 and S018, both DONE with merged implementation and
  completion evidence.
- S021 is presentation-centric: use existing Invoice.amount, recorded Payment
  rows, derived paid/balance/partial/overdue semantics, authenticated portal
  reads, billing permissions, request-scoped sessions, and forced RLS.
- S020 is not promoted: the current internal `documents.manage` sign route
  captures typed/drawn input, server time, request IP, and events, but does not
  establish customer identity, identity verification, immutable signed-document
  evidence, or a founder-approved legal meaning for “signed”.
- S027 remains BLOCKED/PARTIAL pending authenticated rendered Costbook evidence.
  The workflow requires `S027_E2E_STORAGE_STATE_B64`; secret configuration is
  not inspectable through this session's GitHub read connector, and no workflow
  dispatch capability is available here. No credential value is exposed.
- No S020/S021/S022/S024 implementation PR, remote implementation branch, or
  competing implementation worktree was found in the live overlap search.

## Next Eligible Sprint

Sprint ID: S021
Eligibility: S021 is the lowest-numbered READY sprint with DONE dependencies; S020 remains PLANNED and blocked on a founder/legal-signature decision.
Dependencies: S021 depends on S011 and S018, both DONE.
Overlap check: no active S021 implementation lane exists; only this governance-only readiness lane is active. S027 remains independent and blocked.
Startup prompt: Verify the S021 readiness PR merges, refresh origin/main, create `feature/s021-portal-invoice-presentation` in a separate worktree, and implement only the bounded presentation contract. Do not implement S020, S022, S024, or S027 from that branch.
