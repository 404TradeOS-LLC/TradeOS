---
status: current
owner: platform
last_verified: 2026-08-05
source_of_truth: true
related_code:
  - app/modules/knowledge-runtime/README.md
  - app/modules/knowledge-runtime/loader.ts
  - app/modules/trainingless-estimate-demo/knowledgeLoader.ts
  - docs/bible/VOLUME_3_ENGINEERING.md
  - docs/bible/VOLUME_7_KNOWLEDGE_RUNTIME.md
  - docs/ARCHITECTURE.md
  - docs/DOC_OWNERSHIP.yml
  - packages/knowledge-engine/PATHS.md
  - packages/knowledge-engine/path-manifest.json
  - packages/knowledge-engine/pipelines/package_root.py
---

# TradeOS Knowledge Engine — Package Root

This is the canonical entry point for `packages/knowledge-engine/**`. It exists because a
2026-07-16 read-only audit found this package (9,986 files at the time of the audit) had no
root README, no entry in `docs/DOC_OWNERSHIP.yml`, and several internal documents that describe
paths, tooling, or an AI-authority model that no longer match reality or current TradeOS
doctrine. Phase A (documentation and governance only) added this file, corrected internal
path documentation, and added ownership rules. Phase B (path-canonicalization and
reference-hardening) added [`PATHS.md`](PATHS.md) as the detailed canonical path contract, a
machine-readable [`path-manifest.json`](path-manifest.json), a marker-validated Python path
resolver at `pipelines/package_root.py`, and fixed the specific relative-path defect that was
producing divergent `costbook.json`/`sync_final.sql` copies under `pipelines/exports/**` —
see §8 and [`PATHS.md`](PATHS.md) for exactly what changed. **Neither phase has moved, deleted,
deduplicated, or regenerated anything under this package; the nested duplicate tree in §6 is
still fully untouched.**

If any other document under `packages/knowledge-engine/**` disagrees with this file about what is
canonical, current, or safe to delete, **this file wins** until it is explicitly updated.

## 1. What this package actually is

`packages/knowledge-engine/` is a construction-costing knowledge corpus: cost items, assemblies,
trade taxonomy, validation rules, and a Python generation/review pipeline that produces the JSON
the live TradeOS API reads. It is unrelated to `docs/bible/VOLUME_7_KNOWLEDGE_RUNTIME.md`, which
governs TradeOS's own doctrine/execution documentation graph — the two share the phrase
"knowledge runtime" but describe different systems. See
[`app/modules/knowledge-runtime/README.md`](../../app/modules/knowledge-runtime/README.md) for
the actual production consumer of the data described below.

## 2. Canonical shallow package tree

The package root contains exactly these top-level directories. There is **no** `package.json`,
`manifest.*`, or registry file at the package root today.

```
packages/knowledge-engine/
├── agent-skills/     # agents/ = first-party catalog (doc-only); skills/ = vendored, see §4
├── docs/             # package-level architecture/roadmap/ops docs — mixed current + aspirational
├── exports/          # generated production data feed — see §3
├── knowledge/        # knowledge/knowledge/** — the real domain data, see the path note below
├── legacy-archive/   # archive/ = genuine superseded prototypes; scratch/ = tooling debris, see §5
├── pipelines/        # Python generation/export pipeline (source) + generated pipeline output
├── prompts/          # LLM agent instruction cards for the generation pipeline
├── review/           # human-review staging queue (pending/rejected batches)
├── runtime/          # generation-pipeline orchestrator state (queue/progress JSON) — see §6
├── schemas/          # canonical JSON Schema contracts
└── scripts/          # CLI orchestration for the batch generation/review pipeline
```

**Path note — read this before "fixing" a missing file:** the real, on-disk, loader-consumed
knowledge directory is `knowledge/knowledge/`, not `knowledge/`. For example, the actual trade
taxonomy file is at `knowledge/knowledge/trade-taxonomy/taxonomy.md`, not
`knowledge/trade-taxonomy/taxonomy.md`. This is intentional in the live tree and matches
`app/modules/knowledge-runtime/loader.ts`. Several internal docs (`docs/knowledge-engine-architecture.md`,
`docs/migration-plan.md`, `runtime/README.md`) previously showed the shallow, one-level path —
those references have been corrected in this pass to point at the real `knowledge/knowledge/`
path. **Do not "flatten" `knowledge/knowledge/` to match the old shallow examples** — that would
break the live loader. If you are unsure whether a given doubled path is real or a typo, check it
against `app/modules/knowledge-runtime/loader.ts` and `app/modules/knowledge-runtime/README.md`
before changing anything.

## 3. Runtime-critical assets (do not move without runtime-reference proof)

