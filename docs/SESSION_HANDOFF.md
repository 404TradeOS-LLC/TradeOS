---
status: current
owner: platform
last_verified: 2026-09-14
source_of_truth: false
related_docs:
  - docs/SPRINT_BACKLOG.md
  - docs/CURRENT_STATE.md
  - docs/ENGINEERING_COMMAND_CENTER.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
---

# Session Handoff

## Mission

Continue draft PR #507, `codex/financial-intelligence-live-data`, with the
first organization-wide Financial Intelligence backend summary and connect the
owner dashboard to it without claiming that estimated cost is actual job cost.

## Current truth

- `origin/main` is `5c1eb6c99fb3e2310fb91ddcb112f69765ab2d4e`.
- Draft PR #507 is the single active financial-intelligence implementation.
  Autonomy reconciliation classified this session `EXISTING_WORK_FOUND`; no
  competing branch or PR was created.
- `GET /api/v1/intelligence/financial-summary` now requires `billing.read`,
  derives organization scope from authenticated request context, and runs
  inside the existing request-scoped database session and forced RLS boundary.
- The summary returns source-aware current-week recorded cash, exact open and
  overdue receivables, unsigned proposal opportunity, and projected committed
  margin from unique persisted Estimate snapshots linked to accepted
  proposals. Independent source failures remain null/unavailable.
- The dashboard prefers the exact aggregate and retains its prior bounded
  queue logic as a visibly labeled degraded fallback.
- Actual job margin remains unavailable. The current schema does not persist
  actual field labor, material usage/purchases, or equipment usage against a
  Job, so no realized margin is inferred.
- Local verification passed backend unit tests (262 suites / 2,285 tests),
  backend lint/typecheck and build, frontend unit tests (280), frontend lint
  and build, PR/docs tests, docs ownership, preflight, and diff whitespace.
  The focused financial suites passed 10 backend tests and 4 frontend model
  tests. The PostgreSQL/RLS regression is committed but local integration was
  blocked because this environment has neither Docker nor PostgreSQL; required
  CI remains authoritative for that lane.
- Other open PRs observed during reconciliation: #506, #503, #502, #500, #497,
  #491, #489, and #482. None substantially overlaps PR #507.

## Next Eligible Sprint
Sprint ID: NONE
Eligibility: `NONE`; no numbered sprint is currently authorized by this non-sprint continuation.
Dependencies: PR #507 must pass exact-head required CI before it can leave draft status.
Overlap check: PR #507 remains the single active financial-intelligence lane; no competing implementation was found.
Startup prompt: Inspect PR #507 exact-head CI and review state, repair only deterministic findings, and retain draft status until rendered browser evidence is available.
