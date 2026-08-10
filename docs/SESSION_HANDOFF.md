---
status: current
owner: platform
last_verified: 2026-08-09
source_of_truth: true
related_code:
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/SPRINT_BACKLOG.md
  - docs/ENGINEERING_COMMAND_CENTER.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
  - docs/TRADEOS_BIBLE.md
---

# TradeOS Session Handoff

## Current state

- S005 is `DONE`. PR #84 merged on 2026-08-06 as
  `7d1c48376861468122347e19c41f0a007d7b5fc9`.
- Production auth/runtime recovery through PR #92 is merged on `main` as
  `477fb2e919d4001772628c6a91fcded07555ba74`; S006 readiness PR #93 is merged
  on `main` as `378c12e86410f4e9150953dd9d677c1701a3812d`.
- S006 — Lifecycle compatibility inventory is the lowest-numbered `READY`
  sprint. Draft PR #95 is its current implementation evidence.
- Concurrent UI work is active in PR #94 and touches dashboard/shared frontend
  surfaces plus `docs/SESSION_HANDOFF.md`, so later dashboard Costbook work
  must reverify overlap before editing.
- S006 is inventory-only: behavior changes, schema/migrations, backend/module
  runtime code, dependencies, workflows, environment configuration, repository
  settings, and `packages/**` are outside scope.
- S027 — Intelligent Costbook production readiness now has a full readiness
  contract in `docs/SPRINT_BACKLOG.md`, but it remains `BLOCKED` by active PR
  overlap rather than executable.

## Verification

- S001 dependency: passed; `DONE` with merged evidence
- current base for S027 readiness review: `378c12e86410f4e9150953dd9d677c1701a3812d`
- live open-PR check: PR #94 overlaps dashboard/frontend and this handoff; PR
  #96 overlaps Knowledge Runtime packaging; PR #95 owns S006 implementation
  evidence; PR #89 is dependency-only and non-overlapping unless package work is
  requested
- Costbook source review: existing module docs identify live Costbook,
  labor/material/equipment, assemblies, supplier queue, Knowledge Runtime, and
  AI Estimate Assist seams to extend rather than rebuild
- external infrastructure requirement for S027 readiness: none; implementation
  must reverify Docker, `psql`, local database access, and supplier-feed
  credentials before claiming integration coverage
- founder decision required for S027: NO
- readiness branch owns governance/continuity only; no product behavior,
  schema, package, dependency, UI, or runtime change

## Out-of-band UI sprint (2026-08-09, branch `ui/modernize-shell-dashboard-customers`)

Not a Sprint Backlog promotion — a directly-commissioned, explicitly bounded
UI/UX-only pass, on its own short-lived branch off `main` @ `477fb2e`
(current tip at start, after PRs #87-#92). Does not claim or affect S006
readiness (PR #93, untouched by this work).

- Scope: global shell/nav, owner dashboard, Customers (wired the
  already-built `CustomerDirectory`), a narrow Dispatch mobile/a11y fix, and
  shared primitives (`Card`, `SelectField`, `STATUS_TONES`, new
  `PageHeader`). See `docs/CURRENT_STATE.md`'s "Recent verified changes" for
  the full breakdown.
- Explicitly out of scope and unchanged: auth/session behavior, Supabase
  bootstrap logic, RLS/session-context logic, backend JWT verification,
  CORS, `TRUST_PROXY`, Vercel routing, production env-variable contracts,
  database schema/migrations, tenant isolation.
- Verification: `cd web && npm test/lint/build` all pass; `npm run
  docs:check`/`docs:test` pass. Live-rendered `/login` and `/signup` at four
  viewports (no overflow, no console errors). Did not attempt live
  authenticated verification of `/dashboard`/`/customers`/`/dispatch`
  against the project's real Supabase project(s) — recorded as an
  environment-blocked check, not skipped, per the sprint's own
  production-safety priority.
- Status at handoff time: implementation complete, PR pending. Update this
  entry (or remove it once merged) rather than leaving it stale.

- Follow-up on the owner dashboard: the same branch now adds a live org-scoped
  task feed and real task activity without touching Athena surfaces.
  `GET /api/v1/projects/tasks` serves prioritized project/customer/job-backed
  tasks through the existing auth + org + DB-session middleware stack, and the
  dashboard uses it for the "Tasks To Move" queue, overdue-task KPI truth, and
  recent task movement panel while preserving the live dispatch-backed Today
  schedule already present on `main`.

## Next Eligible Sprint

Sprint ID: S006
Eligibility: READY on `main`; draft PR #95 is the current implementation evidence, and S027 remains BLOCKED by active overlap.
Dependencies: S001 is DONE.
Overlap check: PR #95 owns S006 implementation evidence; PR #94 overlaps UI/dashboard docs; PR #96 overlaps Knowledge Runtime packaging; S006 remains the lowest-numbered READY sprint.
Startup prompt: Continue or reconcile S006 lifecycle compatibility inventory from current main and PR #95 before promoting S027 to READY; do not begin Intelligent Costbook implementation until its active dashboard/UI and Knowledge Runtime overlap clears.
