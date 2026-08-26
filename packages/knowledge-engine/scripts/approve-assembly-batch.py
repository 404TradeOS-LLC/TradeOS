#!/usr/bin/env python3
"""
approve-assembly-batch.py

Approves the active assembly run's current pending batch:
  1. Re-runs the same checks validate-assembly-batch.py runs (schema,
     required content fields, placeholder IDs, duplicates) so a batch can
     never be approved without passing the quality gate, even if the
     operator skipped the explicit validate step.
  2. Moves the batch JSON from review/pending/ to review/approved/.
  3. Appends its items to Data/working/costbook_pending.json (staging only
     -- this pipeline never writes to Data/raw/ or exports/ directly).
  4. Updates runtime/active-assembly-run.json: marks the batch approved,
     folds its names into the run's avoid-list, advances to the next
     batch number, and marks the run complete once the target is met.

Usage:
    python3 scripts/approve-assembly-batch.py
"""

import sys

from assembly_pipeline_common import (
    PROJECT_ROOT,
    APPROVED_DIR,
    batch_output_path,
    compute_quality_score,
    existing_name_and_slug_sets,
    find_batch_entry,
    is_placeholder_id,
    is_valid_uuid,
    load_json,
    missing_required_content_fields,
    normalize_name,
    now_iso,
    require_active_run,
    save_active_run,
    save_json,
    load_schema,
    validate_schema,
)

WORKING_PENDING = PROJECT_ROOT / "Data" / "working" / "costbook_pending.json"


def run_quality_gate(items: list, trade: str) -> list:
    """Mirrors validate-assembly-batch.py's checks. Returns a list of
    {index, name, errors} for any item that fails."""
    schema = load_schema()
    existing_names, existing_slugs = existing_name_and_slug_sets(trade) if trade else (set(), set())
    batch_names, batch_slugs = set(), set()
    failures = []

    for idx, item in enumerate(items, start=1):
        errors = []
        schema_errors = validate_schema(item, schema)
        errors.extend(f"schema: {e}" for e in schema_errors)
        for field in missing_required_content_fields(item):
            errors.append(f"missing required field: {field}")

        item_id = item.get("id")
        if is_placeholder_id(item_id):
            errors.append(f"placeholder or missing id: {item_id!r}")
        elif not is_valid_uuid(item_id):
            errors.append(f"id is not a valid UUID: {item_id!r}")

        for li in item.get("lineItems", []) or []:
            cid = li.get("costBookItemId")
            if is_placeholder_id(cid):
                errors.append(f"placeholder lineItem costBookItemId: {cid!r}")
            elif not is_valid_uuid(cid):
                errors.append(f"lineItem costBookItemId is not a valid UUID: {cid!r}")

        name_key = normalize_name(item.get("name", ""))
        slug_key = normalize_name(item.get("slug", ""))
        if not name_key:
            errors.append("missing name")
        elif name_key in existing_names or name_key in batch_names:
            errors.append(f"duplicate name: {item.get('name')!r}")
        if slug_key and (slug_key in existing_slugs or slug_key in batch_slugs):
            errors.append(f"duplicate slug: {item.get('slug')!r}")
        if name_key:
            batch_names.add(name_key)
        if slug_key:
            batch_slugs.add(slug_key)

        if errors:
            failures.append({"index": idx, "name": item.get("name"), "errors": errors})

    return failures


def main() -> None:
    active = require_active_run()
    trade = active["trade"]
    batch_number = active["currentBatch"]
    batch_path = batch_output_path(batch_number)
    entry = find_batch_entry(active, batch_number)

    if entry is None or entry.get("status") != "in_progress":
        print(
            f"[ERROR] Batch {batch_number} is not awaiting review "
            f"(status: {entry.get('status') if entry else 'not started'}). "
            "Run next-assembly-batch.py first.",
            file=sys.stderr,
        )
        sys.exit(1)

    if not batch_path.is_file():
        print(f"[ERROR] Batch file not found: {batch_path.relative_to(PROJECT_ROOT)}", file=sys.stderr)
        sys.exit(1)

    batch_data = load_json(batch_path, {})
    items = batch_data.get("items", []) if isinstance(batch_data, dict) else []
    if not items:
        print(f"[ERROR] Staged batch in {batch_path.relative_to(PROJECT_ROOT)} contains 0 items.", file=sys.stderr)
        sys.exit(1)

    failures = run_quality_gate(items, trade)
    if failures:
        print(f"[ERROR] Refusing to approve: {len(failures)} of {len(items)} assemblies failed the quality gate.", file=sys.stderr)
        for f in failures:
            print(f"  Item {f['index']} ({f['name']!r}):", file=sys.stderr)
            for e in f["errors"]:
                print(f"    - {e}", file=sys.stderr)
        print("\nRun `python3 scripts/validate-assembly-batch.py` for the full report, "
              "fix the staged file, or reject the batch.", file=sys.stderr)
        sys.exit(1)

    APPROVED_DIR.mkdir(parents=True, exist_ok=True)
    approved_path = APPROVED_DIR / batch_path.name
    batch_path.rename(approved_path)
    print(f"Batch moved to approved: {approved_path.relative_to(PROJECT_ROOT)}")

    existing_pending = load_json(WORKING_PENDING, {"items": []})
    if not isinstance(existing_pending, dict) or not isinstance(existing_pending.get("items"), list):
        existing_pending = {"items": []}
    existing_pending["items"].extend(items)
    save_json(WORKING_PENDING, existing_pending)
    print(f"Appended {len(items)} items to {WORKING_PENDING.relative_to(PROJECT_ROOT)}")

    entry["status"] = "approved"
    entry["approvedAt"] = now_iso()

    generated = set(active.get("generatedNames", []))
    for item in items:
        if item.get("name"):
            generated.add(item["name"])
    active["generatedNames"] = sorted(generated)
    active["completedCount"] = active.get("completedCount", 0) + len(items)

    if active["completedCount"] >= active.get("target", 0):
        active["status"] = "completed"
        print(f"\nAssembly run for '{trade}' is COMPLETE. Total generated: {active['completedCount']}.")
    else:
        active["currentBatch"] = batch_number + 1
        print(f"\nBatch {batch_number} approved. Next batch will be Batch {active['currentBatch']}.")
        print("Run: python3 scripts/next-assembly-batch.py")

    save_active_run(active)


if __name__ == "__main__":
    main()
