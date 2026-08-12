---
status: current
owner: platform
last_verified: 2026-08-12
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

- Repository hardening completed on 2026-08-12:
  - PR #172 strengthened the required CI gates and merged as `cd9a960861e611956f7ff55d9704461b6586ae47`.
  - PR #175 added sensitive-path CODEOWNERS coverage and merged as `38232b19b3ca02de0856ffbf6ba1f6a798b5ca62`.
  - PR #177 strengthened `AGENTS.md` into the autonomous engineering contract and merged as `25ce0817b8a87a068348496fca12bd32230bfaf9`.
  - PR #178 added dependency-aware production readiness (`/ready`) and merged as `834fb3433604045a46dfe377df47fa08cee499d8`.
- S006 — Lifecycle compatibility inventory is `DONE`. PR #95 merged on 2026-08-10 as `5e59880aba24acbe943b03d1a34aa787cb7db801`.
- S013 — Persist Settings Console brand assets is `DONE`. PR #30 merged on 2026-08-04 as `2d80214a99b476e9a271c04fbe8a608eb80b3883`.
- S027 — Intelligent Costbook production readiness remains `BLOCKED`, but its 2026-08-09 blockers are obsolete. PRs #94, #95, and #96 are merged. Current overlapping Costbook work includes PR #128 (C004 equipment catalog foundation) and PR #151 (hierarchy RLS/active-parent hardening).
- PR #151 is a high-value security/data-integrity repair, but its migration makes it a protected PR-only/human-decision change under the autonomous agent contract. Its current documented blocker is required synchronization of `docs/CURRENT_STATE.md` and `docs/DOMAIN_MODEL.md` before merge.
- PR #145 is intentionally draft/incomplete Athena transactional-event work tied to issue #144; do not treat it as merge-ready maintenance.
- PR #169 is a broad development-toolchain dependency upgrade and is not a low-risk autonomous merge candidate.
- PR #171 adds repository CodeRabbit configuration and may be rebuilt from current `main` after this queue reconciliation if still desired.
- Dependabot PRs #130 and #131 update GitHub Actions. Because workflow changes trigger documentation ownership, do not merge those raw PRs without a governed workflow/docs update.
- Open issues verified during this reconciliation are #144 (Athena transactional event persistence) and #153 (Costbook activation permission and migration-sequencing follow-up).
- Stale Dependabot PR #158, which targeted the non-canonical self-nested Knowledge Engine duplicate tree, was closed as not planned.

## Operating rules for the next session

- `AGENTS.md` now authorizes bounded autonomous maintenance through inspect → validate → root-cause → repair → test → PR → verify → merge when every required gate permits it.
- Green CI is necessary evidence, not authority to merge protected changes such as new/material migrations, auth/RLS policy changes, secrets, billing, destructive operations, or major architecture.
- Existing overlapping PRs should be advanced instead of duplicated.
- No `PLANNED` sprint becomes `READY` merely because its dependency completed. Readiness requires a separate governance-only promotion after live dependency, overlap, infrastructure, and founder-decision verification.
- The Production Repair scheduled agent now uses `/health` for process liveness and `/ready` for database-aware readiness before classifying production incidents.

## Highest-value existing work

1. Reconcile and advance PR #151 without bypassing its migration/docs gate.
2. Rebase/review PR #128 against the current hardened `main`; keep its feature/migration scope out of maintenance auto-merge.
3. Complete PR #145 only within issue #144's transactional-event contract; it remains draft until production code and rollback tests exist.
4. Rebuild/review PR #171 from current `main` if CodeRabbit repository configuration remains desired.
5. Replace raw #130/#131 with one governed GitHub Actions upgrade PR if the action-runtime upgrade is still appropriate.

## Next Eligible Sprint

Sprint ID: NONE
Eligibility: No numbered sprint is currently `READY`. S006 and S013 are complete; S027 is blocked by current Costbook overlap; all other unfinished numbered sprints are `PLANNED`, `BLOCKED`, or otherwise require explicit readiness promotion.
Dependencies: N/A until a specific planned sprint is promoted through the canonical readiness process.
Overlap check: Current open work includes Costbook PRs #128 and #151, draft Athena PR #145, CodeRabbit PR #171, dependency PR #169, and GitHub Actions dependency PRs #130/#131. Reverify live GitHub state before choosing any implementation scope.
Startup prompt: Advance or reconcile already-authorized open work first. If no existing PR should be advanced, perform a governance-only readiness review and promote exactly one eligible `PLANNED` sprint; do not invent feature scope or treat a planned sprint as ready implicitly.
