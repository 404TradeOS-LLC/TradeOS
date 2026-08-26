import json
import os
import sys

# Phase B: bootstrap access to package_root.py, which lives one directory up (pipelines/).
# publish_to_supabase.py is invoked as a standalone subprocess (see scripts/approve-batch.py),
# so it cannot rely on another script's sys.path setup -- see packages/knowledge-engine/PATHS.md.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from package_root import resolve_export_root

def generate_sql():
    export_root = resolve_export_root()
    with open(export_root / "json" / "costbook.json", "r") as f:
        payload = json.load(f)
    
    items = payload["items"]
    assemblies = payload["assemblies"]
    
    sql_blocks = []
    
    # ── 1. UPSERT COST ITEMS ──────────────────────────────────
    item_rows = []
    for item in items:
        # Escape single quotes in names/notes
        name = item["name"].replace("'", "''")
        cat = item["category"].replace("'", "''")
        unit = item["unit"].replace("'", "''")
        notes = (item.get("notes") or "").replace("'", "''")
        
        row = (
            f"('{item['id']}', '{name}', '{cat}', '{unit}', "
            f"{item['laborCost']}, {item['materialCost']}, {item['equipmentCost']}, '{notes}')"
        )
        item_rows.append(row)
    
    # Batch items to avoid hitting query length limits (500 per batch)
    for i in range(0, len(item_rows), 500):
        batch = item_rows[i:i+500]
        sql = f"""
INSERT INTO public.cost_items (id, name, category, unit, labor_cost, material_cost, equipment_cost, notes)
VALUES 
{",".join(batch)}
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  unit = EXCLUDED.unit,
  labor_cost = EXCLUDED.labor_cost,
  material_cost = EXCLUDED.material_cost,
  equipment_cost = EXCLUDED.equipment_cost,
  notes = EXCLUDED.notes,
  updated_at = now();
"""
        sql_blocks.append(sql)

    # ── 2. UPSERT ASSEMBLIES ──────────────────────────────────
    assy_rows = []
    assy_item_rows = []
    for assy in assemblies:
        name = assy["name"].replace("'", "''")
        cat = assy["category"].replace("'", "''")
        assy_rows.append(f"('{assy['id']}', '{name}', '{cat}')")
        
        for li in assy["lineItems"]:
            assy_item_rows.append(f"('{assy['id']}', '{li['costBookItemId']}', {li['quantity']})")

    if assy_rows:
        sql = f"""
INSERT INTO public.assemblies (id, name, category)
VALUES {",".join(assy_rows)}
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  updated_at = now();
"""
        sql_blocks.append(sql)

    # ── 3. UPSERT ASSEMBLY ITEMS ──────────────────────────────
    # Clean up existing assembly items for these assemblies to ensure fresh sync
    assy_ids = [f"'{a['id']}'" for a in assemblies]
    if assy_ids:
        sql_blocks.append(f"DELETE FROM public.assembly_items WHERE assembly_id IN ({','.join(assy_ids)});")

    if assy_item_rows:
        sql = f"""
INSERT INTO public.assembly_items (assembly_id, cost_item_id, quantity)
VALUES {",".join(assy_item_rows)};
"""
        sql_blocks.append(sql)

    # Save SQL blocks to the canonical exports/sql root for the agent to execute.
    # Phase B: anchored, not cwd-relative -- see packages/knowledge-engine/PATHS.md.
    sql_dir = export_root / "sql"
    os.makedirs(sql_dir, exist_ok=True)
    sync_sql_path = sql_dir / "sync.sql"
    with open(sync_sql_path, "w") as f:
        f.write("\n-- BATCH DIVIDER --\n".join(sql_blocks))

    print(f"Generated {len(sql_blocks)} SQL blocks in {sync_sql_path}")

if __name__ == "__main__":
    generate_sql()
