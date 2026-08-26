#!/usr/bin/env python3
"""
validate_batch.py

Usage: python3 scripts/validate_batch.py

Scans the `review/pending/` directory for JSON files containing newly generated cost‑book items.
For each file it:
  * Loads the JSON array.
  * Validates each item against the raw input schema (`Data/raw/items.json`).
  * Ensures required fields exist and that numeric cost fields are numbers (or numeric strings) with two‑decimal precision.
  * Adds a `pricingStatus` field set to "placeholder" if not present.
  * Detects duplicate `name`/`category`/`unit` combinations across pending items and existing items.
  * Moves the file to `review/approved/` if it passes validation, otherwise to `review/rejected/`.

The script does **not** modify the production `Data/raw/items.json`; approved items are staged in
`Data/working/costbook_pending.json` for later merging.
"""
import json
import sys
from pathlib import Path
from uuid import UUID

RAW_SCHEMA_PATH = Path("Data/raw/items.json")
WORKING_PENDING = Path("Data/working/costbook_pending.json")
REVIEW_PENDING = Path("review/pending")
APPROVED_DIR = Path("review/approved")
REJECTED_DIR = Path("review/rejected")

def load_json(file_path: Path):
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

def is_uuid(val: str) -> bool:
    try:
        UUID(val)
        return True
    except Exception:
        return False

def validate_item(item: dict, existing_ids: set, existing_keys: set) -> list:
    errors = []
    # Required fields
    for field in ["id", "name", "category", "unit", "laborCost", "materialCost", "equipmentCost"]:
        if field not in item:
            errors.append(f"Missing field: {field}")
    # ID validation
    if "id" in item and not is_uuid(item["id"]):
        errors.append("Invalid UUID for id")
    if "id" in item and item["id"] in existing_ids:
        errors.append("Duplicate id with existing items")
    # Cost fields numeric and two‑decimal
    for cost_field in ["laborCost", "materialCost", "equipmentCost"]:
        if cost_field in item:
            try:
                val = float(item[cost_field])
                # enforce two‑decimal representation (allow float, but check rounding)
                if round(val, 2) != val:
                    errors.append(f"{cost_field} not rounded to 2 decimals")
            except Exception:
                errors.append(f"{cost_field} not a number")
    # Duplicate name/category/unit combo
    key = (item.get("name", "").lower(), item.get("category", "").lower(), item.get("unit", "").lower())
    if key in existing_keys:
        errors.append("Duplicate name/category/unit combo with existing items")
    return errors

def main() -> None:
    # Ensure directories exist
    for d in [REVIEW_PENDING, APPROVED_DIR, REJECTED_DIR, WORKING_PENDING.parent]:
        d.mkdir(parents=True, exist_ok=True)

    # Load existing raw items for duplicate checking
    existing_items = []
    if RAW_SCHEMA_PATH.is_file():
        try:
            existing_items = load_json(RAW_SCHEMA_PATH)
        except Exception as e:
            print(f"[WARN] Could not read raw items.json: {e}")
    existing_ids = {itm.get("id") for itm in existing_items}
    existing_keys = {(itm.get("name", "").lower(), itm.get("category", "").lower(), itm.get("unit", "").lower()) for itm in existing_items}

    # Load any already‑approved pending items (if the script is re‑run)
    approved_items = []
    if WORKING_PENDING.is_file():
        try:
            approved_items = load_json(WORKING_PENDING)
        except Exception as e:
            print(f"[WARN] Could not read working pending file: {e}")
    # Merge approved into the duplicate check sets
    for itm in approved_items:
        existing_ids.add(itm.get("id"))
        existing_keys.add((itm.get("name", "").lower(), itm.get("category", "").lower(), itm.get("unit", "").lower()))

    any_processed = False
    for json_file in REVIEW_PENDING.glob("*.json"):
        any_processed = True
        try:
            items = load_json(json_file)
        except Exception as e:
            print(f"[ERROR] Could not read {json_file}: {e}")
            json_file.rename(REJECTED_DIR / json_file.name)
            continue
        if not isinstance(items, list):
            print(f"[ERROR] File {json_file} does not contain a JSON array.")
            json_file.rename(REJECTED_DIR / json_file.name)
            continue
        batch_errors = []
        for i, item in enumerate(items):
            errs = validate_item(item, existing_ids, existing_keys)
            if errs:
                batch_errors.append({"index": i, "id": item.get("id"), "errors": errs})
        if batch_errors:
            print(f"[REJECTED] {json_file.name} – validation errors:")
            for err in batch_errors:
                print(f"  Item {err['index']} (id={err['id']}): {', '.join(err['errors'])}")
            json_file.rename(REJECTED_DIR / json_file.name)
        else:
            # All good – enrich with pricingStatus if missing
            for itm in items:
                itm.setdefault("pricingStatus", "placeholder")
                # Add to duplicate sets for subsequent batches
                existing_ids.add(itm.get("id"))
                existing_keys.add((itm.get("name", "").lower(), itm.get("category", "").lower(), itm.get("unit", "").lower()))
            # Append to working pending file
            approved_items.extend(items)
            with open(WORKING_PENDING, "w", encoding="utf-8") as f:
                json.dump(approved_items, f, indent=2)
            json_file.rename(APPROVED_DIR / json_file.name)
            print(f"[APPROVED] {json_file.name} – {len(items)} items added to pending work.")
    if not any_processed:
        print("No pending JSON files found in review/pending/.")

if __name__ == "__main__":
    main()
