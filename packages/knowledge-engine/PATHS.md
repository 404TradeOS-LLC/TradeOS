---
status: current
owner: platform
last_verified: 2026-07-16
source_of_truth: true
related_code:
  - packages/knowledge-engine/README.md
  - packages/knowledge-engine/path-manifest.json
  - packages/knowledge-engine/pipelines/package_root.py
  - app/modules/knowledge-runtime/loader.ts
  - app/modules/trainingless-estimate-demo/knowledgeLoader.ts
---

# TradeOS Knowledge Engine — Canonical Path Contract

Phase B of the `packages/knowledge-engine/` cleanup. This file is the single, authoritative
definition of what "canonical" means for every path under this package. See
[`README.md`](README.md) for narrative context and known risks;
[`path-manifest.json`](path-manifest.json) for the machine-readable version of this same
contract.

**If any script, doc, or path construction anywhere disagrees with this file about what is
canonical, this file wins.**

## Canonical roots

| Role | Canonical path | Notes |
|---|---|---|
| Package root | `packages/knowledge-engine/` | No `package.json`/manifest at this level; identified by containing the `exports/`, `knowledge/`, `schemas/` roots below. |
| Runtime knowledge root | `packages/knowledge-engine/knowledge/knowledge/` | **Doubled segment is intentional and correct** — this is the real, on-disk, loader-consumed path. `packages/knowledge-engine/knowledge/` (shallow, one level up) only contains `Data/` and this `knowledge/` subdirectory; it is not itself a data root. |
| Exports root | `packages/knowledge-engine/exports/` | Generated output. The only export root any live consumer reads. |
| Schemas root | `packages/knowledge-engine/schemas/` | Canonical JSON Schema contracts. |
| Vendor/skill root | `packages/knowledge-engine/agent-skills/skills/` | Vendored third-party content (`antigravity-awesome-skills`), not TradeOS domain knowledge. See README §4. |

## Prohibited / non-canonical paths

| Path | Status | Why |
|---|---|---|
| `packages/knowledge-engine/knowledge-engine/**` | **Prohibited — not canonical, not safe to delete yet** | Confirmed self-nested duplicate of the entire package tree. No in-repo runtime, build, or test consumer references it (Phase B reference audit, 2026-07-16). Do not resolve any path into it; do not delete it without a fresh proof pass and founder sign-off (see README §6). |
| `packages/knowledge-engine/pipelines/exports/**` | Deprecated — stale generated output | Byproduct of running `pipelines/master_pipeline.py` / `pipelines/export/sync_manager.py` with `cwd` set to `pipelines/` instead of the package root. Zero confirmed consumers anywhere in the repo. Phase B's path fix (see below) stops this from happening for *future* runs; the existing stale files are left untouched. |
| `packages/knowledge-engine/pipelines/knowledge/cost-items/costbook.json` | Deprecated — stale generated output | Same root cause and same wrong-`cwd` run as above; byte-identical to `pipelines/exports/json/costbook.json`. |

## Working-directory-independent resolution rule

Any code that needs to locate this package's canonical roots **must not** rely on the
invoking process's current working directory (`cwd`) or on a single `__file__`-relative
offset alone. Both of those break the moment a script is invoked from an unexpected
directory — including, worst case, from inside the prohibited `knowledge-engine/knowledge-engine/`
duplicate, which mirrors this package's own directory names one level down.

The canonical algorithm (implemented twice, once per language, both required to agree):

1. **TypeScript** — `app/modules/knowledge-runtime/loader.ts`'s `resolveKnowledgeEnginePaths()`.
   Builds a small, fixed set of `__dirname`-anchored and `process.cwd()`-anchored candidate
   roots, and accepts the first one that satisfies **both** `REPO_MARKERS`:
   `packages/knowledge-engine/exports/json/costbook.json` **and** `app/package.json` existing
   under the same candidate directory. The duplicate tree has no `app/` sibling, so it can
   never satisfy both markers — this is what makes `loader.ts` safe today without any Phase B
   change (confirmed by the Phase B loader/resolver audit).

