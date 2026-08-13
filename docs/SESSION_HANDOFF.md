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
  - PR #172 strengthened required CI and merged as `cd9a960861e611956f7ff55d9704461b6586ae47`.
  - PR #175 added sensitive-path CODEOWNERS coverage and merged as `38232b19b3ca02de0856ffbf6ba1f6a798b5ca62`.
  - PR #177 strengthened `AGENTS.md` and merged as `25ce0817b8a87a068348496fca12bd32230bfaf9`.
  - PR #178 added database-aware `/ready` readiness and merged as `834fb3433604045a46dfe377df47fa08cee499d8`.
  - PR #180 added repository-level CodeRabbit policy and merged as `bdcc4bd1dcbf07abb38dd85a924786b6549040a3`.
  - PR #169 modernized the backend development toolchain and merged as `919beaaec3b08d92d268b3a8ac24f11842eb7a82`.
  - PR #181 moved workflow runtimes to `actions/checkout@v7` and `actions/setup-node@v7` and merged as `1d6120ad4598b60d3c14a91366cb73b2bf42bd48`.
- S006 — Lifecycle compatibility inventory is `DONE`; PR #95 merged as `5e59880aba24acbe943b03d1a34aa787cb7db801`.
- S013 — Persist Settings Console brand assets is `DONE`; PR #30 merged as `2d80214a99b476e9a271c04fbe8a608eb80b3883`.
- Costbook C005 hierarchy CRUD is merged. Follow-up PR #151 hardened hierarchy tenant/activity integrity and merged as `5b7dbcbfaa589360fb349f4badaca394683c3da7`.
- Original C004 PR #128 is closed and superseded. Replacement PR #183 (`feature/costbook-c004-reconciled`) rebuilds the equipment catalog directly on post-#151 `main`; its Docs consistency and Verify repository workflows are green, CodeRabbit approved it, and review threads are resolved. It still contains a migration/protected boundary and has not been merged.
- S027 — Intelligent Costbook production readiness remains `BLOCKED`. The old #94/#95/#96 and #151 blockers are resolved, and #128 is retired; current Costbook overlap is PR #183. S027 is broader than C004/C005, so it must not be promoted implicitly while that protected overlap remains.
- PR #145 (`fix/athena-transactional-event-outbox`) now contains the A12.1 transactional canonical-event implementation, unit coverage, a live PostgreSQL rollback test, and the five required canonical documentation updates. Its last pre-reconciliation Verify repository run was green. The branch is two commits behind post-#151 `main` and currently needs an explicit conflict-safe main integration before fresh protected CI/review and draft removal.
- Open issue #153 remains a separate Costbook follow-up record and should be revalidated against the merged #151 behavior and the final C004 state before implementation.

## Operating rules for the next session

- `AGENTS.md` authorizes bounded autonomous maintenance through inspect → validate → root-cause → repair → test → PR → verify → merge only when every required gate permits it.
- Green CI is necessary technical evidence, not authority to merge protected migrations, auth/RLS changes, destructive data work, secrets, billing, or major architecture.
- Existing overlapping PRs should be advanced instead of duplicated.
- No `PLANNED` sprint becomes `READY` merely because a blocker disappears. Readiness requires a governance-only promotion after live dependency, overlap, infrastructure, and founder-decision verification.
- Production repair uses `/health` for process liveness and `/ready` for database-aware readiness before incident classification.
- Live GitHub state is authoritative for PRs, checks, rulesets, and blockers.

## Highest-value existing work

1. Keep PR #183 current with `main` and preserve its protected migration boundary; do not resurrect #128.
2. Reconcile PR #145 onto post-#151 `main`, then require fresh Docs consistency, Verify repository, and review evidence before marking it ready.
3. Re-evaluate S027 only after PR #183 is merged or otherwise retired; do not duplicate already-landed C005/#151 hierarchy work.
4. Revalidate issue #153 against the final Costbook state before treating it as active implementation scope.

## Next Eligible Sprint

Sprint ID: NONE
Eligibility: No numbered sprint is currently `READY`. S006 and S013 are complete; S027 remains blocked by current Costbook overlap in PR #183; other unfinished numbered sprints remain `PLANNED`, `BLOCKED`, or require explicit readiness promotion.
Dependencies: N/A until a specific planned sprint is promoted through the canonical readiness process.
Overlap check: Current material overlap includes protected Costbook PR #183 and draft Athena PR #145. PR #151 is merged and PR #128 is closed superseded.
Startup prompt: Advance or reconcile already-authorized open work first. If no existing PR should proceed, perform a governance-only readiness review and promote exactly one eligible `PLANNED` sprint; do not invent feature scope or treat a planned sprint as ready implicitly.
