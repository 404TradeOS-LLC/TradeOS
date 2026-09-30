---
status: current
owner: platform
last_verified: 2026-09-22
source_of_truth: false
related_docs:
  - docs/SPRINT_BACKLOG.md
  - docs/CURRENT_STATE.md
  - docs/ENGINEERING_COMMAND_CENTER.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
---

# Session Handoff

## Current truth

- Bounded staging-recovery repair prepared from main
  `893c65fda8e3c06db9e193a4071eb2e05331a94d` on
  `fix/staging-immutable-readiness`. This is operational maintenance, not a
  numbered-sprint completion or a release-certification claim.
- PR #594 already removed the stale pinned deployment URL. The follow-up
  replaces first-URL parsing and mutable-alias readiness with verified
  project/team/repository/Preview identity, captured staging SHA, redeploy by
  ID, immutable runtime probes, and retained sanitized evidence.
- The live production frontend identified on 2026-09-30 serves `bf3b6419`,
  while main is `893c65fd`. Staging is `2857c4a5` and has not been proven
  equivalent to current main. A fresh repair run and authenticated Preview
  evidence are still required.
- PR #561 owns the related frontend build-skip guard. The recovered
  `evidence/s053-auth-browser-6271713` branch contains an older exact-pair
  browser harness; do not mistake its pinned SHA for current-main evidence.
- No auth/RLS, migration, pricing policy, production credential, or product
  behavior changed in this maintenance lane.

## Verification

Focused deployment-boundary regressions pass locally. Required root governance
checks and hosted PR checks must be retained for the final repair head. Runtime
repair, authenticated login, browser capture, and production promotion are not
claimed by local tests.

## Next action

Finish the repair PR through the normal required checks, dispatch
`repair-staging-supabase-auth.yml` with `REPAIR_STAGING_AUTH`, and retain its
replacement deployment identity/readiness artifact. Reconcile the staging code
with the intended release SHA and run the existing authenticated evidence lane
against an isolated Preview; do not promote from repository merge state alone.

## Next Eligible Sprint

Sprint ID: S053
Eligibility: `READY` in the separate governance promotion; implementation starts only after that PR merges.
Dependencies: S051 is DONE; no competing S053 implementation was found.
Overlap check: 17 open PRs were reconciled on 2026-09-22; no S053 overlap was found.
Startup prompt: Start S053 from current `main` after readiness merge and retain explicit review/denial/provenance evidence.

