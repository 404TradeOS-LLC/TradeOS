---
status: current
owner: platform
last_verified: 2026-08-12
source_of_truth: true
related_code:
  - AGENTS.md
  - docs/TRADEOS_BIBLE.md
  - docs/CURRENT_STATE.md
  - docs/ROADMAP.md
  - docs/SPRINT_BACKLOG.md
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/SESSION_HANDOFF.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
  - .github/CODEOWNERS
  - .github/workflows/verify-repository.yml
  - .github/workflows/reconcile-production-migration.yml
---

# TradeOS Engineering Command Center

## Purpose

This is the concise operating overview for TradeOS engineering. It does not replace the Bible, Current State, Sprint Backlog, Session Handoff, module contracts, ADRs, or research evidence.

Start with:

1. [TRADEOS_BIBLE.md](TRADEOS_BIBLE.md)
2. [CURRENT_STATE.md](CURRENT_STATE.md)
3. [SPRINT_BACKLOG.md](SPRINT_BACKLOG.md)
4. [SESSION_HANDOFF.md](SESSION_HANDOFF.md)
5. [agent-prompts/NEXT_SPRINT_PROTOCOL.md](agent-prompts/NEXT_SPRINT_PROTOCOL.md)

## Project identity and boundary

- `404 TradeOS` is the parent company and operating context.
- `TradeOS` is the contractor SaaS product in this repository.
- TradeOS remains one first-party monorepo. Athena, Costbook, Estimator, Dispatcher, Field Tech, CRM, and Office Manager are execution/domain boundaries, not separate repositories.
- Athena is the reusable orchestration platform layer; domain business rules remain owned by their domains and register capabilities through explicit contracts.
- Existing `app/` and `web/` deployable boundaries remain authoritative during RC1 hardening.

## Current engineering phase

TradeOS is in `RC1 hardening`.

Verified implementation truth belongs in [CURRENT_STATE.md](CURRENT_STATE.md). Strategic sequencing belongs in [ROADMAP.md](ROADMAP.md). Executable numbered work belongs in [SPRINT_BACKLOG.md](SPRINT_BACKLOG.md).

## Hardening baseline landed 2026-08-12

- **CI gatekeeper:** PR #172 merged as `cd9a960861e611956f7ff55d9704461b6586ae47`.
- **Sensitive ownership:** PR #175 merged as `38232b19b3ca02de0856ffbf6ba1f6a798b5ca62`.
- **Autonomous agent contract:** PR #177 merged as `25ce0817b8a87a068348496fca12bd32230bfaf9`.
- **Production health:** PR #178 merged as `834fb3433604045a46dfe377df47fa08cee499d8`.
- **CodeRabbit repository policy:** PR #180 merged as `bdcc4bd1dcbf07abb38dd85a924786b6549040a3`.
- **API development toolchain:** PR #169 merged as `919beaaec3b08d92d268b3a8ac24f11842eb7a82`.
- **GitHub Actions runtime:** PR #181 merged as `1d6120ad4598b60d3c14a91366cb73b2bf42bd48`.
- **Costbook hierarchy hardening:** PR #151 merged as `5b7dbcbfaa589360fb349f4badaca394683c3da7`, adding explicit hierarchy tenant/activity integrity with live PostgreSQL coverage.

These changes improve evidence for bounded maintenance. They do not grant autonomous authority over protected migrations, auth/RLS policy, destructive data operations, secrets, billing, major architecture, or other human-decision boundaries.

## Current numbered-sprint state

- S001-S006 are complete where the backlog records merged evidence; S006 merged in PR #95 as `5e59880aba24acbe943b03d1a34aa787cb7db801`.
- S013 is complete; PR #30 merged as `2d80214a99b476e9a271c04fbe8a608eb80b3883`.
- S027 remains `BLOCKED`. Its historical #94/#95/#96 blockers are merged; PR #151 is merged; PR #128 is closed superseded. Current Costbook overlap is replacement PR #183.
- No numbered sprint is currently `READY`. The computed state remains `Sprint ID: NONE` until a governance-only readiness promotion proves one planned sprint eligible.

## Active engineering queue

Prioritize existing authorized work before inventing new scope:

