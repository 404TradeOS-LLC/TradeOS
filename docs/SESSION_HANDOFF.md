---
status: current
owner: platform
last_verified: 2026-08-24
source_of_truth: false
related_code:
  - docs/SPRINT_BACKLOG.md
  - docs/architecture/S012_JOB_LIFECYCLE_PLAN.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
---

# Session Handoff

## Mission

This session records the S012 — Job lifecycle normalization implementation review. The readiness promotion merged as PR #285; this implementation branch contains only the bounded backend normalization and verification of the existing canonical Job transition graph, preserving current roles, assignments, conflicts, tenant/RLS boundaries, activity and required-event behavior, completion/readiness metadata, and request-scoped transactions.

## Current branch

`feature/s012-job-lifecycle-normalization`, based on refreshed `origin/main` `5264ad84202d832a93ba0a73cb2b291bd0965d46` after S012 readiness PR #285 merged. The separate readiness branch remains governance-only.

## Current truth

- S006 is `DONE` with merged evidence in PR #95.
- S007 implementation PR #261 merged on 2026-08-21 as `e736bb6b92ce00441f2e0863ef3c4d34174571be`.
- S008 implementation PR #264 merged on 2026-08-22 as `dee5f98f0b46e98782b887fca80a63e55800cd65`. Canonical `sent` remains distinct from `ready` across estimates, queue filters, DTOs, and frontend normalization; `rejected` remains compatible with canonical `declined`.
- S009 implementation PR #267 merged on 2026-08-22. New proposal declines persist canonical `declined` through the compatibility `/reject` route; historical `rejected` rows remain read-compatible; S007's canonical Project side effects are preserved.
- PR #268 (bound Supabase serverless connections), PR #270 (restore CURRENT_STATE history after PR #258), PR #271 (restore Supabase pooler TLS compatibility), PR #273 (wait for request transaction acquisition), PR #274 (cover transaction acquisition contention), and PR #277/#278 (deploy/Vercel-ignore fixes) are merged infrastructure/documentation work unrelated to lifecycle normalization. Their database connection and deployment behavior must not be modified by lifecycle work.
- S010 is `DONE`. PR #276 merged 2026-08-23 as `fcbf1fff342053d854ad73667c54a5e44c1bbfb6`. `toDTO()` in `app/modules/contracts/service.ts` maps stored `pending_signature` to canonical `sent` using the existing `normalizeContractStatus` helper; the `contracts.status` check constraint, its default, and the `sign()`/`void()` guards are unchanged (Option A from `docs/architecture/S010_CONTRACT_LIFECYCLE_PLAN.md`). Persisted contract status remains `pending_signature`; Option B (canonical database persistence) remains a separate founder decision and migration. Three pre-existing runtime defects found during the audit (`void()` non-idempotency, missing transaction boundaries around status+event writes, missing optimistic-concurrency guards) are explicitly out of scope and remain unfixed; the canonical `viewed` state also remains unimplemented.
- S011 (Invoice lifecycle normalization) is `DONE`. PR #283 merged 2026-08-24 as `6ca838d39d170fe520e16141e6e5213188f6d5f8`; separate completion evidence PR #284 merged as `0c693a8e29884d29305160498c46e2af38b7e14b`. Its bounded backend payment-reconciliation contract is complete.
- S012 (Job lifecycle normalization) is `IN_REVIEW` on this branch after readiness PR #285 merged as `5264ad84202d832a93ba0a73cb2b291bd0965d46`. Runtime revalidation confirmed the canonical eight statuses and named service actions. The implementation centralizes the existing transition table, preserves `JobsService.complete()` as `on_site -> completed`, adds focused transition/service tests, and corrects the stale workflow/matrix completion wording. No schema, status-vocabulary, RBAC/RLS, automatic-invoice, or broader architecture decision was needed. See `docs/architecture/S012_JOB_LIFECYCLE_PLAN.md`.
- S027 remains separately `BLOCKED/PARTIAL` only on authenticated rendered Costbook browser evidence at 1440/1024/768/390 and does not alter numbered lifecycle-sprint selection. No S027 evidence was touched by this session.

## Next Eligible Sprint

Sprint ID: S012

Eligibility: S012 implementation is `IN_REVIEW`; readiness PR #285 merged, S006 is `DONE`, and the implementation contract is explicit.

Dependencies: S012 depends on S006 (`DONE`). S011 is also complete with merged implementation and completion evidence, but S012 must remain on its own branch and must not stack on S011 worktrees.

Overlap check: this is the single active S012 implementation branch. Existing Job/Dispatch runtime work is baseline evidence, not a competing implementation.

Startup prompt: Finish focused/runtime/PostgreSQL verification for `feature/s012-job-lifecycle-normalization`, open the implementation PR with status `IN_REVIEW`, repair deterministic review findings on the same branch, and merge only after exact-head CI and review rules clear. Then record separate S012 completion evidence before any S018, S027, S030, S032, or other sprint work.