2. **Python** — `packages/knowledge-engine/pipelines/package_root.py`'s
   `resolve_repo_root()` / `resolve_package_root()` / `resolve_export_root()` (added in Phase
   B). Same dual-marker safety property, implemented as a bounded upward directory walk
   (max 8 levels) anchored to the helper module's own file location rather than the caller's
   — so every consumer gets the same trustworthy starting point regardless of how it was
   invoked (imported vs. run standalone as a subprocess). Verified to converge on the true
   repo root even when the walk is started from inside the duplicate tree. Markers:
   `packages/knowledge-engine/README.md` **and** `app/package.json` — deliberately *not*
   `exports/json/costbook.json` like `loader.ts` uses, because this resolver backs
   `master_pipeline.py`, which *writes* that file; requiring it as a marker would make it
   impossible to resolve a root to regenerate it into after a deliberate clean/rebuild. Both
   markers are stable, hand-authored, committed source content, never touched by any pipeline
   write path.

Any new path-resolution code added to this package (Python or otherwise) should call into
`package_root.py` rather than reimplementing cwd- or `__file__`-relative logic.

### Canonical export root override (advanced use only)

`resolve_export_root()` honors an optional `KNOWLEDGE_ENGINE_EXPORT_ROOT` environment
variable. If unset, output always targets the canonical `packages/knowledge-engine/exports/`
regardless of `cwd`. If set to anything else, a warning is printed identifying the
noncanonical location — this exists so a deliberately noncanonical run is loud, never
silent, per the Phase B requirement that path construction defects must not be fixed by
adding a broad, hidden search.

## What Phase B fixed, and what it deliberately did not

**Fixed:** `pipelines/master_pipeline.py`, `pipelines/export/sync_manager.py`, and
`pipelines/export/publish_to_supabase.py` now anchor every `costbook.json` / `sync_final.sql`
/ `sync.sql` read and write through `package_root.py`, instead of bare `cwd`-relative string
literals. This makes their output location deterministic and cwd-independent going forward.
It does **not** touch, migrate, or delete any existing tracked output (including the stale
`pipelines/exports/**` and `pipelines/knowledge/cost-items/costbook.json` copies), and it does
not change output *content* or format — only where future runs write it.

**Deliberately not fixed in Phase B** (see README's known-risks / external-uncertainty
sections for full detail — these are documented, not silently ignored):

- `assembly_pipeline_common.py`'s `KNOWLEDGE_DIR` points at the shallow `knowledge/` path
  instead of the canonical `knowledge/knowledge/` — this causes `audit-assemblies.py` and its
  5 dependent scripts to silently report zero existing assemblies for every trade today.
  Not fixed here because doing so would change those scripts' observable output/business
  behavior, which Phase B's scope reserves for explicit founder review rather than an
  in-flight path-canonicalization pass.
- `approve-assembly-batch.py` and `validate_batch.py` disagree with each other on the
  location of `Data/working/costbook_pending.json`, and neither currently exists. Not fixed
  for the same reason.
- The task-queue/batch-runner family (`run-next-task.py`, `complete-task.py`, `fail-task.py`,
  `approve-batch.py`, `next-batch.py`, `reject-batch.py`, `start-trade-run.py`,
  `scripts/orchestrator/knowledge-orchestrator.py`) still use bare `cwd`-relative
  `runtime/*.json` paths. None of them write to `exports/**` or cause the specific
  duplicate-output defect this phase was scoped to fix, so hardening all eight was judged
  out of scope for a narrow path-canonicalization pass — flagged as a candidate for a future
  phase.
- `app/modules/trainingless-estimate-demo/knowledgeLoader.ts` is `cwd`-relative and
  unguarded (no dual-marker check), but the Phase B reference audit confirmed it cannot
  currently resolve into the duplicate tree (its hardcoded path segments don't match that
  shape) — it is fragile (crashes on wrong `cwd`) rather than dangerous (silently wrong).
  Recommended hardening (reuse `loader.ts`'s marker logic) is documented but not applied,
  since no proven doubled-path reference exists to justify an `app/**` change in this phase.
- `packages/knowledge-engine/knowledge-engine/**` itself is untouched, per this phase's
  explicit mandate.
