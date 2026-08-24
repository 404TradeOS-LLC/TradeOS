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

This session records the S012 — Job lifecycle normalization completion evidence. Readiness PR #285 and implementation PR #286 have merged; this branch records the shipped behavior, exact-head verification, and the transition to the next readiness candidate.

## Current branch

`docs/s012-completion-evidence`, based on refreshed `origin/main` `403d84cb6187b59cf468802977a19fbc847ce314` after S012 implementation PR #286 merged. This branch is documentation-only.

## Current truth

- S006 is `DONE` with merged evidence in PR #95.
- S007 implementation PR #261 merged on 2026-08-21 as `e736bb6b92ce00441f2e0863ef3c4d34174571be`.
- S008 implementation PR #264 merged on 2026-08-22 as `dee5f98f0b46e98782b887fca80a63e55800cd65`. Canonical `sent` remains distinct from `ready` across estimates, queue filters, DTOs, and frontend normalization; `rejected` remains compatible with canonical `declined`.
- S009 implementation PR #267 merged on 2026-08-22. New proposal declines persist canonical `declined` through the compatibility `/reject` route; historical `rejected` rows remain read-compatible; S007's canonical Project side effects are preserved.
- PR #268 (bound Supabase serverless connections), PR #270 (restore CURRENT_STATE history after PR #258), PR #271 (restore Supabase pooler TLS compatibility), PR #273 (wait for request transaction acquisition), PR #274 (cover transaction acquisition contention), and PR #277/#278 (deploy/Vercel-ignore fixes) are merged infrastructure/documentation work unrelated to lifecycle normalization. Their database connection and deployment behavior must not be modified by lifecycle work.
- S010 is `DONE`. PR #276 merged 2026-08-23 as `fcbf1fff342053d854ad73667c54a5e44c1bbfb6`. `toDTO()` in `app/modules/contracts/service.ts` maps stored `pending_signature` to canonical `sent` using the existing `normalizeContractStatus` helper; the `contracts.status` check constraint, its default, and the `sign()`/`void()` guards are unchanged (Option A from `docs/architecture/S010_CONTRACT_LIFECYCLE_PLAN.md`). Persisted contract status remains `pending_signature`; Option B (canonical database persistence) remains a separate founder decision and migration. Three pre-existing runtime defects found during the audit (`void()` non-idempotency, missing transaction boundaries around status+event writes, missing optimistic-concurrency guards) are explicitly out of scope and remain unfixed; the canonical `viewed` state also remains unimplemented.
- S011 (Invoice lifecycle normalization) is `DONE`. PR #283 merged 2026-08-24 as `6ca838d39d170fe520e16141e6e5213188f6d5f8`; separate completion evidence PR #284 merged as `0c693a8e29884d29305160498c46e2af38b7e14b`. Its bounded backend payment-reconciliation contract is complete.
- S012 (Job lifecycle normalization) is `DONE`: readiness PR #285 merged as `5264ad84202d832a93ba0a73cb2b291bd0965d46`, implementation PR #286 merged as `403d84cb6187b59cf468802977a19fbc847ce314`, and this separate evidence branch records the outcome. Runtime revalidation confirmed the canonical eight statuses and named service actions. The implementation centralizes the existing transition table, preserves `JobsService.complete()` as `on_site -> completed`, adds focused transition/service/PostgreSQL-RLS coverage, and corrects stale lifecycle/API/RBAC documentation. No schema, status-vocabulary, RBAC/RLS policy, automatic-invoice, or broader architecture change shipped. See `docs/architecture/S012_JOB_LIFECYCLE_PLAN.md`.
- S027 remains separately `BLOCKED/PARTIAL` only on authenticated rendered Costbook browser evidence at 1440/1024/768/390 and does not alter numbered lifecycle-sprint selection. No S027 evidence was touched by this session.

## Next Eligible Sprint

Sprint ID: NONE

Eligibility: No numbered sprint is `READY`. S012 is `DONE`; S014 is `BLOCKED` by its founder architecture decision; S018 remains `PLANNED` and is the next readiness candidate after fresh live reconciliation.

Dependencies: S012 depends on S006 (`DONE`) and its implementation and completion evidence are merged. S018's recorded dependencies S007, S009, S010, and S011 are `DONE`, but S018 has not been promoted to `READY`.

Overlap check: no open S012 implementation or completion-evidence PR remains. Existing Job/Dispatch runtime work is shipped baseline evidence, not a competing implementation.

Startup prompt: Run the canonical startup/reconciliation flow for S018, verify its live dependencies, overlap, founder-decision, infrastructure, ownership, and evidence gates, and create only the governance-only readiness promotion if eligible. Do not implement S018 until its readiness promotion merges. Keep S027 separately blocked on authenticated rendered Costbook viewport evidence.