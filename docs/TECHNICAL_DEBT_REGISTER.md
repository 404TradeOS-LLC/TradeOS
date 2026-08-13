---
status: current
owner: platform
last_verified: 2026-08-13
source_of_truth: false
---

# TradeOS Technical Debt Register — 2026-08-13

This register records the evidence-backed findings from the repository-wide technical-debt cleanup sprint that started from `origin/main` at `d4cdbc3c2df5425c399d5459f52aa8c51a9aaf0e`.

The register is deliberately conservative: style preferences and search false positives are not treated as debt. Repository state and live GitHub state remain authoritative after this dated snapshot.

## Disposition vocabulary

- `FIX_NOW` — bounded, evidence-backed repair that is safe for this sprint.
- `DEFER` — real debt, but a separate bounded change is safer.
- `FALSE_POSITIVE` — audit signal reviewed and found intentional or non-actionable.
- `ALREADY_RESOLVED` — historical debt whose canonical fix is already on `main`.
- `REQUIRES_FOUNDER_DECISION` — evidence exists, but the change has enough behavioral or preservation risk to require an explicit disposition before destructive action.

## Findings

| ID | Area | Description | Evidence | Severity | Risk | Recommended action | Files affected | Estimated scope | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TD-001 | Knowledge Engine correctness | Assembly tooling resolves `KNOWLEDGE_DIR` to the shallow `packages/knowledge-engine/knowledge/` directory instead of the canonical runtime knowledge root `packages/knowledge-engine/knowledge/knowledge/`. The canonical path contract states that this causes the assembly audit and five dependent scripts to silently see zero existing assemblies for every trade. | `packages/knowledge-engine/PATHS.md`; `packages/knowledge-engine/scripts/assembly_pipeline_common.py` | HIGH | Duplicate assemblies can be proposed because existing records are not detected. | Point the shared assembly helper at the canonical knowledge root and add regression coverage for canonical assembly discovery. | `packages/knowledge-engine/scripts/assembly_pipeline_common.py`, Knowledge Engine tests/docs | Small | FIX_NOW |
| TD-002 | Repository structure | `packages/knowledge-engine/knowledge-engine/**` is a prohibited self-nested package duplicate. A fresh repository search found references only in path-contract documentation, the manifest, resolver safeguards, and tests; no runtime/build consumer references the nested path. Some nested subtrees are byte-identical to canonical trees while others have diverged. | `packages/knowledge-engine/PATHS.md`, `docs/DOC_OWNERSHIP.yml`, repository code search on 2026-08-13 | HIGH | Keeping two near-identical trees creates silent editing, search, audit, and generation ambiguity. Deleting without preserving any unique nested-only content would be destructive. | Treat the canonical top-level package as authoritative. Preserve any unique nested-only material that still has value, then remove the prohibited nested tree in one reviewed cleanup commit. | `packages/knowledge-engine/knowledge-engine/**` | Large | REQUIRES_FOUNDER_DECISION |
| TD-003 | Generated artifacts | `packages/knowledge-engine/pipelines/exports/**` and `packages/knowledge-engine/pipelines/knowledge/cost-items/costbook.json` are documented stale outputs from an old cwd-relative pipeline run. The path contract records zero confirmed consumers and states that Phase B already prevents new writes to those locations. | `packages/knowledge-engine/PATHS.md` | MEDIUM | Stale generated data can be mistaken for canonical export/data input. | Reconfirm zero consumers, then remove the stale tracked copies. | `packages/knowledge-engine/pipelines/exports/**`, `packages/knowledge-engine/pipelines/knowledge/cost-items/costbook.json` | Small/medium | FIX_NOW |
| TD-004 | Knowledge Engine path robustness | The generic task/batch runner family still builds `runtime/*.json` paths relative to process cwd. | `packages/knowledge-engine/PATHS.md` | MEDIUM | Invoking tools from an unexpected directory can read/write the wrong runtime state. | Migrate this family to the existing canonical package-root resolver in one separate behavior-characterized sprint. | Knowledge Engine task/batch runner scripts | Medium | DEFER |
| TD-005 | Knowledge Engine path contract | `approve-assembly-batch.py` and `validate_batch.py` disagree on `Data/working/costbook_pending.json`, and the referenced target does not currently exist. | `packages/knowledge-engine/PATHS.md` | MEDIUM | Approval/validation paths can diverge or fail when that workflow is exercised. | Reproduce the intended batch workflow and establish one canonical path before changing behavior. | Knowledge Engine validation/approval scripts | Medium | DEFER |
| TD-006 | Demo tooling | `app/modules/trainingless-estimate-demo/knowledgeLoader.ts` is cwd-relative and lacks the dual-marker safety used by the production Knowledge Engine loader. | `packages/knowledge-engine/PATHS.md` | LOW | Demo invocation from a different cwd can fail even though production resolution is safe. | Reuse the production resolver contract in a separate demo-tooling cleanup. | `app/modules/trainingless-estimate-demo/knowledgeLoader.ts` | Small | DEFER |
| TD-007 | Documentation governance tests | `npm run docs:test` is known to be 38/39 on current `main`; the failing invariant is `first eligible READY sprint is mechanically selected`. Open PR #193 already edits the governing backlog/handoff documents, and PR #194 explicitly avoids duplicating an active wording repair. | PR #193; PR #194; current `docs/SPRINT_BACKLOG.md` test evidence | MEDIUM | Editing the same governance truth here would create overlapping work and duplicate-PR churn. | Leave the active governance repair canonical and re-evaluate after it lands. | Governance docs/test | Small | DEFER |
| TD-008 | Backend tooling | Nine backend files contain `eslint-disable` annotations, primarily `no-console`, while `app/package.json` defines `lint` as `tsc --noEmit` and has no backend ESLint gate. | `app/package.json`; repository code search | LOW | Comments imply a lint policy that is not actually enforced and add noise, but do not affect runtime correctness. | Decide whether backend ESLint is desired; otherwise remove no-op annotations in a dedicated low-risk cleanup. | Nine `app/**` files | Small | DEFER |
| TD-009 | Frontend lint | Three `@next/next/no-img-element` suppressions exist for signed/private project-photo URLs, settings asset previews, and captured signature data URLs. | `web/src/components/projects/project-photo-panel.tsx`; `web/src/components/settings/settings-console.tsx`; contract detail page | LOW | Mechanical replacement with `next/image` may not support these dynamic/data URL cases without behavior changes. | Keep the targeted suppressions unless the image delivery contract changes. | Three frontend files | Small | FALSE_POSITIVE |
| TD-010 | Test hygiene | No `.skip(` or `.only(` occurrences were found in current `app/` or `web/` test surfaces, and no literal `// TODO`, `// FIXME`, or `// HACK` comments were found in `app/`. The sole app `@ts-expect-error` is in an Athena compile-time contract test. | Repository code searches on 2026-08-13 | LOW | None identified. | No change. | Test/source surfaces | None | FALSE_POSITIVE |
| TD-011 | Remote branch hygiene | A fresh autonomy audit classified eight existing remote branches as safely deletable because their work is already merged/landed, four as active-PR branches, and four as requiring review for unique/untraceable work. This cleanup branch and PR #194 are additional live branches after that snapshot. | `docs/reports/AUTONOMY_BRANCH_AUDIT_2026-08-13.md` on PR #194; live branch inventory | MEDIUM | Stale refs obscure active work and increase accidental duplicate development. | Delete only revalidated `SAFE_TO_DELETE` refs; retain active PR branches and review unique heads individually. | Git refs | Small | FIX_NOW where tooling permits |
| TD-012 | Duplicate PR churn | Transactional event persistence, production readiness health, CodeRabbit configuration, sensitive CODEOWNERS, and the agent-autonomy contract generated repeated near-identical PR attempts. The recent audit identifies canonical outcomes; only transactional persistence remains active as draft PR #191. | PR #194 branch audit and live PR state | MEDIUM | Duplicate efforts waste CI/review capacity and leave stale branches. | Keep canonical outcomes, do not reopen closed duplicates, and repair #191 separately. | GitHub PR state | Small | ALREADY_RESOLVED / DEFER for #191 |