`app/modules/knowledge-runtime/loader.ts` reads these files by content — changing or moving them
without updating the loader will degrade or break the live `/api/v1/knowledge/*` API (used by the
dashboard and AI Estimate Assist):

- `exports/json/costbook.json` — **required**; the loader throws if this is missing.
- `knowledge/knowledge/assembly-index.json` — optional, degrades gracefully if missing.
- `knowledge/knowledge/trade-progress.json` — optional, degrades gracefully if missing.
- `knowledge/knowledge/trade-taxonomy/taxonomy.md` — optional, degrades gracefully if missing.

These are read for filenames/counts only (content is not parsed), so they are lower-risk to
reorganize, but should still not be moved casually:

- `knowledge/knowledge/assemblies/*.json`
- `knowledge/knowledge/cost-items/*.json`
- `schemas/*.json`

A separate, standalone consumer — `app/modules/trainingless-estimate-demo/knowledgeLoader.ts`
(used by `npm run demo:trainingless-estimate` in `app/`) — also reads `exports/json/costbook.json`
and `knowledge/knowledge/assembly-index.json` directly, via its own relative-path resolution.

No CI workflow, build config, or module alias references this package — all of the above is
resolved purely at runtime via `fs`, gated by a dual-marker repo-root check in `loader.ts`
(`packages/knowledge-engine/exports/json/costbook.json` **and** `app/package.json` must both
exist under the same candidate root).

## 4. Vendored / community content

