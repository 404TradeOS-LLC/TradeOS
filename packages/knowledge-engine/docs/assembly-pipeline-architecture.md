# Assembly Generation Pipeline Architecture

This document describes the assembly-specific generation pipeline: the
scripts in `scripts/` that audit existing assemblies, hand Gemini a tightly
scoped generation task, and gate everything Gemini produces behind schema
and quality-standard checks before a human approves it.

It intentionally does **not** cover cost-item generation, the generic
multi-type batch runner (`start-trade-run.py` / `next-batch.py` /
`approve-batch.py` / `reject-batch.py`), or the general task queue
(`run-next-task.py` / `complete-task.py` / `fail-task.py`). Those systems
also touch cost items and are out of scope for this pipeline — see
[Relationship to the generic batch runner](#relationship-to-the-generic-batch-runner)
below for why they were deliberately left alone.

---

## 1. Before this repair

The six assembly-specific scripts existed but did not actually work together
as a pipeline:

```
audit-assemblies.py --trade X
        |
        v
  runtime/assembly-audit-X.json   (per-trade, e.g. "missing_high_value_categories")
        |
        X  <-- next-assembly-batch.py instead read runtime/assembly-audit-all.json,
        |      a {"trades": [...]} shape audit-assemblies.py never produced.
        |      This file did not exist; the pipeline could not actually run
        |      start to finish.
        v
next-assembly-batch.py            (hardcoded to always write batch1.json;
        |                          silently wrote an EMPTY batch if nothing
        |                          was found, no batch numbering, no run state)
        v
review/pending/batch1.json
        |
        v
validate-assembly-batch.py        (checked for cost-item fields --
        |                          unit/laborCost/materialCost/equipmentCost --
        |                          not assembly fields; SCHEMA_PATH pointed at
        |                          Data/raw/items.json, unused)
        |
        v
approve-assembly-batch.py /       (located the pending batch by grepping
reject-assembly-batch.py           runtime/current-task.md for a backtick-quoted
                                    line that next-assembly-batch.py's actual
                                    output never contained)
```

Additionally, `start-assembly-run.py` took no arguments at all and did
nothing but shell out to `next-assembly-batch.py` — despite
`docs/assembly-runner-guide.md` already documenting a
`--trade/--target/--batch-size` interface for it.

## 2. Current workflow

```
                    ┌─────────────────────────────┐
                    │ audit-assemblies.py --trade X│
                    └───────────────┬─────────────┘
                                     v
                 runtime/assembly-audit-X.json
                 docs/assembly-coverage-X.md
                 (existing assemblies, duplicate risks, missing
                  high-value categories, per-item quality scores)
                                     |
                                     v
         ┌───────────────────────────────────────────────┐
         │ start-assembly-run.py --trade X                │
         │   --target N --batch-size 10                   │
         └───────────────────────┬───────────────────────┘
                                  v
                 runtime/active-assembly-run.json
                 (trade, target, batchSize, currentBatch,
                  completedCount, generatedNames avoid-list,
                  per-batch status history)
                                  |
                                  v
         ┌───────────────────────────────────────────────┐
         │ next-assembly-batch.py [--allow-empty]          │
         │  - refuses to start a batch with nothing to     │
         │    generate unless --allow-empty                │
         │  - refuses to clobber an in-progress batch       │
         └───────────────────────┬───────────────────────┘
                                  v
                 runtime/current-task.md
                 (trade, batch number, assemblies to avoid,
                  categories to target, schema + quality
                  standard, output path, stop conditions)
                                  |
                                  v
                 [ Gemini reads the prompt and writes ]
                 review/pending/batchN.json
                                  |
                                  v
         ┌───────────────────────────────────────────────┐
         │ validate-assembly-batch.py [--allow-empty]      │
         │  - rejects empty batches unless --allow-empty   │
         │  - rejects batches != batch-size (default 10)   │
         │  - schema check (schemas/assembly.schema.json)  │
         │  - required content fields (description,        │
         │    inputs, assumptions, exclusions, safety,     │
         │    proposal language)                            │
         │  - placeholder / invalid UUID check              │
         │  - duplicate name/slug (within batch AND         │
         │    against existing knowledge base)              │
         │  - per-item quality score (see standard below)   │
         └───────────────────────┬───────────────────────┘
                                  |
                    pass          |          fail
                    v              v
    ┌───────────────────────┐   ┌────────────────────────────┐
    │ approve-assembly-batch │   │ reject-assembly-batch.py    │
    │  .py                   │   │  "reason text"               │
    │  - re-runs the same    │   │  - review/rejected/batchN.json│
    │    quality gate         │   │  - review/rejected/batchN.   │
    │  - review/approved/     │   │    rejection_log.txt         │
    │    batchN.json          │   │  - batch number NOT advanced │
    │  - Data/working/        │   │    (next-assembly-batch.py   │
    │    costbook_pending.json│   │    regenerates the same      │
    │  - advances currentBatch│   │    batch)                    │
    │  - marks run "completed"│   └────────────────────────────┘
    │    once target is met   │
    └───────────────────────┘
```

### How tasks are queued and processed

- **One run at a time, per trade.** `runtime/active-assembly-run.json` holds
  the single active run's state: trade, target count, batch size, the
  current batch number, how many assemblies have been approved so far, and
  a growing `generatedNames` list (every name approved so far in this run,
  folded together with the audit's existing-assembly list to build each new
  batch's "avoid" list).
- **Batch numbering is sequential and stateful**, not hardcoded. Each batch
  gets its own history entry (`status`, `outputFile`, `categories`,
  `stagedAt`, `approvedAt`/`rejectedAt`) inside `active-assembly-run.json`,
  so `next-assembly-batch.py` knows whether batch N is already in flight and
  refuses to silently overwrite it.
- **The default batch size is fixed at 10** (`DEFAULT_BATCH_SIZE` in
  `scripts/assembly_pipeline_common.py`), matching
  `docs/batch-specification.md`'s "exactly 10 records per batch" rule.
  `start-assembly-run.py --batch-size` can override it per run if a
  different cadence is ever needed.
- **Empty batches require an explicit override.** Two independent guards
  enforce this:
  1. `next-assembly-batch.py` refuses to schedule a new batch if the trade's
     audit shows no missing high-value categories, unless `--allow-empty`
     is passed.
  2. `validate-assembly-batch.py` refuses a batch file with zero items,
     unless `--allow-empty` is passed.

### Validation and review steps

`validate-assembly-batch.py` and `approve-assembly-batch.py` share the same
checks (the latter re-runs them as a defense-in-depth gate, in case an
operator approves without validating first):

1. **Count.** Exactly `batch-size` items (default 10), unless `--allow-empty`.
2. **Schema.** Every item validated against `schemas/assembly.schema.json`
   with `jsonschema`'s `Draft7Validator` (degrades to a skipped-with-warning
   check if `jsonschema` isn't installed, never a silent no-op against an
   empty schema — that was the pre-repair bug).
3. **Required content fields**, per `docs/assembly-quality-standard.md`:
   `description`, `requiredInputs`, `proposalScopeOfWork`,
   `proposalAssumptions`, `proposalExclusions`, `safetyRequirements`.
4. **No placeholder IDs.** The assembly's own `id` and every `lineItems[].
   costBookItemId` must be a real UUID, not a placeholder string (`"uuid-
   string"`, `"TBD"`, `"placeholder"`, empty, etc.).
5. **Duplicates.** No two assemblies share a name or slug within the batch,
   and none collide with an assembly already on disk for the trade (across
   every layout the knowledge base actually uses — see
   `load_existing_assemblies()` in `assembly_pipeline_common.py`).
6. **Quality score.** Each item gets the `QS` score defined in
   `docs/assembly-quality-standard.md` (schema/length/clauses/inputs/items,
   weighted to 1.0). Items scoring below 0.90 don't block approval by
   themselves (that's what checks 1-5 are for) but are called out so a human
   reviewer knows what needs a closer look before merging.

`validate-assembly-batch.py` writes a full machine-readable report to
`runtime/last-validation-report.json` on every run, satisfying
`review/review-checklist.md`'s "verify `schema_valid = true`" step.

### Human approval workflow

- **Approve**: `approve-assembly-batch.py` re-validates, then moves the
  batch from `review/pending/` to `review/approved/`, stages its items into
  `Data/working/costbook_pending.json` (staging only — this pipeline never
  writes to `Data/raw/`, `knowledge/`, or `exports/` directly; a separate,
  out-of-scope merge step is responsible for promoting staged data into the
  production knowledge base), and advances the run to the next batch.
- **Reject**: `reject-assembly-batch.py [reason]` moves the batch to
  `review/rejected/` and writes a `batchN.rejection_log.txt` sidecar with
  the trade, batch number, timestamp, and reason — closing the gap called
  out in `review/review-checklist.md` ("attach a `rejection_log.txt`
  explaining the reasons"), which neither script previously did. The batch
  number is **not** advanced, so re-running `next-assembly-batch.py`
  regenerates a prompt for the same batch.
- **Staging stays intact until approval.** Nothing under `review/pending/`
  is touched by anything other than Gemini (writing it) and
  approve/reject (moving it out). No script in this pipeline writes to
  production data.

---

## 3. Shared library

`scripts/assembly_pipeline_common.py` is new. It replaces the copy-pasted
`load_json`/`save_json`/batch-path-lookup functions that used to be
duplicated across all six scripts, and centralizes the pieces that most
needed to agree with each other across the pipeline (schema path, placeholder
detection, duplicate detection, the quality-score formula). Consolidating
these means a fix or a rule change in one place (e.g. loosening the
placeholder-ID heuristic) can't quietly desync between `validate-` and
`approve-assembly-batch.py` the way the schema-path typo previously did.

It is deliberately **not** shared with the generic batch runner or the task
queue scripts, since those also drive cost-item generation.

---

## 4. Relationship to the generic batch runner

`start-trade-run.py` / `next-batch.py` / `approve-batch.py` /
`reject-batch.py` (documented in `docs/batch-runner-guide.md`) is a second,
independent pipeline that predates this one. It is generic across cost
items *and* assemblies (`--type cost-items|assemblies`), and its approve
step merges directly into `knowledge/cost-items/costbook.json` and
`exports/json/costbook.json`.

This repair did not touch it, on purpose: this task's scope excludes cost
item generation, and that runner's cost-item and assembly code paths are
interleaved (shared `active-run.json` state, shared approve/reject logic),
so changing its assembly path without also touching its cost-item path
isn't possible without crossing that boundary. The two pipelines use
different state files (`runtime/active-run.json` vs. the new
`runtime/active-assembly-run.json`) specifically so they can't collide if
both are ever run at once.

If the two pipelines are ever meant to be unified, that merge should happen
as its own reviewed change — see [Remaining technical debt](#remaining-technical-debt).

---

## 5. Remaining technical debt

- **QS thresholds are advisory, not a hard gate.**
  `docs/assembly-quality-standard.md` specifies score-based action gates
  (`>= 0.90` auto-approve, `0.80-0.89` human review, `< 0.80` auto-reject).
  This pipeline computes and surfaces that score for every item, but
  `approve-assembly-batch.py` does not currently block approval purely on a
  low QS score — only the hard checks (schema, required fields, placeholder
  IDs, duplicates) block it. A batch with valid, non-duplicate,
  fully-populated-but-mediocre assemblies (e.g. thin descriptions) can still
  be approved with a printed warning rather than being force-rejected or
  pausing for an interactive human bypass. Wiring in a true hard `< 0.80`
  reject and a `0.80-0.89` confirmation prompt was left out to avoid adding
  interactive-approval complexity to what is otherwise a scriptable,
  non-interactive gate; worth reconsidering if low-quality batches start
  slipping through in practice.
- **Two pipelines, one problem.** The generic batch runner and this
  assembly-specific one both exist and both work now, but they don't share
  code, use different state files, and use different approved-batch
  filename conventions (`{trade}_{type}_batch_{n}.json` vs `batchN.json`).
  Someone eventually needs to decide whether the assembly-specific pipeline
  should absorb the generic one's cost-item path, or whether the generic
  runner's assembly path should simply be retired in favor of this one.
- **No automated promotion from `Data/working/costbook_pending.json` into
  the real knowledge base.** Approval stages assemblies; nothing in this
  pipeline (by design, per its allowed-paths scope) merges that staged data
  into `knowledge/assemblies/<trade>/`. `review/review-checklist.md`
  references `pipelines/master_pipeline.py` for this step, but that script
  lives outside `scripts/`, `runtime/`, `review/`, `docs/` and was not
  audited as part of this repair.
- **`knowledge/assemblies/` has three different on-disk layouts** for the
  same conceptual data: per-file objects under `knowledge/assemblies/
  <trade>/`, a flat `knowledge/assemblies/<trade>_assemblies.json` wrapped
  in `{"assemblies": [...]}` (e.g. `framing_assemblies.json`), and a legacy
  combined `knowledge/assemblies.json` list. `load_existing_assemblies()`
  now reads all three so duplicate detection doesn't silently miss data (a
  real gap found and fixed while building this), but the underlying
  inconsistency in the knowledge base itself is unchanged.
- **`docs/batch-specification.md` describes a different batch file shape**
  (`{"metadata": {...}, "data": [...]}`) than this pipeline actually uses
  (`{"items": [...]}`, matching the pre-existing approve/reject scripts).
  That spec doc covers cost items, crew recipes, and production rates too,
  so it was left alone rather than edited to match one pipeline's
  convention; the divergence is real and should be reconciled if the two
  pipelines are ever unified.
- **The existing roofing assembly on disk fails its own schema.**
  `knowledge/assemblies/roofing/roofing_10_assemblies_batch_1.json` is
  missing `version`, `created`, `updated`, and `trade` — all required by
  `schemas/assembly.schema.json`. The audit now correctly flags this
  (`quality_scores` in `runtime/assembly-audit-roofing.json` shows it
  scoring 0.60, `schema: 0.0`), but fixing existing knowledge-base data is
  outside this pipeline's allowed paths.
