#!/usr/bin/env python3
"""
audit-assemblies.py

Audits existing assemblies for a trade and produces:
  - runtime/assembly-audit-<trade>.json  (machine-readable, consumed by
    start-assembly-run.py / next-assembly-batch.py)
  - docs/assembly-coverage-<trade>.md    (human-readable report)

Usage:
    python3 scripts/audit-assemblies.py --trade roofing
"""

import argparse
import sys
from collections import Counter

from assembly_pipeline_common import (
    DOCS_DIR,
    KNOWLEDGE_DIR,
    PROJECT_ROOT,
    RUNTIME_DIR,
    REVIEW_DIR,
    APPROVED_DIR,
    PENDING_DIR,
    REJECTED_DIR,
    audit_path_for_trade,
    compute_quality_score,
    is_placeholder_id,
    is_valid_uuid,
    load_existing_assemblies,
    load_json,
    load_schema,
    normalize_name,
    save_json,
    validate_schema,
)

EXPORTS_DIR = PROJECT_ROOT / "exports" / "json"

# High-value sub-categories worth prioritizing per trade. Extend as new
# trades are onboarded; a trade with no entry here simply won't get
# category-specific recommendations (missing_high_value_categories == []).
HIGH_VALUE_CATEGORY_MAP = {
    "roofing": ["Membrane", "Ventilation", "Flashing", "Underlayment", "Skylight"],
    "drywall": ["Ceiling", "Walls", "Corner Bead"],
    "flooring": ["Subfloor", "Hardwood", "Tile"],
    "tree-service": ["Removal", "Pruning", "Stump Grinding", "Storm Cleanup"],
    "tree service": ["Removal", "Pruning", "Stump Grinding", "Storm Cleanup"],
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit existing assemblies for a trade and produce JSON + markdown reports."
    )
    parser.add_argument("--trade", required=True, help="Trade name to audit (e.g., roofing)")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    trade = args.trade.lower()

    docs_dir = DOCS_DIR
    review_dir = REVIEW_DIR
    for d in [RUNTIME_DIR, docs_dir, review_dir, PENDING_DIR, APPROVED_DIR, REJECTED_DIR]:
        d.mkdir(parents=True, exist_ok=True)

    if not KNOWLEDGE_DIR.is_dir():
        print(f"[WARN] Knowledge directory not found: {KNOWLEDGE_DIR}", file=sys.stderr)

    assemblies = load_existing_assemblies(trade)

    # Cost items, for assembly <-> cost-item linkage checks.
    costbook_path = EXPORTS_DIR / "costbook.json"
    cost_items = []
    if costbook_path.is_file():
        try:
            costbook = load_json(costbook_path, {})
            cost_items = costbook.get("items", [])
        except Exception as e:
            print(f"[WARN] Could not read costbook.json: {e}", file=sys.stderr)
    else:
        print(f"[WARN] Costbook export not found: {costbook_path}", file=sys.stderr)
    cost_item_ids = {item.get("id") for item in cost_items}

    # --- Duplicate name / slug detection (case-insensitive) ---
    name_counts = Counter(normalize_name(a.get("name", "")) for a in assemblies)
    duplicate_risks = [name for name, cnt in name_counts.items() if name and cnt > 1]
    slug_counts = Counter(normalize_name(a.get("slug", "")) for a in assemblies)
    duplicate_risks.extend(
        slug for slug, cnt in slug_counts.items() if slug and cnt > 1 and slug not in duplicate_risks
    )

    # --- Schema + quality-standard scoring for every existing assembly ---
    schema = load_schema()
    schema_validation_errors = []
    low_quality = []
    placeholder_ids = []
    quality_scores = []
    for a in assemblies:
        errs = validate_schema(a, schema)
        if errs:
            schema_validation_errors.append({"assembly": a.get("name"), "errors": errs})
        qs = compute_quality_score(a, errs)
        quality_scores.append({"assembly": a.get("name"), **qs})
        if qs["gate"] != "auto-approve":
            low_quality.append(a.get("name", ""))
        if is_placeholder_id(a.get("id")) or not is_valid_uuid(a.get("id")):
            placeholder_ids.append({"assembly": a.get("name"), "field": "id", "value": a.get("id")})

    # --- Assembly <-> cost-item linkage ---
    assemblies_without_cost = []
    cost_items_without_assembly = set(cost_item_ids)
    broken_relationships = []
    for a in assemblies:
        line_items = a.get("lineItems", [])
        linked = False
        for li in line_items:
            cid = li.get("costBookItemId")
            if not cid:
                continue
            linked = True
            if cost_item_ids and cid not in cost_item_ids:
                broken_relationships.append({"assembly": a.get("name"), "missingCostId": cid})
            else:
                cost_items_without_assembly.discard(cid)
            if is_placeholder_id(cid) or not is_valid_uuid(cid):
                placeholder_ids.append({"assembly": a.get("name"), "field": "lineItems.costBookItemId", "value": cid})
        if not linked:
            assemblies_without_cost.append(a.get("name"))

    # --- Coverage gaps ---
    covered_cats = sorted({a.get("category") for a in assemblies if a.get("category")})
    missing_high_value_categories = [
        c for c in HIGH_VALUE_CATEGORY_MAP.get(trade, []) if c not in covered_cats
    ]

    recommended_next = []
    for cat in missing_high_value_categories:
        for i in range(1, 4):
            recommended_next.append({"name": f"{trade.title()} - {cat} - {i}", "category": cat})
            if len(recommended_next) >= 10:
                break
        if len(recommended_next) >= 10:
            break

    trade_progress_path = KNOWLEDGE_DIR / "trade-progress.json"
    target_count = 100
    trade_progress = load_json(trade_progress_path, None)
    if trade_progress:
        for entry in trade_progress.get("trades", []):
            if normalize_name(entry.get("category", "")) == trade:
                target_count = entry.get("itemCount", target_count)
                break

    audit = {
        "trade": trade,
        "existing_assemblies": assemblies,
        "existing_assembly_count": len(assemblies),
        "duplicate_risks": duplicate_risks,
        "low_quality": low_quality,
        "quality_scores": quality_scores,
        "schema_validation_errors": schema_validation_errors,
        "assemblies_without_cost": assemblies_without_cost,
        "cost_items_without_assembly": sorted(cost_items_without_assembly),
        "placeholder_ids": placeholder_ids,
        "broken_relationships": broken_relationships,
        "covered_categories": covered_cats,
        "missing_high_value_categories": missing_high_value_categories,
        "recommended_next": recommended_next,
        "target_count": target_count,
    }

    audit_path = audit_path_for_trade(trade)
    save_json(audit_path, audit)

    md_path = docs_dir / f"assembly-coverage-{trade}.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(f"# Assembly Coverage - {trade.title()}\n\n")
        f.write(f"**Existing assemblies**: {len(assemblies)}\n\n")
        f.write(f"**Duplicate name/slug risks**: {', '.join(duplicate_risks) or 'None'}\n\n")
        f.write(f"**Below quality-gate assemblies (QS < 0.90)**: {', '.join(low_quality) or 'None'}\n\n")
        f.write(f"**Assemblies without linked cost items**: {', '.join(assemblies_without_cost) or 'None'}\n\n")
        f.write(f"**Cost items not used in any assembly**: {len(cost_items_without_assembly)}\n\n")
        f.write(f"**Placeholder / invalid IDs**: {', '.join(str(p) for p in placeholder_ids) or 'None'}\n\n")
        f.write(f"**Broken relationships**: {', '.join(str(b) for b in broken_relationships) or 'None'}\n\n")
        f.write(f"**Covered categories**: {', '.join(covered_cats) or 'None'}\n\n")
        f.write(f"**Missing high-value categories**: {', '.join(missing_high_value_categories) or 'None'}\n\n")
        f.write("## Recommended next assemblies\n\n")
        if recommended_next:
            for rec in recommended_next:
                f.write(f"- {rec['name']} (Category: {rec['category']})\n")
        else:
            f.write("_No high-value category gaps identified; use `--allow-empty` on "
                     "`next-assembly-batch.py` to generate general-purpose assemblies._\n")
        f.write(f"\n**Target total assemblies**: {target_count}\n")
        if schema is None:
            f.write("\n> [!WARN] Schema file not found at `schemas/assembly.schema.json`; schema checks were skipped.\n")
        else:
            f.write("\n> [!NOTE] Schema + quality-score validation performed; "
                     "see `schema_validation_errors` and `quality_scores` in the JSON audit file.\n")

    print(f"Audit written to {audit_path.relative_to(PROJECT_ROOT)}")
    print(f"Report written to {md_path.relative_to(PROJECT_ROOT)}")


if __name__ == "__main__":
    main()
