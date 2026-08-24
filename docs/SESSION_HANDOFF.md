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

S018 — Customer portal authentication hardening is complete. Implementation PR
#290 and the required separate completion-evidence PR #292 are merged. This
handoff records the landed truth and the next authorized governance action; no
product/runtime code is being implemented.

## Current branch

`docs/s018-post-merge-handoff`, based on refreshed `origin/main` at
`8def755e2109222d9a5fd357d8fbc93585bb8cbe`, the verified completion-evidence
merge SHA for S018.

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
- S027 remains separately blocked on authenticated rendered Costbook browser
  evidence. Do not begin S019 implementation from this branch.

## Next Eligible Sprint

Sprint ID: NONE
Eligibility: No numbered sprint is currently `READY`; S019 is the lowest planned dependency-complete candidate and requires a governance-only readiness promotion.
Dependencies: S019 depends on DONE sprints S009 and S018; the completion evidence is merged.
Overlap check: no S019 implementation lane exists; do not start one from this branch.
Startup prompt: Refresh `origin/main`, rerun the canonical selector, and prepare one bounded S019 readiness-promotion PR without implementing S019.
