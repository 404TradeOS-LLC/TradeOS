---
status: current
owner: platform
last_verified: 2026-08-15
source_of_truth: false
---

# TradeOS Technical Debt Register — 2026-08-13

This register records the evidence-backed findings from the repository-wide technical-debt cleanup sprint that started from `origin/main` at `d4cdbc3c2df5425c399d5459f52aa8c51a9aaf0e`.

The register is deliberately conservative: style preferences and search false positives are not treated as debt. Repository state and live GitHub state remain authoritative after this dated snapshot.

## Disposition vocabulary

- `FIX_NOW` — bounded, evidence-backed repair that is safe for this sprint.
- `DEFER` — real debt, but a separate bounded change is safer or the required tooling/ownership update could not be completed atomically.
- `FALSE_POSITIVE` — audit signal reviewed and found intentional or non-actionable.
- `ALREADY_RESOLVED` — historical debt whose canonical fix is already on `main`.
- `REQUIRES_FOUNDER_DECISION` — evidence exists, but the change has enough behavioral or preservation risk to require an explicit disposition before destructive action.

## Findings

| ID | Area | Description | Evidence | Severity | Risk | Recommended action | Files affected | Estimated scope | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TD-001 | Knowledge Engine correctness | ~~Assembly tooling resolved `KNOWLEDGE_DIR` to the shallow `packages/knowledge-engine/knowledge/` directory instead of the canonical runtime knowledge root `packages/knowledge-engine/knowledge/knowledge/`, causing the assembly audit and five dependent scripts to silently see zero existing assemblies for every trade.~~ Fixed in PR #213 (merged 2026-08-15): `assembly_pipeline_common.py` now resolves `KNOWLEDGE_DIR` to `knowledge/knowledge/`, with regression coverage in `scripts/tests/test_assembly_pipeline_common.py` and the package README/`PATHS.md` updated in the same PR. | `packages/knowledge-engine/PATHS.md`; `packages/knowledge-engine/scripts/assembly_pipeline_common.py` | HIGH | Resolved — existing assemblies are detected again, closing the duplicate-proposal risk. | Landed; no further action required. | `packages/knowledge-engine/scripts/assembly_pipeline_common.py`, Knowledge Engine tests/docs | Small | ALREADY_RESOLVED |
| TD-002 | Repository structure | `packages/knowledge-engine/knowledge-engine/**` is a prohibited self-nested package duplicate. A fresh repository search found references only in path-contract documentation, the manifest, resolver safeguards, and tests; no runtime/build consumer references the nested path. Some nested subtrees are byte-identical to canonical trees while others have diverged. | `packages/knowledge-engine/PATHS.md`, `docs/DOC_OWNERSHIP.yml`, repository code search on 2026-08-13 | HIGH | Keeping two near-identical trees creates silent editing, search, audit, and generation ambiguity. Deleting without preserving any unique nested-only content would be destructive. | Treat the canonical top-level package as authoritative. Complete the remaining full re-hash and runtime-loader proof, preserve any unique nested-only material that still has value, then remove the prohibited nested tree in one reviewed cleanup commit. | `packages/knowledge-engine/knowledge-engine/**` | Large | REQUIRES_FOUNDER_DECISION |
| TD-003 | Generated artifacts | `packages/knowledge-engine/pipelines/exports/**` and `packages/knowledge-engine/pipelines/knowledge/cost-items/costbook.json` are documented stale outputs from an old cwd-relative pipeline run. Fresh searches again found no live in-repo consumers. | `packages/knowledge-engine/PATHS.md`; fresh repository search on 2026-08-13 | MEDIUM | Stale generated data can be mistaken for canonical export/data input. | Remove them only in the same atomic change that updates the package README/path manifest and their structural tests. The manifest write was rejected by the connected write classifier during this sprint, so destructive deletion was deliberately not performed. | `packages/knowledge-engine/pipelines/exports/**`, `packages/knowledge-engine/pipelines/knowledge/cost-items/costbook.json` | Small/medium | DEFER |
| TD-004 | Knowledge Engine path robustness | The generic task/batch runner family still builds `runtime/*.json` paths relative to process cwd. | `packages/knowledge-engine/PATHS.md` | MEDIUM | Invoking tools from an unexpected directory can read/write the wrong runtime state. | Migrate this family to the existing canonical package-root resolver in one separate behavior-characterized sprint. | Knowledge Engine task/batch runner scripts | Medium | DEFER |
| TD-005 | Knowledge Engine path contract | `approve-assembly-batch.py` and `validate_batch.py` disagree on `Data/working/costbook_pending.json`, and the referenced target does not currently exist. | `packages/knowledge-engine/PATHS.md` | MEDIUM | Approval/validation paths can diverge or fail when that workflow is exercised. | Reproduce the intended batch workflow and establish one canonical path before changing behavior. | Knowledge Engine validation/approval scripts | Medium | DEFER |
| TD-006 | Demo tooling | `app/modules/trainingless-estimate-demo/knowledgeLoader.ts` is cwd-relative and lacks the dual-marker safety used by the production Knowledge Engine loader. | `packages/knowledge-engine/PATHS.md` | LOW | Demo invocation from a different cwd can fail even though production resolution is safe. | Reuse the production resolver contract in a separate demo-tooling cleanup. | `app/modules/trainingless-estimate-demo/knowledgeLoader.ts` | Small | DEFER |
| TD-007 | Documentation governance tests | `npm run docs:test` is known to be 38/39 on current `main`; the failing invariant is `first eligible READY sprint is mechanically selected`. Open PR #193 already edits the governing backlog/handoff documents, and PR #194 explicitly avoids duplicating an active wording repair. | PR #193; PR #194; current docs-test evidence | MEDIUM | Editing the same governance truth here would create overlapping work and duplicate-PR churn. | Leave the active governance repair canonical and re-evaluate after it lands. | Governance docs/test | Small | DEFER |
| TD-008 | Backend tooling | Nine backend files contained `eslint-disable` annotations, primarily `no-console`, while `app/package.json` defines `lint` as `tsc --noEmit` and has no backend ESLint gate. This sprint removed the inert annotations from `app/scripts/run-supplier-price-sync.ts`. A subsequent Athena observability script write was rejected by the connected write classifier, so the remaining annotations were left untouched rather than repeatedly retry writes. | `app/package.json`; repository code search; cleanup branch diff | LOW | Comments imply a lint policy that is not actually enforced and add noise, but do not affect runtime correctness. | Keep the supplier-script cleanup; decide whether backend ESLint is desired before removing the remaining no-op annotations. | `app/scripts/run-supplier-price-sync.ts` fixed; remaining `app/**` occurrences deferred | Small | DEFER |
| TD-009 | Frontend lint | Three `@next/next/no-img-element` suppressions exist for signed/private project-photo URLs, settings asset previews, and captured signature data URLs. | `web/src/components/projects/project-photo-panel.tsx`; `web/src/components/settings/settings-console.tsx`; contract detail page | LOW | Mechanical replacement with `next/image` may not support these dynamic/data URL cases without behavior changes. | Keep the targeted suppressions unless the image delivery contract changes. | Three frontend files | Small | FALSE_POSITIVE |
| TD-010 | Test hygiene | No `.skip(` or `.only(` occurrences were found in current `app/` or `web/` test surfaces, and no literal `// TODO`, `// FIXME`, or `// HACK` comments were found in `app/`. The sole app `@ts-expect-error` is in an Athena compile-time contract test. | Repository code searches on 2026-08-13 | LOW | None identified. | No change. | Test/source surfaces | None | FALSE_POSITIVE |
| TD-011 | Remote branch hygiene | A fresh autonomy audit classified eight existing remote branches as safely deletable because their work is already merged/landed, four as active-PR branches, and four as requiring review for unique/untraceable work. The cleanup branch and PR #194 are additional live branches after that snapshot. | `docs/reports/AUTONOMY_BRANCH_AUDIT_2026-08-13.md` on PR #194; live branch inventory | MEDIUM | Stale refs obscure active work and increase accidental duplicate development. | Delete only revalidated `SAFE_TO_DELETE` refs; retain active PR branches and review unique heads individually. The connected GitHub surface exposes ref creation/update but no ref deletion, and the runtime checkout has no authenticated git remote, so remote deletion cannot be completed from this session. | Git refs | Small | DEFER |
| TD-012 | Duplicate PR churn | Transactional event persistence, production readiness health, CodeRabbit configuration, sensitive CODEOWNERS, and the agent-autonomy contract generated repeated near-identical PR attempts. The recent audit identifies canonical outcomes; only transactional persistence remains active as draft PR #191. | PR #194 branch audit and live PR state | MEDIUM | Duplicate efforts waste CI/review capacity and leave stale branches. | Keep canonical outcomes, do not reopen closed duplicates, and repair #191 separately. | GitHub PR state | Small | DEFER |