1. **PR #183 — C004 reconciled equipment catalog.** Branch `feature/costbook-c004-reconciled` starts on post-#151 hardened `main`. Both Docs consistency and Verify repository are green, CodeRabbit approved it, and review threads are resolved. It contains a migration/protected boundary and has not been merged. Old PR #128 is closed as superseded and should not be revived.
2. **PR #145 / issue #144 — Athena A12.1 transactional event persistence.** Branch `fix/athena-transactional-event-outbox` now contains the production transaction boundary, unit coverage, live PostgreSQL rollback proof, and required canonical docs. Its last pre-reconciliation Verify repository run was green. The branch is two commits behind post-#151 `main` and must be conflict-safely integrated, then rerun through fresh protected CI/review before leaving draft.
3. **S027 governance/readiness review.** Do not start another hierarchy/catalog rebuild. Re-evaluate the broader Intelligent Costbook mission only after PR #183 is merged or otherwise retired.
4. **Issue #153.** Revalidate its activation-permission/migration-sequencing assumptions against merged #151 and final C004 before implementation.

## Autonomous maintenance operating mode

Scheduled maintenance and repair agents follow `AGENTS.md`, the Next Sprint Protocol, and Repository Governance together.

For a validated low-risk maintenance defect, the expected loop is:

**inspect → reproduce/validate → root-cause → repair → test → inspect diff → publish focused PR → verify exact CI/review state → merge only when permitted → verify landed state**

Agents should advance an existing overlapping PR instead of creating duplicate work. Green CI is required technical evidence, not authority to merge protected changes.

Production repair should use the health split first:

- `/health` failing → investigate process/deployment/routing/platform availability;
- `/health` succeeding and `/ready` failing → investigate database connectivity/configuration/availability;
- both succeeding while a workflow fails → investigate auth, tenancy/RLS, route/domain behavior, or frontend/backend integration.

## Required verification

Expected required CI jobs include:

- `Docs consistency`;
- `App lint, unit tests, and build`;
- `App integration tests` with disposable PostgreSQL migration rehearsal and live RLS verification;
- `Web lint and build`.

Documentation foundation/governance work should run:

```bash
npm run docs:test
npm run docs:check -- --base origin/main
git diff --check
```

The exact required-check and ruleset configuration remains live GitHub state and must be verified before changing repository controls.

## Current risks and guarded areas

- Production migration changes remain manual/approval-gated; PR CI may rehearse tracked migrations only against disposable databases.
- `packages/knowledge-engine/knowledge-engine/**` is a confirmed self-nested duplicate tree, not a second canonical package. Do not delete or normalize it through unrelated maintenance.
- Settings/Brand Studio asset persistence must keep service-role access server-only and organization-scoped.
- S027 implementation must extend existing Costbook, supplier, Knowledge Runtime, AI Estimate Assist, and Estimate Engine seams; do not create mock production data, duplicate hierarchy domains, or autonomous AI write paths.
- CODEOWNERS provides routing/visibility; live branch-rule changes require separate verification.

## Session execution

The sole executable general session contract is `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md`. Use its Canonical Startup Flow before editing and Canonical Completion Flow before handoff. The Command Center reports operating context and does not define a competing checklist.

## Next engineer starts here

There is no numbered `READY` sprint. Advance protected C004 PR #183 and conflict-reconcile Athena PR #145 before inventing new scope. S027 remains blocked until #183 overlap is resolved; after that, perform a governance-only readiness review rather than reimplementing C005/#151 work.

## Source-of-truth links

- [TRADEOS_BIBLE.md](TRADEOS_BIBLE.md)
- [CURRENT_STATE.md](CURRENT_STATE.md)
- [PRODUCT_SCOPE.md](PRODUCT_SCOPE.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DOMAIN_MODEL.md](DOMAIN_MODEL.md)
- [API_REFERENCE.md](API_REFERENCE.md)
- [RBAC_MATRIX.md](RBAC_MATRIX.md)
- [WORKFLOW_LIFECYCLES.md](WORKFLOW_LIFECYCLES.md)
- [ROADMAP.md](ROADMAP.md)
- [SPRINT_BACKLOG.md](SPRINT_BACKLOG.md)
- [REPOSITORY_GOVERNANCE.md](REPOSITORY_GOVERNANCE.md)
- [SESSION_HANDOFF.md](SESSION_HANDOFF.md)
- [DOC_OWNERSHIP.yml](DOC_OWNERSHIP.yml)
- [modules/](modules/)
- [decisions/](decisions/)
- [agent-prompts/](agent-prompts/)
