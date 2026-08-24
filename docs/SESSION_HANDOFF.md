---
status: current
owner: platform
last_verified: 2026-08-24
source_of_truth: false
related_code:
  - docs/SPRINT_BACKLOG.md
  - docs/architecture/S018_CUSTOMER_PORTAL_AUTHENTICATION_PLAN.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
---

# Session Handoff

## Mission

S018 — Customer portal authentication hardening is complete. S019 — Portal
proposal acceptance flow is now `IN_REVIEW` in implementation PR #296; this
handoff records the active implementation lane and its bounded contract.

## Current branch

`feature/s019-customer-proposal-approval`, based on refreshed `origin/main` at
`93088cc6881bb095376e68238fbc0678daf5ab9b`, with implementation head
`243be37972be7ae99a012ba85f387d74429b5f06` published to PR #296.

## Current truth

- S018 implementation PR #290 merged on 2026-08-24 as
  `6f2dd254c121855fa629d19da6bc0452cc9e6de7`.
- Exact-head Verify repository #1332 passed App typecheck, unit tests,
  PostgreSQL integration/migration rehearsal, build/dependency audit, Athena
  checks, and the aggregate Web lane.
- Exact-head Docs consistency #1229, Dependency review #296, PR branch
  currency #15, Live documentation reconciliation #14, and Sprint governance
  #14 passed for the implementation head; completion-evidence PR #292 also
  passed its exact-head docs, governance, Verify, and dependency checks.
- S018 shipped finite local HS256 token expiry and strict claim validation,
  fail-closed malformed/expired/invalid bearer handling, inactive-user denial
  in refresh/bootstrap, focused HTTP regressions, and PostgreSQL/RLS assertions
  for membership and same-org/cross-org portal resource behavior.
- No new customer identity, portal token persistence, public link, auth-provider
  replacement, RBAC/RLS redesign, schema migration, billing behavior, route/API
  shape change, or portal redesign shipped.
- S019 implementation is bounded to the existing authenticated proposal
  review, viewed, acceptance, decline, and audit/event boundary. PR #296 adds
  organization-scoped conditional transitions, fail-closed competing mutation
  behavior, preserved event/project side effects, and bounded portal action
  feedback. Current permission, session, organization, RLS, actor/org, event,
  and project-side-effect behavior remains unchanged.
- S027 remains separately blocked on authenticated rendered Costbook browser
  evidence. Do not begin S020 or any later sprint from this branch.

## Next Eligible Sprint

Sprint ID: NONE
Eligibility: No numbered sprint is currently `READY`; S019 is `IN_REVIEW` in implementation PR #296 and is not `DONE` until merge and separate completion evidence.
Dependencies: S019 depends on DONE sprints S009 and S018; implementation PR #290, completion-evidence PR #292, and post-merge handoff PR #294 are merged.
Overlap check: PR #296 on `feature/s019-customer-proposal-approval` is the sole S019 implementation lane; no competing implementation branch or worktree exists.
Startup prompt: Finish exact-head validation and review repair on PR #296. If it merges, create a fresh `docs/s019-completion-evidence` governance-only lane; stop for any new identity/auth/authorization/RBAC/RLS/schema/token/legal-signature requirement and do not begin S020.

