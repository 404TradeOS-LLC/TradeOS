---
status: current
owner: platform
last_verified: 2026-08-13
source_of_truth: true
related_code:
  - packages/knowledge-engine/README.md
  - packages/knowledge-engine/path-manifest.json
  - packages/knowledge-engine/pipelines/package_root.py
  - app/modules/knowledge-runtime/loader.ts
  - app/modules/trainingless-estimate-demo/knowledgeLoader.ts
---

# TradeOS Knowledge Engine — Canonical Path Contract

Phase B of the `packages/knowledge-engine/` cleanup established this file as the single,
authoritative definition of what "canonical" means for every path under this package. See
[`README.md`](README.md) for narrative context and known risks and
[`path-manifest.json`](path-manifest.json) for the machine-readable companion.

**If any script, doc, or path construction anywhere disagrees with this file about what is
canonical, this file wins.**

## Canonical roots

| Role | Canonical path | Notes |
|---|---|---|
| Package root | `packages/knowledge-engine/` | No `package.json`/manifest at this level; identified by containing the `exports/`, `knowledge/`, `schemas/` roots below. |
| Runtime knowledge root | `packages/knowledge-engine/knowledge/knowledge/` | **Doubled segment is intentional and correct** — this is the real, on-disk, loader-consumed path. `packages/knowledge-engine/knowledge/` is not itself a data root. |
| Exports root | `packages/knowledge-engine/exports/` | Generated output. The only export root any live consumer reads. |
| Schemas root | `packages/knowledge-engine/schemas/` | Canonical JSON Schema contracts. |
| Vendor/skill root | `packages/knowledge-engine/agent-skills/skills/` | Vendored third-party content (`antigravity-awesome-skills`), not TradeOS domain knowledge. See README §4. |

## Prohibited / non-canonical paths

| Path | Status | Why |
|---|---|---|
| `packages/knowledge-engine/knowledge-engine/**` | **Prohibited — not canonical, not safe to delete yet** | Confirmed self-nested duplicate of the package tree. A fresh 2026-08-13 repository search found only descriptive path-contract/manifest/test references and no runtime/build consumer, but deletion still requires the remaining proof gates in README §6. |
| `packages/knowledge-engine/pipelines/exports/**` | Deprecated — stale generated output | Byproduct of running the old pipeline with `cwd` set to `pipelines/`. A fresh 2026-08-13 search still found no live consumer. Phase B prevents recurrence; removal remains separately gated because external/manual use cannot be proven from the repository alone. |
| `packages/knowledge-engine/pipelines/knowledge/cost-items/costbook.json` | Deprecated — stale generated output | Same root cause and wrong-`cwd` run as above; no executable consumer was found in the 2026-08-13 repository search. |

## Working-directory-independent resolution rule

Any code that needs to locate this package's canonical roots **must not** rely on the invoking
process's current working directory (`cwd`) or on a single `__file__`-relative offset alone.
Both break when a script is invoked from an unexpected directory, including from inside the
prohibited `knowledge-engine/knowledge-engine/` duplicate.

The canonical algorithm is implemented in two places that must agree:

1. **TypeScript** — `app/modules/knowledge-runtime/loader.ts`'s
   `resolveKnowledgeEnginePaths()`. It accepts only a candidate root satisfying both repository
   markers: `packages/knowledge-engine/exports/json/costbook.json` and `app/package.json`.
   The nested duplicate has no `app/` sibling and therefore cannot satisfy both markers.

2. **Python** — `packages/knowledge-engine/pipelines/package_root.py`'s
   `resolve_repo_root()` / `resolve_package_root()` / `resolve_export_root()`. It performs a
   bounded upward walk anchored to the helper's own file location and uses stable hand-authored
   markers (`packages/knowledge-engine/README.md` and `app/package.json`). Generated exports are
   deliberately not root markers because the pipeline must be able to regenerate them after a
   clean rebuild.

Any new package path-resolution code should reuse the existing resolver rather than introduce
another cwd-relative or hardcoded root strategy.

### Canonical export root override

`resolve_export_root()` honors optional `KNOWLEDGE_ENGINE_EXPORT_ROOT`. If unset, output targets
`packages/knowledge-engine/exports/` regardless of cwd. A noncanonical explicit override is loud
rather than silently accepted.

## Phase B path fixes

Phase B changed `pipelines/master_pipeline.py`, `pipelines/export/sync_manager.py`, and
`pipelines/export/publish_to_supabase.py` so `costbook.json`, `sync_final.sql`, and `sync.sql`
reads/writes resolve through `package_root.py`. That stopped new wrong-cwd output from being
created under `pipelines/exports/**` or `pipelines/knowledge/**`; it intentionally left the
historical generated copies in place.

## 2026-08-13 technical-debt reconciliation

The technical-debt cleanup repaired a separate correctness defect that Phase B had explicitly
documented but left for founder review:

- `scripts/assembly_pipeline_common.py` now sets `KNOWLEDGE_DIR` to the canonical
  `knowledge/knowledge/` data root instead of the shallow `knowledge/` directory.
- Because the six assembly workflow entry points share that helper, `audit-assemblies.py`,
  `start-assembly-run.py`, `next-assembly-batch.py`, `validate-assembly-batch.py`,
  `approve-assembly-batch.py`, and `reject-assembly-batch.py` now inspect the real existing
  assembly corpus instead of silently seeing zero records.
- `tests/path-manifest.test.mjs` locks the helper constant to the canonical root and verifies
  that real framing assembly data exists under that root.

The same cleanup re-ran repository searches for the nested duplicate and stale wrong-cwd exports.
Those searches strengthen the existing zero-in-repo-consumer evidence but do **not** prove that
external/manual users do not depend on offline artifacts, so destructive deletion stays separate.

## Remaining path debt

- `approve-assembly-batch.py` and `validate_batch.py` disagree on the location of
  `Data/working/costbook_pending.json`, and neither referenced location currently exists. Do not
  guess the intended contract; reproduce the workflow before changing it.
- The task-queue/batch-runner family (`run-next-task.py`, `complete-task.py`, `fail-task.py`,
  `approve-batch.py`, `next-batch.py`, `reject-batch.py`, `start-trade-run.py`, and
  `scripts/orchestrator/knowledge-orchestrator.py`) still uses cwd-relative `runtime/*.json`
  paths. Harden that family as one behavior-characterized change rather than piecemeal edits.
- `app/modules/trainingless-estimate-demo/knowledgeLoader.ts` is cwd-relative and unguarded. It
  cannot currently resolve into the duplicate tree, so it is fragile rather than silently wrong;
  reuse the production resolver contract in a separate demo-tooling cleanup.
- `packages/knowledge-engine/knowledge-engine/**` remains untouched. Do not delete it until the
  documented proof prerequisites in README §6 are satisfied.
