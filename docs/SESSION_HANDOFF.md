---
status: current
owner: platform
last_verified: 2026-08-13
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
  - PR #180 added repository-level CodeRabbit policy and merged as `bdcc4bd1dcbf07abb38dd85a924786b6549040a3`.
  - PR #169 modernized the backend development toolchain through TypeScript 6 and Jest 30 and merged as `919beaaec3b08d92d268b3a8ac24f11842eb7a82` after full App/Web/docs/live migration verification.
  - PR #181 replaced stale GitHub Actions bot PRs #130/#131 with one governed runtime update and merged as `1d6120ad4598b60d3c14a91366cb73b2bf42bd48`; repository workflows now use `actions/checkout@v7` and `actions/setup-node@v7` while preserving the explicit TradeOS Node workload versions.
  - PR #151 hardened Costbook hierarchy RLS and parent-activation integrity (explicit organization predicates on category/subcategory writes, triggers rejecting active children beneath inactive parents and parent deactivation while active descendants remain) and merged as `5b7dbcbfaa589360fb349f4badaca394683c3da7`; `docs/CURRENT_STATE.md` and `docs/DOMAIN_MODEL.md` describe the hardened boundary.
  - PR #192 reconciled `/ready` readiness-probe documentation (`docs/API_REFERENCE.md`, `docs/DEPLOYMENT_GUIDE.md`) and documented the auth/AI-estimate rate-limit and AI Estimator review-token env vars in `app/.env.example`, and merged as `d4cdbc3c2df5425c399d5459f52aa8c51a9aaf0e`. Docs/config only; no `app/` or `web/` runtime source changed.
- S006 — Lifecycle compatibility inventory is `DONE`. PR #95 merged on 2026-08-10 as `5e59880aba24acbe943b03d1a34aa787cb7db801`.
- S013 — Persist Settings Console brand assets is `DONE`. PR #30 merged on 2026-08-04 as `2d80214a99b476e9a271c04fbe8a608eb80b3883`.
- S027 — Intelligent Costbook production readiness remains `BLOCKED`. Its original blockers #94/#95/#96 and now #151 are merged; live overlap has shifted to open PRs #183 and #184 (see below).
- PR #151 (Costbook hierarchy RLS/active-parent hardening) is merged; it is no longer open overlap for S027.
- PR #128 (C004 equipment catalog foundation) was closed without merging on 2026-08-13, superseded by PR #183 (`feature/costbook-c004-reconciled`), which rebuilds C004 directly on the post-#151 hardened `main` and carries fresh live equipment RLS coverage.
- PR #145 (Athena transactional-event work tied to issue #144) was closed without merging on 2026-08-13 after connector-authored pushes stopped triggering repository workflows; the same branch content continues in draft PR #191 (`fix/athena-transactional-event-outbox-authoritative`), which still needs fresh required-check evidence on its current head before readiness.
- Open issue #153 tracks the Costbook `isActive` permission-boundary (now in progress as open PR #184, `fix/costbook-hierarchy-activation-permissions`) and the C004/C005 migration-sequencing reverification due once #183 lands.

## Operating rules for the next session

- `AGENTS.md` authorizes bounded autonomous maintenance through inspect → validate → root-cause → repair → test → PR → verify → merge when every required gate permits it.
- Green CI is necessary evidence, not authority to merge protected changes such as material migrations, auth/RLS policy changes, secrets, billing, destructive operations, or major architecture.
- Existing overlapping PRs should be advanced instead of duplicated.
- No `PLANNED` sprint becomes `READY` merely because its dependency completed. Readiness requires a separate governance-only promotion after live dependency, overlap, infrastructure, and founder-decision verification.
- Production repair uses `/health` for process liveness and `/ready` for database-aware readiness before classifying incidents.
- Live GitHub rulesets and required checks must be reverified before repository-control changes; documentation is not a substitute for live state.

## Highest-value existing work

1. Advance PR #183 (C004 equipment catalog, rebuilt on hardened `main`) toward required CI/review and merge; it is the live successor to closed PR #128.
2. Advance PR #184 (Costbook hierarchy activation-permission boundary, issue #153 item 1) toward required CI/review and merge.
3. Get fresh required-check evidence on draft PR #191's current head (Athena transactional-event outbox, issue #144); it is the live successor to closed PR #145 and remains draft until that evidence exists.
4. After #183/#184 land, reverify C004/C005 migration ordering per issue #153 item 2 before any further Costbook migration work.
5. After #183/#184/#191 reconciliation, re-evaluate S027 readiness through governance rather than implicitly promoting it.

## Next Eligible Sprint

Sprint ID: NONE
Eligibility: No numbered sprint is currently `READY`. S006 and S013 are complete; S027 is blocked by active Costbook overlap; all other unfinished numbered sprints are `PLANNED`, `BLOCKED`, or otherwise require explicit readiness promotion.
Dependencies: N/A until a specific planned sprint is promoted through the canonical readiness process.
Overlap check: Current material overlap is open PRs #183 (Costbook C004), #184 (Costbook hierarchy activation permissions), and draft #191 (Athena transactional-event outbox). PRs #128, #145, and #151 are resolved (closed/superseded or merged). Reverify live GitHub state before choosing implementation scope.
Startup prompt: Advance or reconcile already-authorized open work first. If no existing PR should be advanced, perform a governance-only readiness review and promote exactly one eligible `PLANNED` sprint; do not invent feature scope or treat a planned sprint as ready implicitly.
