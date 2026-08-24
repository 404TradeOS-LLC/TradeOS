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

This governance-only branch records the separate S018 — Customer portal
authentication hardening completion evidence required after implementation
merge. No product/runtime code is changed here.

## Current branch

`docs/s018-completion-evidence`, based on refreshed `origin/main` at
`6f2dd254c121855fa629d19da6bc0452cc9e6de7`, the verified merge SHA for
implementation PR #290.

## Current truth

- S018 implementation PR #290 merged on 2026-08-24 as
  `6f2dd254c121855fa629d19da6bc0452cc9e6de7`.
- Exact-head Verify repository #1332 passed App typecheck, unit tests,
  PostgreSQL integration/migration rehearsal, build/dependency audit, Athena
  checks, and the aggregate Web lane.
- Exact-head Docs consistency #1229, Dependency review #296, PR branch
  currency #15, Live documentation reconciliation #14, and Sprint governance
  #14 passed; all review threads were resolved before merge.
- S018 shipped finite local HS256 token expiry and strict claim validation,
  fail-closed malformed/expired/invalid bearer handling, inactive-user denial
  in refresh/bootstrap, focused HTTP regressions, and PostgreSQL/RLS assertions
  for membership and same-org/cross-org portal resource behavior.
- No new customer identity, portal token persistence, public link, auth-provider
  replacement, RBAC/RLS redesign, schema migration, billing behavior, route/API
  shape change, or portal redesign shipped.
- S027 remains separately blocked on authenticated rendered Costbook browser
  evidence. Do not begin S019 implementation from this branch.

## Completion-evidence status

Sprint ID: S018
Eligibility: S018 is `DONE` once this separate completion-evidence PR merges; implementation PR #290 is already merged.
Dependencies: S007, S009, S010, and S011 are `DONE` with merged evidence.
Overlap check: this is the sole S018 governance-only completion-evidence lane; no S019 implementation branch or PR exists.

## Next Eligible Sprint

Sprint ID: NONE
Eligibility: No numbered sprint is currently `READY`; S019 is the lowest planned dependency-complete candidate and requires a governance-only readiness promotion.
Dependencies: S019 depends on DONE sprints S009 and S018; rerun the canonical selector after this evidence PR merges.
Overlap check: no S019 implementation lane exists; do not start one from this branch.
Startup prompt: Merge this evidence PR, refresh `origin/main`, rerun the canonical selector, and prepare one bounded S019 readiness-promotion PR without implementing S019.