## Current branch-hygiene evidence

The most recent dedicated audit classified these existing remote refs as `SAFE_TO_DELETE` after verifying their work was already landed:

- `chore/github-actions-runtime-upgrade`
- `chore/production-migration-reconciliation-workflow`
- `chore/web-frontend-deployment-foundation`
- `feature/dispatcher-workspace-foundation`
- `feature/owner-dashboard`
- `fix/auth-context-production-schema-compat`
- `fix/brand-studio-asset-upload-persistence`
- `tmp/a7-original-base`

It classified these as `REQUIRES_REVIEW` because they contain unique or insufficiently traced work:

- `docs/engineering-sprint-system`
- `docs/s027-costbook-reconciliation`
- `docs/tradeos-design-system`
- `repair/athena-a7-memory`

Active PR branches must be retained. Revalidate live GitHub state immediately before any branch deletion; this dated register is not authorization to delete a ref whose state has since changed.

## Cleanup ordering

1. Correct TD-001 and prove canonical assembly discovery.
2. Reconfirm and remove TD-003 stale generated artifacts if the zero-consumer result holds.
3. Perform the safe branch deletions in TD-011 where the available GitHub/git tooling supports ref deletion.
4. Keep overlapping governance work and active PRs out of this branch.
5. Do not fold TD-004/TD-005/TD-006 into this sprint unless required by a demonstrated regression.
6. Handle TD-002 only after the fresh proof pass is complete and the destructive tree removal can be performed atomically and reviewed.