## Completed cleanup in this sprint

- Created this dated debt register from a live repository and PR reconciliation rather than from stale task assumptions.
- Revalidated the prohibited nested Knowledge Engine tree: indexed references are descriptive/safeguard references, not runtime/build consumers.
- Revalidated the two stale wrong-cwd Knowledge Engine output locations as having no live in-repo consumer.
- Verified there are no literal `// TODO`, `// FIXME`, or `// HACK` comments in `app/`, no `.skip(` / `.only(` test debt in the audited app/web surfaces, and no app `@ts-ignore` use.
- Kept the three frontend `no-img-element` suppressions after confirming they cover signed/private or data-URL image cases.
- Removed inert backend ESLint suppression comments from `app/scripts/run-supplier-price-sync.ts` without changing its operator logging behavior.
- Avoided overlapping edits to the governance docs already being changed by PR #193/#194 and avoided creating a replacement for canonical draft PR #191.

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

## Next cleanup boundaries

1. ~~Land TD-001 as a dedicated Knowledge Engine correction only when the required package README/path-contract edits can be written and validated atomically.~~ Done — landed in PR #213 (merged 2026-08-15).
2. Remove TD-003 stale generated artifacts in the same manifest-aware change, not as an undocumented tree deletion.
3. Delete the eight revalidated stale remote branches from an authenticated Git client or a GitHub surface that supports ref deletion.
4. Keep overlapping governance work and active PRs out of this branch.
5. Do not fold TD-004/TD-005/TD-006 into this sprint without behavior characterization.
6. Handle TD-002 only after the remaining destructive-cleanup proof gates are complete.
