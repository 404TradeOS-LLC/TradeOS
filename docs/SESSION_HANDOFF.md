---
status: current
owner: platform
last_verified: 2026-08-22
source_of_truth: false
related_code:
  - docs/SPRINT_BACKLOG.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
---

# Session Handoff

## Mission

This session records the S009 — Proposal lifecycle normalization implementation review.

## Current branch

`feature/s009-proposal-lifecycle-normalization` — implementation PR #267, based on current `origin/main` `c8d130fd62ece41d0f153d8b99956167f91229fc`.

## Current truth

- S006 is `DONE` with merged evidence in PR #95.
- S007 implementation PR #261 merged on 2026-08-21 as `e736bb6b92ce00441f2e0863ef3c4d34174571be`; `origin/main` now includes that work.
- S008 implementation PR #264 merged on 2026-08-22 as `dee5f98f0b46e98782b887fca80a63e55800cd65`. Canonical `sent` remains distinct from `ready` across contracts, queue filters, DTOs, and frontend normalization; `rejected` remains compatible with canonical `declined`.
- S009 is `IN_REVIEW` in PR #267. The bounded implementation persists new declines as canonical `declined`, keeps historical `rejected` rows read-compatible, normalizes regular proposal DTOs and terminal transition checks, and emits canonical `proposal.declined` metadata through the compatibility `/reject` route. S007's canonical Project side effects remain unchanged. The additive migration needs normal PR/human migration review; `generated`/`expired` mutation paths remain separate.
- Estimate Engine still enforces the implemented `draft -> ready` finalize path and draft-only mutations. Customer-facing send/view/approve/expire/supersede routes are not added by S008.
- No estimate schema migration, permission-model change, or destructive historical rewrite is introduced.
- S027 remains separately `BLOCKED` only on authenticated rendered Costbook browser evidence and does not alter numbered lifecycle-sprint selection.

## Next Eligible Sprint

Sprint ID: NONE

Eligibility: No numbered sprint is currently `READY`; S009 is `IN_REVIEW` through PR #267 and S010 is not eligible until S009 is complete.

Dependencies: S006, S007, and S008 are complete; PR #267 remains the active S009 implementation review.

Overlap check: PR #267 is the sole active S009/proposal-lifecycle implementation PR.

Startup prompt: Complete PR #267's focused verification, CI, and migration review. Do not start S010 from this handoff until S009 is merged or explicitly closed.
