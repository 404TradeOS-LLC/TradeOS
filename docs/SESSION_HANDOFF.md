---
status: current
owner: platform
last_verified: 2026-08-24
source_of_truth: false
related_code:
  - docs/SPRINT_BACKLOG.md
  - docs/architecture/S012_JOB_LIFECYCLE_PLAN.md
  - docs/architecture/S018_CUSTOMER_PORTAL_AUTHENTICATION_PLAN.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
---

# Session Handoff

## Mission

This session records the S018 — Customer portal authentication hardening implementation lane. S018 was selected from `READY` after the required live overlap reconciliation; implementation is bounded to the existing authenticated Supabase/bearer/RLS boundary and remains pending PR review and separate completion evidence.

## Current branch

`feature/s018-customer-portal-auth-hardening`, based on refreshed `origin/main` `1ad6a52355c7e3cd383d862209a02cd0910d4686`. This is the sole S018 implementation write lane.

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
- S018 is `READY` with its bounded plan in `docs/architecture/S018_CUSTOMER_PORTAL_AUTHENTICATION_PLAN.md`. The live portal uses the existing authenticated Supabase session and protected bearer-authenticated API/RLS boundary; no separate customer token or identity model exists. Implement only the scoped hardening/evidence contract, and stop for a founder decision if a new customer-auth policy is required.
- Six independent read-only audits found no confirmed cross-organization IDOR, client-selected organization bypass, or RLS policy defect. They confirmed two local-token defects (non-expiring HS256 access tokens and permissive claim typing), inactive-user gaps in refresh/bootstrap, and a portal behavioral-evidence gap. The implementation adds finite local JWT expiry/strict claims, inactive-user denial, HTTP regressions, and live RLS assertions for same-org/cross-org resources and missing/inactive membership.
- Immediate revocation of already-issued local or Supabase bearer tokens, a new customer identity/token model, RBAC/RLS redesign, schema migration, public links, or portal redesign are protected decisions and were not implemented.

## S018 Implementation Status

Sprint ID: S018

Eligibility: S018 is `READY`; S012 is `DONE`; S014 is `BLOCKED` by its founder architecture decision. S018 dependencies S007, S009, S010, and S011 are `DONE`.

Dependencies: S018 depends on S007, S009, S010, and S011; all are `DONE` with merged evidence.

Overlap check: no open or draft S018 implementation/readiness PR, remote S018 branch, or active S018 worktree was found. Existing portal/auth runtime work is shipped baseline evidence, not a competing implementation.

Implementation branch: `feature/s018-customer-portal-auth-hardening`.

Current state: implementation changes and owned documentation are published in focused draft PR #290; the branch still needs dependency-backed focused tests, required repository checks, exact diff review, and CI/review reconciliation. Do not create a new customer-auth model or begin S019, S020, S021, S022, or S027. Keep S027 separately blocked on authenticated rendered Costbook viewport evidence.