`agent-skills/skills/` (roughly 1,400 of this package's directories) is **not TradeOS-authored
knowledge content**. It is the output of running `npx antigravity-awesome-skills` — a third-party
AI-agent skills marketplace installer — evidenced directly by the committed npm logs at
`legacy-archive/scratch/.npm_cache/_logs/*.log` and by
`agent-skills/skills/.antigravity-install-manifest.json`. Only a small number of directories in
this tree (e.g. `validating-costbook-items`, `building-assemblies`, `checking-pricing-sanity`)
read as genuinely TradeOS-authored; the rest are generic, domain-unrelated community skills
(legal, security, marketing, other frameworks, etc.) that happened to get swept into this
package's single origin commit. License coverage for this vendored content is incomplete — most
of the ~1,400 directories carry no per-directory `LICENSE` file. **Do not treat anything under
`agent-skills/skills/` as TradeOS domain knowledge, and do not delete or redistribute any of it
without a license/provenance review.**

`agent-skills/agents/README.md` is a first-party catalog of 19 "worker agent" roles, but only a
handful currently have a corresponding prompt file in `prompts/agents/`. Treat the unlisted roles
as aspirational, not implemented.

Dependency maintenance verified on 2026-08-05: the canonical Loki sample frontend lockfile at
`agent-skills/skills/loki-mode/examples/todo-app-generated/frontend/` updates PostCSS from 8.5.6
to 8.5.25. A clean install and production build pass for that vendored sample. Its package audit
still reports seven development-tool vulnerabilities in the Babel/esbuild/Vite chain, tracked by
the separate Vite 8 maintenance lane; this update does not make the sample runtime-critical or
TradeOS-authored.

## 5. Generated outputs and offline tooling

`exports/`, `pipelines/exports/`, and `runtime/*.json` are pipeline-generated, not hand-authored.
`pipelines/`, `scripts/`, and their Python entry points may still be run manually outside this
repository's CI (no CI workflow references them, but that does not prove they are unused) —
**no offline tooling under this package should be removed in this phase.** Since Phase B,
`pipelines/master_pipeline.py`, `pipelines/export/sync_manager.py`, and
`pipelines/export/publish_to_supabase.py` resolve their read/write paths through
`pipelines/package_root.py` instead of bare `cwd`-relative strings — see [`PATHS.md`](PATHS.md)
for exactly what that changed and what it deliberately did not.

## 6. Known-nested duplicate tree — `packages/knowledge-engine/knowledge-engine/`

`packages/knowledge-engine/knowledge-engine/**` is a **confirmed self-nested duplicate of this
entire package**, verified two ways now: Phase A's `sha256sum` pass across all 11 top-level
subdirectories, and a Phase B re-verification (2026-07-16) via `git ls-files` counts and a full
recursive `diff -rq`. Current true counts: **4,746 tracked files in the duplicate vs. 4,748 in
the canonical tree** (not the earlier "4,993" figure, which was stale). Only **7 files now
differ** in content between the two trees — `docs/knowledge-engine-architecture.md`,
`docs/migration-plan.md`, `runtime/README.md`, and `review/runtime/README.md` (edited by Phase A),
plus `pipelines/master_pipeline.py`, `pipelines/export/sync_manager.py`, and
`pipelines/export/publish_to_supabase.py` (edited by Phase B) — because each phase edited the
canonical copies of those files only, and correctly did not propagate the edits into the
duplicate. Every other file remains byte-for-byte identical. It landed in the same single
squash-merge commit as the rest of this package, with a later filesystem mtime, and Phase B's
exhaustive `git grep` sweep (see [`PATHS.md`](PATHS.md)) confirms it still has **zero functional
references anywhere else in the repository** — only this README and `docs/DOC_OWNERSHIP.yml`
mention it, both descriptively.

**`packages/knowledge-engine/knowledge-engine/**` is not the canonical path. It is not the source
of truth for anything. It is not documented as authoritative anywhere. It is not currently safe
to delete** — it has not been reviewed file-by-file, and the live TypeScript loader's dual-marker
check happens to prevent it from being resolved at runtime, but ad hoc Python script invocations
from inside that nested tree would not be protected the same way. Any future migration or
deletion of this tree requires an explicit, evidence-backed proof pass (full re-hash, a fresh
repo-wide reference grep, and a green `knowledge-runtime.loader.test.ts` run) followed by founder
sign-off — see the audit's Phase B/C/D migration plan. This Phase A pass documents the duplicate;
it does not touch it.

## 7. Historical or superseded guidance

The following documents describe designs that are **not** the current implementation and must not
be used as implementation guidance. Each now carries its own historical notice; this is the
canonical summary:

- `runtime/README.md` — describes "10 real-time execution engines" that do not exist as
  subdirectories here. The equivalent, currently-shipped concepts live in
  `app/modules/knowledge-runtime/{loader,repository,matcher}.ts`.
- `review/runtime/README.md` — describes a reviewer workflow that can "lock, sign, and generate
  PDF" for an estimate autonomously. The actual shipped `app/modules/knowledge-runtime/README.md`
  is explicit that the runtime is file-based, read-only, does not write to Prisma/Supabase, and
  does not call external AI APIs. This conflicts with
  [`docs/bible/VOLUME_3_ENGINEERING.md`](../../docs/bible/VOLUME_3_ENGINEERING.md)'s prohibition
  on autonomous AI database writes and generated text treated as authority, and with
  [`docs/bible/VOLUME_7_KNOWLEDGE_RUNTIME.md`](../../docs/bible/VOLUME_7_KNOWLEDGE_RUNTIME.md)'s
  contradiction-protocol requirement to surface exactly this kind of conflict rather than let it
  sit unreconciled.
- `docs/migration-plan.md` — the original Swift-app-to-knowledge-package migration plan. Useful
  as history; its path examples (shallow `knowledge/`, root-level `archive/`) do not match the
  current tree (doubled `knowledge/knowledge/`, `legacy-archive/archive/`).

## 8. Known risks (read before touching anything under this package)

- **Exact nested duplicate tree**: `knowledge-engine/knowledge-engine/**`, 4,746 tracked files
  (see §6 for the corrected count), zero functional references anywhere. Still fully untouched
  by Phase B. Do not delete yet.
- **Divergent `costbook.json` / `sync_final.sql` copies — path defect fixed in Phase B, historical
  files left untouched**: `exports/json/costbook.json` (canonical, 1,795 items / 289 assemblies)
  still differs from `pipelines/exports/json/costbook.json` (1,795 items / 39 assemblies, a stale
  earlier pipeline run) and a third copy at `pipelines/knowledge/cost-items/costbook.json`
  (byte-identical to the `pipelines/exports/` copy). **Root cause, corrected from Phase A's initial
  attribution**: the actual writer of the divergent `costbook.json` copies is
  `pipelines/master_pipeline.py` (lines that used to read `open("knowledge/cost-items/costbook.json", "w")`
  / `open("exports/json/costbook.json", "w")`), not `sync_manager.py` alone —
  `sync_manager.py` only ever wrote the SQL side (`sync_final.sql`). Both, plus
  `publish_to_supabase.py`, used bare `cwd`-relative path strings, so the working directory at
  invocation time determined which tree got the output. **Phase B fixed the path construction**
  in all three files (see [`PATHS.md`](PATHS.md) for the exact mechanism) so future runs always
  target the canonical `exports/**` regardless of `cwd` — but the existing stale files under
  `pipelines/exports/**` and `pipelines/knowledge/cost-items/costbook.json` were deliberately left
  untouched, since deleting or migrating them is a separate, evidence-gated decision (see below),
  not a path-construction fix.
- **Near-duplicate export trees**: `pipelines/exports/**` (~836K) is confirmed stale pipeline
  output with zero external references (Phase B re-verified this with a fresh repo-wide search);
  not archived yet pending the same proof standard as §6.
- **A separate, newly-discovered, currently-live bug — not fixed in Phase B**:
  `scripts/assembly_pipeline_common.py`'s `KNOWLEDGE_DIR` constant points at the shallow
  `knowledge/` path, which does not contain `assemblies/` or `trade-progress.json` in the current
  tree (the real data is one level deeper, at `knowledge/knowledge/`). This means
  `audit-assemblies.py` and its 5 dependent scripts (`start-assembly-run.py`,
  `next-assembly-batch.py`, `validate-assembly-batch.py`, `approve-assembly-batch.py`,
  `reject-assembly-batch.py`) currently, silently report **zero existing assemblies for every
  trade** — confirmed live, not theoretical: `runtime/assembly-audit-roofing.json` is a real,
  well-formed prior audit result that could not be reproduced by re-running the documented
  command today. Separately, `approve-assembly-batch.py` and `validate_batch.py` disagree with
  each other on where `Data/working/costbook_pending.json` lives, and neither location currently
  exists. **Phase B intentionally did not fix either of these** — doing so would change those
  scripts' observable output (from "reports zero" to "reports correctly"), which is a business-
  behavior change, not a path-construction fix, and is explicitly out of Phase B's scope pending
  founder review.
- **Unresolved offline-tooling consumers**: Phase B searched exhaustively for IDE task configs,
  Makefiles/justfiles, npm scripts, and CI workflows that might invoke
  `packages/knowledge-engine/{pipelines,scripts}/**` — found none. Every documented invocation
  example (`docs/how-to-run-automation.md`, `batch-runner-guide.md`, `assembly-runner-guide.md`,
  `migration-plan.md`, `manager-handoff.md`, `review-checklist.md`, `knowledge-dashboard.md`)
  assumes the shell's `cwd` is the package root and none reference a doubled or otherwise
  fixed-by-Phase-B path directly — Phase B's fix is safe for every *documented* invocation
  pattern. Several of those docs also contain dead `file:///Users/showb/TradeOS%20Costbook%20Editor/...`
  links pointing at a different, older project directory name, which is evidence the docs (and
  likely the `runtime/assembly-audit-roofing.json` artifact above) predate this package's
  squash-merge into the current monorepo — not evidence of current external use, but not proof of
  its absence either. Whether any human operator still runs these scripts manually, outside this
  repository's CI, **could not be confirmed or ruled out**. Treat as in-use until proven otherwise.
  If you are that operator: `approve-batch.py` and `pipelines/master_pipeline.py` must be run with
  `cwd` = `packages/knowledge-engine/` — running them from elsewhere silently wrote to the wrong
  tree before Phase B, and after Phase B, `master_pipeline.py`'s output location is now
  deterministic (always canonical) regardless of `cwd`, so if you were relying on the old
  wrong-`cwd` behavior to land output under `pipelines/`, that will stop happening.
- **Uncertain provenance in parts of the skill corpus**: most of `agent-skills/skills/` carries an
  explicit `source: community` marker, but a smaller remainder does not, while still reading as
  generic/non-TradeOS content on inspection. Full per-directory classification is not complete.
- **Deletion is prohibited until a later, evidence-backed migration phase** with founder approval.
  This document exists to make future cleanup safer, not to authorize it.

## 9. Where to look next

- [`PATHS.md`](PATHS.md) for the detailed canonical path contract and exactly what Phase B
  changed vs. deliberately left alone.
- [`path-manifest.json`](path-manifest.json) for the machine-readable version of the same
  contract (canonical roots, runtime-critical assets, deprecated roots, unresolved risks).
- Full audit findings, phased migration plan (Phase A/B/C/D), and the top-25 prioritized action
  list live in the session record that produced this file (2026-07-16 multi-agent audit).
- For anything runtime-facing, start at
  [`app/modules/knowledge-runtime/README.md`](../../app/modules/knowledge-runtime/README.md), not
  the READMEs inside this package.

## 10. A note on branch coordination

While researching this phase, a separate, local-only, unmerged git branch
(`worktree-memoized-brewing-acorn`, last touched 2026-07-14, not pushed to any remote) was found
containing commits described as relocating "tree-service authored content out of app/modules" and
fixing "path references after authored-content relocation" — i.e., independent work touching the
same duplicate/canonical-path confusion this document addresses. That branch was not merged into
`main`, does not share history with this Phase B branch, and was left completely untouched by
this phase. Flagging it here so a founder reviewing this PR can decide whether that branch's work
should be coordinated with, superseded by, or discarded relative to this one — it was not
investigated further since it falls outside this phase's scope.
