# TradeOS Knowledge Factory - Assembly-First Batch Runner Guide

This document details the usage of the assembly-first human-in-the-loop batch generation runner. It enforces an upfront audit step to detect duplicates and gaps, scores staged batches against the quality standard, and compiles prompts that prioritize estimator time-saving packages.

See [assembly-pipeline-architecture.md](assembly-pipeline-architecture.md) for how these scripts fit together and what they deliberately don't do.

---

## 1. Run Assembly Audit
Audit the current assemblies for a specific trade to detect duplicates and define logical gaps:
```bash
python3 scripts/audit-assemblies.py --trade <trade-name>
```

### Examples:
* **Audit Roofing**:
  ```bash
  python3 scripts/audit-assemblies.py --trade roofing
  ```
*This outputs `runtime/assembly-audit-roofing.json` and writes a detailed report to `docs/assembly-coverage-roofing.md`.*

---

## 2. Start a Trade Run
Initialize the run session based on recommendations from the audit. Requires the audit above to already exist for this trade:
```bash
python3 scripts/start-assembly-run.py --trade <trade-name> --target <target-count> --batch-size <size>
```
`--target` defaults to 100, `--batch-size` defaults to 10 if omitted.

### Examples:
* **Start a 20-assembly Roofing run, 10 per batch**:
  ```bash
  python3 scripts/start-assembly-run.py --trade roofing --target 20 --batch-size 10
  ```
*This writes `runtime/active-assembly-run.json`, containing the trade, target, batch size, current batch number, completed count, and the running "avoid" list of names already generated in this run. If a run is already active, you'll be asked to confirm before it's overwritten.*

---

## 3. Generate Next Batch Prompt
Compile the prompt card for the current batch:
```bash
python3 scripts/next-assembly-batch.py
```
This refuses to run if:
- there's no active run (start one first),
- the current batch is already staged and awaiting validate/approve/reject, or
- the audit shows no missing high-value categories for this trade (pass `--allow-empty` to generate general-purpose assemblies instead of refusing).

On success it writes the prompt to [runtime/current-task.md](file:///Users/showb/TradeOS%20Costbook%20Editor/runtime/current-task.md), naming the trade, batch number, assemblies to avoid, categories to target, the schema/quality standard to follow, the exact output path, and stop conditions.

---

## 4. Execute with Gemini/Antigravity
1. Open and copy [runtime/current-task.md](file:///Users/showb/TradeOS%20Costbook%20Editor/runtime/current-task.md).
2. Paste the prompt into the agent chat interface.
3. The agent writes its output as `{"items": [...]}` directly to `review/pending/batchN.json` (the exact path is in the prompt).

---

## 5. Validate
Before approving, check the staged batch against schema, required content fields, placeholder IDs, and duplicates:
```bash
python3 scripts/validate-assembly-batch.py
```
*Rejects a batch of the wrong size (use `--allow-empty` only to explicitly permit a zero-item batch), and prints every schema/field/duplicate/placeholder error per item. Writes a full report to `runtime/last-validation-report.json`, along with each item's quality score from `docs/assembly-quality-standard.md`. Items below the 0.90 auto-approve threshold are listed as needing a closer human look, but do not block approval by themselves — only the hard checks (schema, required fields, placeholder IDs, duplicates) do.*

---

## 6. Review & Approve
If validation passed, approve the batch:
```bash
python3 scripts/approve-assembly-batch.py
```
*This re-runs the same checks as step 5 (so a batch can never be approved without passing them, even if you skipped an explicit validate run), then moves the batch to `review/approved/`, stages its items into `Data/working/costbook_pending.json`, folds its names into the run's avoid-list, and advances to the next batch number. The run is marked `completed` once the target count is reached.*

---

## 7. Review & Reject
If the generated assemblies have typos, duplicate scopes, or low quality:
```bash
python3 scripts/reject-assembly-batch.py "Missing crucial drip-edge materials"
```
*This moves the batch to `review/rejected/`, writes a `batchN.rejection_log.txt` next to it recording the trade, batch number, timestamp, and reason, and leaves the batch number unchanged so `next-assembly-batch.py` regenerates a prompt for the same batch.*
