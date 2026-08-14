---
status: current
owner: platform
last_verified: 2026-08-14
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

- Athena production-readiness work is in progress on `feature/athena-production-readiness`, stacked on open PR #200 rather than merged `main`. As of Friday, August 14, 2026, the code path now includes:
  - durable approval and verification boundaries in `app/modules/athena-approvals`;
  - durable audit event boundaries in `app/modules/athena-audit`;
  - Prisma models and migration `20260814120000_add_athena_approvals_and_audit_trail`;
  - explicit Athena permission context plus tool-declared resource scope;
  - context-provider `name`/`priority`/`provide()` contracts with registry ordering by priority;
  - kernel audit emission for request/context/tool/action/approval/completion/failure stages.
- Validation completed in the stacked worktree:
  - `cd app && npm test -- --runTestsByPath tests/athena-action-engine.engine.test.ts tests/athena-kernel.service.test.ts tests/athena-context-engine.assembler.test.ts`
  - `cd app && npm run athena:contracts`
  - `cd app && npm run lint`
  - `cd app && npm run build`
- `npm run docs:check` was blocked until root dependencies were installed in the worktree; after `env -u npm_config_prefix npm ci` at repo root, rerun docs validation before PR publication.
- Repository hardening completed on 2026-08-12:
  - PR #172 strengthened the required CI gates and merged as `cd9a960861e611956f7ff55d9704461b6586ae47`.
  - PR #175 added sensitive-path CODEOWNERS coverage and merged as `38232b19b3ca02de0856ffbf6ba1f6a798b5ca62`.
  - PR #177 strengthened `AGENTS.md` into the autonomous engineering contract and merged as `25ce0817b8a87a068348496fca12bd32230bfaf9`.
  - PR #178 added dependency-aware production readiness (`/ready`) and merged as `834fb3433604045a46dfe377df47fa08cee499d8`.
  - PR #180 added repository-level CodeRabbit policy and merged as `bdcc4bd1dcbf07abb38dd85a924786b6549040a3`.
  - PR #169 modernized the backend development toolchain through TypeScript 6 and Jest 30 and merged as `919beaaec3b08d92d268b3a8ac24f11842eb7a82` after full App/Web/docs/live migration verification.
  - PR #181 replaced stale GitHub Actions bot PRs #130/#131 with one governed runtime update and merged as `1d6120ad4598b60d3c14a91366cb73b2bf42bd48`; repository workflows now use `actions/checkout@v7` and `actions/setup-node@v7` while preserving the explicit TradeOS Node workload versions.
- S006 — Lifecycle compatibility inventory is `DONE`. PR #95 merged on 2026-08-10 as `5e59880aba24acbe943b03d1a34aa787cb7db801`.
- S013 — Persist Settings Console brand assets is `DONE`. PR #30 merged on 2026-08-04 as `2d80214a99b476e9a271c04fbe8a608eb80b3883`.
- S027 — Intelligent Costbook production readiness remains `BLOCKED`. Its original blockers #94/#95/#96 are merged, but active overlap remains in PR #128 (C004 equipment catalog foundation) and PR #151 (hierarchy RLS/active-parent hardening).
- PR #151 remains protected migration/RLS work. Its prior owner-document blocker has been repaired: `docs/CURRENT_STATE.md` and `docs/DOMAIN_MODEL.md` now describe the hardened hierarchy boundary. CodeRabbit subsequently identified and prompted two substantive fixes that were implemented: parent deactivation is rejected while active descendants remain, and cross-organization RLS tests now isolate tenant-policy rejection from active-parent trigger rejection. Fresh required CI/review evidence is still required before merge.
- PR #128 remains large Costbook feature/migration/UI work and must be deliberately rebased/reconciled against current `main` and C005-era hierarchy changes.
- PR #145 remains intentionally draft/incomplete Athena transactional-event work tied to issue #144; production implementation and rollback/failure coverage remain before readiness.
- Open issue #153 tracks the separate Costbook `isActive` permission-boundary and C004/C005 migration-sequencing follow-up.

## Operating rules for the next session

- `AGENTS.md` authorizes bounded autonomous maintenance through inspect → validate → root-cause → repair → test → PR → verify → merge when every required gate permits it.
- Green CI is necessary evidence, not authority to merge protected changes such as material migrations, auth/RLS policy changes, secrets, billing, destructive operations, or major architecture.
- Existing overlapping PRs should be advanced instead of duplicated.
- No `PLANNED` sprint becomes `READY` merely because its dependency completed. Readiness requires a separate governance-only promotion after live dependency, overlap, infrastructure, and founder-decision verification.
- Production repair uses `/health` for process liveness and `/ready` for database-aware readiness before classifying incidents.
- Live GitHub rulesets and required checks must be reverified before repository-control changes; documentation is not a substitute for live state.

## Highest-value existing work

1. Finish fresh CI/review on PR #151, keep it current with `main`, and do not bypass its migration/RLS protections.
2. Rebase/reconcile PR #128 against the hardened Costbook hierarchy and current `main`; keep its feature/migration scope out of maintenance auto-merge.
3. Complete PR #145 only within issue #144's transactional-event contract; it remains draft until production code and rollback tests exist.
4. After #151/#128 reconciliation, re-evaluate S027 readiness through governance rather than implicitly promoting it.

## Next Eligible Sprint

Sprint ID: NONE
Eligibility: No numbered sprint is currently `READY`. S006 and S013 are complete; S027 is blocked by active Costbook overlap; all other unfinished numbered sprints are `PLANNED`, `BLOCKED`, or otherwise require explicit readiness promotion.
Dependencies: N/A until a specific planned sprint is promoted through the canonical readiness process.
Overlap check: Current material overlap includes Costbook PRs #128 and #151 plus draft Athena PR #145. Reverify live GitHub state before choosing implementation scope.
Startup prompt: Advance or reconcile already-authorized open work first. If no existing PR should be advanced, perform a governance-only readiness review and promote exactly one eligible `PLANNED` sprint; do not invent feature scope or treat a planned sprint as ready implicitly.
