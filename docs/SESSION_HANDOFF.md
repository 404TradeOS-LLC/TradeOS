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

S018 — Customer portal authentication hardening is complete. This governance-only
branch promotes S019 — Portal proposal acceptance flow to `READY`; no
product/runtime code is being implemented.

## Current branch

`docs/s019-readiness-promotion`, based on refreshed `origin/main` at
`15a9abfc1ad71643b6aa6eecec8e63c64c249ff2`, which includes S018 implementation
PR #290, completion-evidence PR #292, and post-merge handoff PR #294.

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
- S019 readiness is bounded to the existing authenticated proposal review,
  viewed, acceptance, decline, and audit/event boundary. The readiness plan
  requires current permission, session, organization, RLS, actor/org, event,
  and project-side-effect behavior to remain unchanged unless a separate
  founder decision authorizes otherwise. It also requires reproducing and
  repairing the known competing-transition race with atomic conditional
  transitions or equivalent serialization inside the existing transaction
  architecture.
- S027 remains separately blocked on authenticated rendered Costbook browser
  evidence. Do not begin S020 or any later sprint from this branch.

## Next Eligible Sprint

Sprint ID: S019
Eligibility: S019 is `READY` through this governance-only readiness promotion; implementation may begin only after this PR merges and the live selector still selects S019.
Dependencies: S019 depends on DONE sprints S009 and S018; implementation PR #290, completion-evidence PR #292, and post-merge handoff PR #294 are merged.
Overlap check: no S019 implementation branch or PR exists; this is the sole S019 readiness lane.
Startup prompt: After this PR merges, refresh `origin/main`, rerun the canonical selector, and create `feature/s019-portal-proposal-acceptance` for the bounded implementation contract. Stop for a founder decision if a new customer identity, authorization policy, RBAC/RLS policy, schema, token model, or legal-signature policy is required.
