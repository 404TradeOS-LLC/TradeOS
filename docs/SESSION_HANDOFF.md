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

This session records S011 — Invoice lifecycle normalization completion after its governance-only readiness promotion and implementation PR merged. The founder-approved decisions remain binding: overdue remains derived, partially-paid remains derived, payment-entry UI expansion is deferred, and S011 owns backend payment reconciliation correctness. S011 is `DONE` with implementation PR #283 and separate completion evidence.

## Current branch

`feature/s011-invoice-lifecycle-normalization`, based on merged readiness `origin/main` `34674ce6f791f9ef67759121a2606e36b216eede`.

## Current truth

- S006 is `DONE` with merged evidence in PR #95.
- S007 implementation PR #261 merged on 2026-08-21 as `e736bb6b92ce00441f2e0863ef3c4d34174571be`.
- S008 implementation PR #264 merged on 2026-08-22 as `dee5f98f0b46e98782b887fca80a63e55800cd65`. Canonical `sent` remains distinct from `ready` across estimates, queue filters, DTOs, and frontend normalization; `rejected` remains compatible with canonical `declined`.
- S009 implementation PR #267 merged on 2026-08-22. New proposal declines persist canonical `declined` through the compatibility `/reject` route; historical `rejected` rows remain read-compatible; S007's canonical Project side effects are preserved.
- PR #268 (bound Supabase serverless connections), PR #270 (restore CURRENT_STATE history after PR #258), PR #271 (restore Supabase pooler TLS compatibility), PR #273 (wait for request transaction acquisition), PR #274 (cover transaction acquisition contention), and PR #277/#278 (deploy/Vercel-ignore fixes) are merged infrastructure/documentation work unrelated to lifecycle normalization. Their database connection and deployment behavior must not be modified by lifecycle work.
- S010 is `DONE`. PR #276 merged 2026-08-23 as `fcbf1fff342053d854ad73667c54a5e44c1bbfb6`. `toDTO()` in `app/modules/contracts/service.ts` maps stored `pending_signature` to canonical `sent` using the existing `normalizeContractStatus` helper; the `contracts.status` check constraint, its default, and the `sign()`/`void()` guards are unchanged (Option A from `docs/architecture/S010_CONTRACT_LIFECYCLE_PLAN.md`). Persisted contract status remains `pending_signature`; Option B (canonical database persistence) remains a separate founder decision and migration. Three pre-existing runtime defects found during the audit (`void()` non-idempotency, missing transaction boundaries around status+event writes, missing optimistic-concurrency guards) are explicitly out of scope and remain unfixed; the canonical `viewed` state also remains unimplemented.
- S011 (Invoice lifecycle normalization) is `DONE`. PR #283 merged 2026-08-24 as `6ca838d39d170fe520e16141e6e5213188f6d5f8`; exact-head verification and PostgreSQL/RLS integration passed. Its bounded contract is concurrent per-Invoice payment reconciliation, valid recorded-payment aggregation, eligible `sent -> paid` persistence including existing raw overdue compatibility, existing request-scoped transaction/event behavior, service-boundary `billing.write` enforcement, and exclusion of persisted terminal invoices from unpaid/partially-paid/overdue follow-up queues. Persisted partially-paid, a new persisted-overdue writer, viewed tracking, payment-entry UI expansion, billing/portal redesign, unrelated Invoice mutation repairs, and S012 remain out of scope.
- S027 remains separately `BLOCKED/PARTIAL` only on authenticated rendered Costbook browser evidence at 1440/1024/768/390 and does not alter numbered lifecycle-sprint selection. No S027 evidence was touched by this session.

## Next Eligible Sprint

Sprint ID: NONE

Eligibility: No numbered sprint is currently `READY`; S011 is `DONE` with merged implementation and completion evidence. S012 remains `PLANNED` and is the next promotion target; S006-S011 are `DONE` with merged evidence.

Dependencies: S011 depends on S006 (`DONE`); the approved readiness contract is complete and the active implementation branch is based on refreshed `origin/main`.

Overlap check: no S011 implementation or completion-evidence work remains active; do not reopen or duplicate S011.

Startup prompt: Begin the governance-only S012 — Job lifecycle normalization readiness promotion from refreshed `origin/main`. Do not implement S012 until that readiness PR merges. Preserve S011's shipped boundaries and do not add persisted Invoice partially-paid/overdue/viewed state, payment UI, billing/portal redesign, unrelated Invoice repairs, or S027 work.
