---
status: current
owner: platform
last_verified: 2026-08-23
source_of_truth: false
related_code:
  - docs/SPRINT_BACKLOG.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
---

# Session Handoff

## Mission

This session is implementing S011 — Invoice lifecycle normalization after the governance-only readiness promotion merged. The founder-approved decisions remain binding: overdue remains derived, partially-paid remains derived, payment-entry UI expansion is deferred, and S011 owns backend payment reconciliation correctness. S011 is `IN_REVIEW`, not `DONE`; a separate completion-evidence reconciliation is required after the implementation PR merges.

## Current branch

`feature/s011-invoice-lifecycle-normalization`, based on merged readiness `origin/main` `34674ce6f791f9ef67759121a2606e36b216eede`.

## Current truth

- S006 is `DONE` with merged evidence in PR #95.
- S007 implementation PR #261 merged on 2026-08-21 as `e736bb6b92ce00441f2e0863ef3c4d34174571be`.
- S008 implementation PR #264 merged on 2026-08-22 as `dee5f98f0b46e98782b887fca80a63e55800cd65`. Canonical `sent` remains distinct from `ready` across estimates, queue filters, DTOs, and frontend normalization; `rejected` remains compatible with canonical `declined`.
- S009 implementation PR #267 merged on 2026-08-22. New proposal declines persist canonical `declined` through the compatibility `/reject` route; historical `rejected` rows remain read-compatible; S007's canonical Project side effects are preserved.
- PR #268 (bound Supabase serverless connections), PR #270 (restore CURRENT_STATE history after PR #258), PR #271 (restore Supabase pooler TLS compatibility), PR #273 (wait for request transaction acquisition), PR #274 (cover transaction acquisition contention), and PR #277/#278 (deploy/Vercel-ignore fixes) are merged infrastructure/documentation work unrelated to lifecycle normalization. Their database connection and deployment behavior must not be modified by lifecycle work.
- S010 is `DONE`. PR #276 merged 2026-08-23 as `fcbf1fff342053d854ad73667c54a5e44c1bbfb6`. `toDTO()` in `app/modules/contracts/service.ts` maps stored `pending_signature` to canonical `sent` using the existing `normalizeContractStatus` helper; the `contracts.status` check constraint, its default, and the `sign()`/`void()` guards are unchanged (Option A from `docs/architecture/S010_CONTRACT_LIFECYCLE_PLAN.md`). Persisted contract status remains `pending_signature`; Option B (canonical database persistence) remains a separate founder decision and migration. Three pre-existing runtime defects found during the audit (`void()` non-idempotency, missing transaction boundaries around status+event writes, missing optimistic-concurrency guards) are explicitly out of scope and remain unfixed; the canonical `viewed` state also remains unimplemented.
- S011 (Invoice lifecycle normalization) is `IN_REVIEW` on the implementation branch. Its bounded contract is concurrent per-Invoice payment reconciliation, valid recorded-payment aggregation, eligible `sent -> paid` persistence with existing request-scoped transaction/event behavior, and exclusion of persisted terminal invoices from unpaid/partially-paid/overdue follow-up queues. Persisted partially-paid, a new persisted-overdue writer, viewed tracking, payment-entry UI expansion, billing/portal redesign, unrelated Invoice mutation repairs, and S012 remain out of scope.
- S027 remains separately `BLOCKED/PARTIAL` only on authenticated rendered Costbook browser evidence at 1440/1024/768/390 and does not alter numbered lifecycle-sprint selection. No S027 evidence was touched by this session.

## Next Eligible Sprint

Sprint ID: NONE

Eligibility: No numbered sprint is currently `READY`; S011 is `IN_REVIEW` after the governance-only readiness promotion and its implementation PR is the active work. S006, S007, S008, S009, and S010 are `DONE` with merged evidence.

Dependencies: S011 depends on S006 (`DONE`); the approved readiness contract is complete and the active implementation branch is based on refreshed `origin/main`.

Overlap check: the active S011 implementation PR is the only S011 runtime work; do not open a duplicate.

Startup prompt: Continue from `feature/s011-invoice-lifecycle-normalization`, revalidate runtime drift against `docs/architecture/S011_INVOICE_LIFECYCLE_PLAN.md`, and implement only the approved backend payment-reconciliation slice. Do not add persisted partially-paid/overdue/viewed state, payment UI, billing/portal redesign, unrelated Invoice repairs, or S012.
