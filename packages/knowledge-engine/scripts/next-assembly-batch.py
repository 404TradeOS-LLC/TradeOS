#!/usr/bin/env python3
"""
next-assembly-batch.py

Prepares the next batch of the active assembly run:
  1. Loads runtime/active-assembly-run.json (see start-assembly-run.py).
  2. Loads the trade's audit (runtime/assembly-audit-<trade>.json).
  3. Refuses to schedule a batch with nothing to generate unless
     --allow-empty is passed (no missing high-value categories left).
  4. Writes runtime/current-task.md: an explicit instruction for Gemini to
     generate exactly <batch-size> assemblies (default 10), naming the
     trade, batch number, assemblies to avoid, categories to target, the
     schema/quality standard to follow, the output path, and stop
     conditions.
  5. Records the batch as "in_progress" in the active run state.

Usage:
    python3 scripts/next-assembly-batch.py [--allow-empty]
"""

import argparse
import sys
from urllib.request import pathname2url

from assembly_pipeline_common import (
    CURRENT_TASK_PATH,
    DOCS_DIR,
    PROJECT_ROOT,
    SCHEMA_PATH,
    batch_output_path,
    find_batch_entry,
    load_existing_assemblies,
    normalize_name,
    now_iso,
    require_active_run,
    require_audit,
    save_active_run,
)

MAX_AVOID_NAMES_LISTED = 40


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare the next assembly generation batch.")
    parser.add_argument(
        "--allow-empty",
        action="store_true",
        help="Proceed even if the audit shows no missing high-value categories for this trade.",
    )
    return parser.parse_args()


def build_avoid_list(trade: str, audit: dict, active: dict) -> list:
    names = set()
    for a in audit.get("existing_assemblies", []):
        if a.get("name"):
            names.add(a["name"])
    for a in load_existing_assemblies(trade):
        if a.get("name"):
            names.add(a["name"])
    for generated in active.get("generatedNames", []):
        names.add(generated)
    return sorted(names, key=normalize_name)


def render_prompt(trade: str, batch_number: int, batch_size: int, categories: list,
                   avoid_names: list, output_path) -> str:
    output_rel = output_path.relative_to(PROJECT_ROOT)
    schema_rel = SCHEMA_PATH.relative_to(PROJECT_ROOT)
    quality_doc_rel = (DOCS_DIR / "assembly-quality-standard.md").relative_to(PROJECT_ROOT)

    if categories:
        categories_block = "\n".join(f"- {c}" for c in categories)
    else:
        categories_block = (
            "- (none flagged as missing by the audit; generate general-purpose, "
            "high-value assemblies for this trade instead)"
        )

    if avoid_names:
        shown = avoid_names[:MAX_AVOID_NAMES_LISTED]
        avoid_block = "\n".join(f"- {n}" for n in shown)
        if len(avoid_names) > MAX_AVOID_NAMES_LISTED:
            avoid_block += f"\n- ...and {len(avoid_names) - MAX_AVOID_NAMES_LISTED} more (see the audit file for the full list)"
    else:
        avoid_block = "- (no existing assemblies on file for this trade yet)"

    return f"""# Current Assembly Generation Task

<!-- BATCH_RUN: {trade} | assemblies | Batch {batch_number} -->

## Mission
You are the TradeOS AssemblyArchitect. Generate **exactly {batch_size} assemblies**
for the trade **{trade}**. This is **Batch {batch_number}** of the active run.

## Trade
{trade}

## Batch Number
{batch_number}

## Assemblies to Avoid
Do not duplicate the name, slug, or scope of any of the following existing assemblies:
{avoid_block}

## Categories to Target
Prioritize these missing high-value sub-categories identified by the audit:
{categories_block}

## Schema and Quality Standards
- Every assembly must validate against [{schema_rel}](file://{pathname2url(str(SCHEMA_PATH))}).
- Every assembly must satisfy [{quality_doc_rel}](file://{pathname2url(str(DOCS_DIR / 'assembly-quality-standard.md'))}):
  - Non-placeholder `id` (real UUID, not "uuid-string"/"TBD"/etc.).
  - `description` longer than 100 characters; `contractorNotes` longer than 50 characters.
  - Non-empty `proposalScopeOfWork`, `proposalAssumptions`, `proposalExclusions`, and `warrantyLanguage`.
  - At least two `requiredInputs` parameters.
  - At least two `lineItems`, each with a real (non-placeholder) `costBookItemId` UUID and a `quantity`.
  - Non-empty `safetyRequirements`.
- No two assemblies in this batch may share a name or slug with each other or with the avoid list above.

## Output Path
Write the batch as a JSON object with an `items` array to:
`{output_rel}`

```json
{{
  "items": [ /* exactly {batch_size} assembly objects */ ]
}}
```

## Stop Conditions
- Stop after generating exactly **{batch_size}** assemblies. Do not generate more or fewer.
- Do not modify any file outside `{output_rel}`.
- Do not touch `review/approved/`, `review/rejected/`, or any existing knowledge/assemblies files.
- When finished, notify the operator so `python3 scripts/validate-assembly-batch.py` can be run.
"""


