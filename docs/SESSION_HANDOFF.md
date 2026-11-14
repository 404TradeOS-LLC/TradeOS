---
status: current
owner: platform
last_verified: 2026-11-22
source_of_truth: true
related_docs:
  - docs/TRADEOS_BIBLE.md
  - docs/ENGINEERING_COMMAND_CENTER.md
  - docs/CURRENT_STATE.md
  - docs/SPRINT_BACKLOG.md
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
---

## Sprint start — 2026-11-22: S073 stale-READY repair (governance-only)

- Base: `main` at `e3a7ed7a` (after #1019 merged). Branch `docs/s073-completion-20261122`.
- The backlog still listed S073 as `READY`, but its implementation merged 2026-11-21: PR #1000 (squash `4d8f8a74`, head `c96d05cd`) landed the release-critical RLS coverage matrix, deterministic validator, and disposable-PostgreSQL same-org/cross-org evidence; repair PR #1001 merged 2026-11-18 as `6f860f34`. Per `NEXT_SPRINT_PROTOCOL.md` rule 3, a stale `READY` record stops implementation and is repaired in a governance-only PR — this PR.
- This PR marks S073 `DONE` with that merge evidence in `SPRINT_BACKLOG.md`, records completion in `TRADEOS_BIBLE.md` and `ENGINEERING_COMMAND_CENTER.md`, corrects S082's stale "S073 remains PLANNED" blocker line, and replaces this handoff. No code, schema, migration, RLS-policy, auth, or product change.
- Live overlap rechecked 2026-11-22: open PRs #1018 (Costbook assembly sources, draft), #1016 (DOC_OWNERSHIP rule change, draft), #1015/#1010 (docs staleness lanes, drafts), #988 (estimates PDF, draft). None owns a READY sprint or duplicates this record. Draft docs PRs #1015/#1010 touch the same planning docs and will need a rebase reconcile after this merges.
- After this PR merges, no sprint is `READY`. The lowest-numbered `PLANNED` sprints with satisfied `Dependencies:` are S059, S068, S069, S071; each needs an explicit governance-only readiness promotion before selection. S046/S048/S050 remain blocked on unmet dependencies or unresolved founder decisions.

## Estimate materials checklist — draft branch handoff, 2026-11-13

- Founder-directed non-numbered, additive read-only feature in `feat/estimate-materials-shopping-pdf-20261113`; base `main` was `31ef992e795a20a862dceea341df239e7c794083`. GitHub connector can read/write branches and PRs; this session has no locally cloned TradeOS worktree or local dependencies (container DNS blocks GitHub clone), so local full-suite acceptance must **not** be asserted.
- Scoped files: Estimate material projection and PDF module, GET controller/router, Estimate workspace panel, focused app/web regressions and owning docs. No migration, auth/RLS modification, pricing edit, deployment, purchase, email or production action.
- API: `GET /api/v1/estimates/:id/materials/pdf` requires `crm.read`, scoped Estimate and Project, rejects absent/invalid material takeoff with 409, sends only safe quantity/description/unit/section to PDF. Assemblies are counted but not exploded. Web preview and download route through existing authenticated binary proxy.
- Before merge, review exact final-head CI/app/web test evidence, code review, docs ownership, preview/download under an approved nonproduction session and branch currency. This feature is **not** an authenticated beta certification or a complete assembly takeoff.

## Next Eligible Sprint

Sprint ID: NONE
Eligibility: No `READY` sprint remains — S073 is `DONE` (PR #1000 merged); the nearest `PLANNED` sprints (S059, S068, S069, S071) require readiness promotion first.
Dependencies: n/a for this state; the next promotion must re-verify dependencies, live overlap, and founder-decision state at promotion time.
Overlap check: Live open PRs rechecked 2026-11-22 on main `e3a7ed7a` — no READY sprint exists and no open PR owns the next promotion.
Startup prompt: Run a governance-only readiness promotion for the lowest-numbered eligible `PLANNED` sprint (S059 first by number, subject to dependency, overlap, and founder-decision checks at promotion time). Do not implement until that promotion merges.
