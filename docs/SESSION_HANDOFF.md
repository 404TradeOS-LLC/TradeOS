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

## Estimate materials checklist — draft branch handoff, reconciled 2026-11-17

- Existing PR #988 branch `feat/estimate-materials-shopping-pdf-20261113` was 2 commits ahead and 11 behind current `main` (`283f14a49fc3903d3f051d68cafbc122f70f65cf`). In an isolated worktree, it was rebased onto current main; four documentation conflicts were reconciled by preserving both the newer main sections and checklist references. Local rebased commit: `07058f50` (not yet pushed at the time of this note).
- Focused app tests pass (2 suites / 10 tests); web preview tests pass (4 tests); app TypeScript check and web TypeScript check pass. Docs ownership check passes, docs tests pass (40/40), and `pr:preflight` reports no missing required docs. Hosted checks listed on the old exact head are historical; rerun and inspect hosted checks on the resulting pushed head.
- API: `GET /api/v1/estimates/:id/materials/pdf` requires `crm.read`, scoped Estimate and Project, rejects absent/invalid material takeoff with 409, sends only safe quantity/description/unit/section to PDF. Assemblies are counted but not exploded. Web preview and download route through existing authenticated binary proxy.
- No database/migration, auth/RLS, pricing, deployment, purchase, email or production changes. Authenticated nonproduction preview/download and tenant-denial evidence remain outstanding. Keep PR #988 draft; no independent approval or founder undraft decision is claimed. This is not an authenticated beta certification or a complete assembly takeoff.

## Next Eligible Sprint

Sprint ID: NONE
Eligibility: No `READY` sprint remains — S073 is `DONE` (PR #1000 merged); the nearest `PLANNED` sprints (S059, S068, S069, S071) require readiness promotion first.
Dependencies: n/a for this state; the next promotion must re-verify dependencies, live overlap, and founder-decision state at promotion time.
Overlap check: Live open PRs rechecked 2026-11-22 on main `e3a7ed7a` — no READY sprint exists and no open PR owns the next promotion.
Startup prompt: Run a governance-only readiness promotion for the lowest-numbered eligible `PLANNED` sprint (S059 first by number, subject to dependency, overlap, and founder-decision checks at promotion time). Do not implement until that promotion merges.
