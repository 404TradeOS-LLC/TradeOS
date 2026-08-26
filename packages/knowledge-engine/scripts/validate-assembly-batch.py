#!/usr/bin/env python3
"""
validate-assembly-batch.py

Validates the batch JSON produced by Gemini for the active assembly run's
current batch (see next-assembly-batch.py). By default the batch must
contain exactly <batch-size> assemblies (10 unless the run was started with
a different --batch-size). Use --allow-empty to permit a zero-item batch.

Every item is checked for:
  - JSON Schema conformance (schemas/assembly.schema.json)
  - Required content fields (description, inputs, assumptions, exclusions,
    safety, proposal language) per docs/assembly-quality-standard.md
  - Non-placeholder id and lineItem costBookItemId UUIDs
  - Duplicate name/slug, both within the batch and against existing
    assemblies for the trade

Usage:
    python3 scripts/validate-assembly-batch.py [--allow-empty]
"""

import argparse
import sys

from assembly_pipeline_common import (
    PROJECT_ROOT,
    RUNTIME_DIR,
    batch_output_path,
    compute_quality_score,
    existing_name_and_slug_sets,
    is_placeholder_id,
    is_valid_uuid,
    load_active_run,
    load_json,
    load_schema,
    missing_required_content_fields,
    normalize_name,
    now_iso,
    save_json,
    validate_schema,
)

LAST_REPORT_PATH = RUNTIME_DIR / "last-validation-report.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate an assembly batch JSON file.")
    parser.add_argument(
        "--allow-empty",
        action="store_true",
        help="Permit the batch to contain zero assemblies.",
    )
    return parser.parse_args()


def resolve_batch(active) -> tuple:
    """Returns (batch_path, batch_size, trade)."""
    if active:
        return batch_output_path(active["currentBatch"]), active.get("batchSize", 10), active.get("trade")
    # No active run: fall back to the conventional default location so the
    # validator can still be exercised standalone (e.g. for testing).
    print(
        "[WARN] No active assembly run found; falling back to review/pending/batch1.json "
        "with an assumed batch size of 10.",
        file=sys.stderr,
    )
    return batch_output_path(1), 10, None


def load_batch(batch_path) -> dict:
    if not batch_path.is_file():
        print(f"[ERROR] Batch file not found: {batch_path.relative_to(PROJECT_ROOT)}", file=sys.stderr)
        sys.exit(1)
    try:
        return load_json(batch_path, {})
    except Exception as e:
        print(f"[ERROR] Invalid JSON in batch file: {e}", file=sys.stderr)
        sys.exit(1)


def validate_item(item: dict, index: int, schema, batch_names: set, batch_slugs: set,
                   existing_names: set, existing_slugs: set) -> list:
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
    elif name_key in existing_names:
        errors.append(f"duplicate name (already exists in knowledge base): {item.get('name')!r}")
    if slug_key and slug_key in existing_slugs:
        errors.append(f"duplicate slug (already exists in knowledge base): {item.get('slug')!r}")

    if name_key and name_key in batch_names:
        errors.append(f"duplicate name within this batch: {item.get('name')!r}")
    if slug_key and slug_key in batch_slugs:
        errors.append(f"duplicate slug within this batch: {item.get('slug')!r}")

    return errors, schema_errors


def main() -> None:
    args = parse_args()
    active = load_active_run()
    batch_path, batch_size, trade = resolve_batch(active)
    batch = load_batch(batch_path)

    if not isinstance(batch, dict) or not isinstance(batch.get("items"), list):
        print(f"[ERROR] Batch file must be a JSON object with an 'items' array: {batch_path}", file=sys.stderr)
        sys.exit(1)

    items = batch["items"]
    count = len(items)

    if count == 0:
        if args.allow_empty:
            print("Validation successful: empty batch allowed.")
            sys.exit(0)
        print(f"[ERROR] Batch must contain assemblies (found 0). Pass --allow-empty to permit this.", file=sys.stderr)
        sys.exit(1)

    if count != batch_size and not args.allow_empty:
        print(
            f"[ERROR] Batch must contain exactly {batch_size} assemblies (found {count}).",
            file=sys.stderr,
        )
        sys.exit(1)

    schema = load_schema()
    existing_names, existing_slugs = (set(), set())
    if trade:
        existing_names, existing_slugs = existing_name_and_slug_sets(trade)

    batch_names, batch_slugs = set(), set()
    all_errors = []
    scores = []
    for idx, item in enumerate(items, start=1):
        errors, schema_errors = validate_item(
            item, idx, schema, batch_names, batch_slugs, existing_names, existing_slugs
        )
        name_key = normalize_name(item.get("name", ""))
        slug_key = normalize_name(item.get("slug", ""))
        if name_key:
            batch_names.add(name_key)
        if slug_key:
            batch_slugs.add(slug_key)

        qs = compute_quality_score(item, schema_errors)
        scores.append({"index": idx, "name": item.get("name"), **qs})

        if errors:
            all_errors.append({"index": idx, "name": item.get("name"), "errors": errors})

    report = {
        "batchPath": str(batch_path.relative_to(PROJECT_ROOT)),
        "trade": trade,
        "checkedAt": now_iso(),
        "count": count,
        "errors": all_errors,
        "qualityScores": scores,
    }
    save_json(LAST_REPORT_PATH, report)

    if all_errors:
        print(f"[REJECTED] {count} assemblies checked, {len(all_errors)} failed validation:", file=sys.stderr)
        for err in all_errors:
            print(f"  Item {err['index']} ({err['name']!r}):", file=sys.stderr)
            for e in err["errors"]:
                print(f"    - {e}", file=sys.stderr)
        print(f"\nFull report written to {LAST_REPORT_PATH.relative_to(PROJECT_ROOT)}", file=sys.stderr)
        sys.exit(1)

    avg_score = sum(s["score"] for s in scores) / len(scores)
    below_auto_approve = [s for s in scores if s["gate"] != "auto-approve"]
    print(f"Validation successful: {count} assemblies in batch.")
    print(f"Average quality score: {avg_score:.2f}")
    if below_auto_approve:
        print(
            f"{len(below_auto_approve)} assembly(ies) scored below the 0.90 auto-approve threshold "
            "and need human review before approving:"
        )
        for s in below_auto_approve:
            print(f"  - {s['name']!r}: {s['score']:.2f} ({s['gate']})")
    print(f"Report written to {LAST_REPORT_PATH.relative_to(PROJECT_ROOT)}")


if __name__ == "__main__":
    main()
