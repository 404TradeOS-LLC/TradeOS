---
status: current
owner: platform
last_verified: 2026-08-11
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
- Live GitHub verification on 2026-08-11 found zero open PRs; the earlier
  S027 overlap record that named PRs #94, #95, and #96 is now stale history,
  not a current blocker for a bounded Costbook foundation slice.
- S006 is inventory-only: behavior changes, schema/migrations, backend/module
  runtime code, dependencies, workflows, environment configuration, repository
  settings, and `packages/**` are outside scope.
- S027 — Intelligent Costbook production readiness now has a full readiness
  contract in `docs/SPRINT_BACKLOG.md`, but it remains non-executable as a
  broad product sprint. The next directly commissioned Costbook slice is the
  bounded C004 equipment-catalog foundation on its own branch from `main`.

## Verification

- S001 dependency: passed; `DONE` with merged evidence
- current base for the next Costbook slice: `3a856c3121cd5db5a0ec69558b9ea12c3e4f0e6f`
- live open-PR check on 2026-08-11: zero open PRs on `main`; prior overlap
  references to PRs #94, #95, and #96 remain historical evidence only
- Costbook source review: existing module docs identify live Costbook,
  labor/material/equipment, assemblies, supplier queue, Knowledge Runtime, and
  AI Estimate Assist seams to extend rather than rebuild
- external infrastructure requirement for S027 readiness: none; implementation
  must reverify Docker, `psql`, local database access, and supplier-feed
  credentials before claiming integration coverage
- founder decision required for S027: NO
- this governance update records the cleared PR-overlap fact and the next
  bounded Costbook slice only; it does not promote S027 to `READY`

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
Eligibility: READY on `main`; draft PR #95 is the current implementation evidence, and S027 remains a non-executable broad sprint.
Dependencies: S001 is DONE.
Overlap check: live GitHub state on 2026-08-11 shows zero open PRs, so there is no active PR-overlap blocker to restate here. S006 remains the lowest-numbered READY sprint in backlog governance.
Startup prompt: Continue or reconcile S006 lifecycle compatibility inventory when working from sprint order. For the separately commissioned Costbook sequence, extend the existing Costbook workspace/material/labor seams from current `main` with the next bounded slice only.