def main() -> None:
    args = parse_args()
    active = require_active_run()
    trade = active["trade"]
    audit = require_audit(trade)

    batch_number = active["currentBatch"]
    batch_size = active.get("batchSize") or 10
    output_path = batch_output_path(batch_number)

    existing_entry = find_batch_entry(active, batch_number)
    if existing_entry and existing_entry.get("status") == "in_progress":
        print(
            f"[ERROR] Batch {batch_number} is already in progress "
            f"(output: {output_path.relative_to(PROJECT_ROOT)}).",
            file=sys.stderr,
        )
        print(
            "Validate, approve, or reject it before requesting a new batch prompt.",
            file=sys.stderr,
        )
        sys.exit(1)

    categories = audit.get("missing_high_value_categories", [])
    if not categories and not args.allow_empty:
        print(
            f"[ERROR] No missing high-value categories identified for trade '{trade}'. "
            "Refusing to schedule an empty/unguided batch.",
            file=sys.stderr,
        )
        print("Pass --allow-empty to generate general-purpose assemblies anyway.", file=sys.stderr)
        sys.exit(1)

    avoid_names = build_avoid_list(trade, audit, active)
    prompt = render_prompt(trade, batch_number, batch_size, categories, avoid_names, output_path)

    CURRENT_TASK_PATH.parent.mkdir(parents=True, exist_ok=True)
    CURRENT_TASK_PATH.write_text(prompt, encoding="utf-8")

    batches = active.setdefault("batches", [])
    entry = {
        "batchNumber": batch_number,
        "status": "in_progress",
        "outputFile": str(output_path.relative_to(PROJECT_ROOT)),
        "categories": categories,
        "stagedAt": now_iso(),
        "approvedAt": None,
        "rejectedAt": None,
    }
    batches = [b for b in batches if b.get("batchNumber") != batch_number]
    batches.append(entry)
    active["batches"] = batches
    save_active_run(active)

    print(f"Batch {batch_number} prompt written to {CURRENT_TASK_PATH.relative_to(PROJECT_ROOT)}")
    print(f"Expected output: {output_path.relative_to(PROJECT_ROOT)}")
    print("\n==================================================")
    print("NEXT STEPS")
    print("==================================================")
    print(f"1. Copy the contents of {CURRENT_TASK_PATH.relative_to(PROJECT_ROOT)}")
    print("2. Paste it into Gemini/your agent chat interface.")
    print(f"3. Confirm it writes exactly {batch_size} assemblies to the output path above.")
    print("4. Run: python3 scripts/validate-assembly-batch.py")
    print("5. Then: python3 scripts/approve-assembly-batch.py   (or reject-assembly-batch.py)")
    print("==================================================")


if __name__ == "__main__":
    main()
