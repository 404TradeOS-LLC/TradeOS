"""
TradeOS Full Pipeline — Steps 2-10
Handles: Validate, Normalize, Deduplicate, Build Assemblies,
         Optimize, Sanity Check, Export, Publish, Feedback
"""

import json, uuid, os, math, difflib, re
from collections import defaultdict

print("\n" + "="*65)
print("  TradeOS Orchestrator — Running Full Pipeline (All Trades)")
print("="*65 + "\n")

# ─────────────────────────────────────────────────────────────
# STEP 2: VALIDATE
# ─────────────────────────────────────────────────────────────
print("─── Step 2: CostItemValidatorAgent ────────────────────────")
REQUIRED_KEYS = {"id", "name", "category", "unit", "laborCost", "materialCost", "equipmentCost"}
VALID_UNITS   = {"SF", "LF", "EA", "HR", "CY", "SQ", "CF"}

with open("Data/raw/items.json", "r") as f:
    raw = json.load(f)

valid_items, rejected = [], []
for item in raw:
    errors = []
    if not all(k in item for k in REQUIRED_KEYS):
        errors.append("Missing required keys")
    if item.get("unit","").upper() not in VALID_UNITS:
        errors.append(f"Invalid unit: {item.get('unit')}")
    total = (item.get("laborCost", 0) or 0) + (item.get("materialCost", 0) or 0) + (item.get("equipmentCost", 0) or 0)
    if total <= 0:
        errors.append("Total cost is zero or negative")
    if not item.get("name", "").strip():
        errors.append("Empty name")
    if errors:
        rejected.append((item.get("name", "?"), errors))
    else:
        valid_items.append(item)

print(f"  ✅ Passed: {len(valid_items)}")
if rejected:
    for name, errs in rejected:
        print(f"  ❌ Rejected '{name}': {errs}")
    print(f"  ⚠️  {len(rejected)} items rejected.")
else:
    print("  All items passed validation.")

assert len(valid_items) > 0, "Pipeline halted: No valid items after validation."
print()

# ─────────────────────────────────────────────────────────────
# STEP 3: NORMALIZE
# ─────────────────────────────────────────────────────────────
print("─── Step 3: CostItemNormalizerAgent ────────────────────────")
UNIT_MAP = {
    "sq ft": "SF", "sqft": "SF", "square feet": "SF",
    "lin ft": "LF", "linft": "LF", "lineal feet": "LF",
    "each": "EA", "hour": "HR", "hr": "HR",
    "cubic yard": "CY", "cub yd": "CY", "square": "SQ", "cubic foot": "CF",
}

def normalize_unit(u):
    u = u.strip()
    return UNIT_MAP.get(u.lower(), u.upper())

def title_case(s):
    # Preserve acronyms all-caps (SF, LF, OC, OSB, LVL, etc.)
    words = s.strip().split()
    result = []
    for w in words:
        if w.upper() in {"SF","LF","EA","HR","CY","SQ","CF","OSB","LVL","OC","PSL","RC","ICF","CMU","PT","PVA","PSI","STC","RSIC","EPS","RO","TV","RV","CF"}:
            result.append(w.upper())
        elif "-" in w:
            result.append(w)  # preserve e.g. "3-5/8"
        else:
            result.append(w.capitalize())
    return " ".join(result)

normalized, n_changes = [], 0
for item in valid_items:
    orig = dict(item)
    item["name"]          = title_case(item["name"])
    item["category"]      = item["category"].strip().title()
    item["unit"]          = normalize_unit(item["unit"])
    item["laborCost"]     = round(float(item["laborCost"]), 2)
    item["materialCost"]  = round(float(item["materialCost"]), 2)
    item["equipmentCost"] = round(float(item["equipmentCost"]), 2)
    if item.get("notes"):
        item["notes"] = item["notes"].strip()
    if item != orig:
        n_changes += 1
    normalized.append(item)

print(f"  ✅ Normalized {len(normalized)} items. Changes applied: {n_changes}")
print()

# ─────────────────────────────────────────────────────────────
# STEP 4: DEDUPLICATE (threshold 0.80 + cost-vector check)
# ─────────────────────────────────────────────────────────────
print("─── Step 4: DeduplicationAgent ─────────────────────────────")
FUZZY_THRESHOLD = 0.80
unique, dupes = [], []

NUMBER_PATTERN = re.compile(r'\b(\d[\d/\-\.]*)\b')

def numeric_tokens(s):
    return set(NUMBER_PATTERN.findall(s.lower()))

for item in normalized:
    is_dup = False
    for u in unique:
        if item["category"] != u["category"]:
            continue
        name_a = item["name"].lower()
        name_b = u["name"].lower()
        sim = difflib.SequenceMatcher(None, name_a, name_b).ratio()
        same_unit = item["unit"] == u["unit"]
        same_cost = (item["laborCost"] == u["laborCost"] and
                     item["materialCost"] == u["materialCost"])

        # Guard: if names share the same structure but differ ONLY in numeric values,
        # they are meaningful variants — do NOT deduplicate
        nums_a = numeric_tokens(name_a)
        nums_b = numeric_tokens(name_b)
        numeric_differs = (nums_a != nums_b) and bool(nums_a) and bool(nums_b)

        if numeric_differs:
            # Names are numeric variants (e.g. #3 rebar vs #4 rebar, 3000psi vs 4000psi)
            # Override: skip dedup even if fuzzy score is high
            continue

        if sim >= FUZZY_THRESHOLD and same_unit:
            dupes.append((item["name"], u["name"], round(sim, 3)))
            is_dup = True
            break
        # Cost-vector secondary signal (same unit + identical labor+material)
        if same_unit and same_cost and item["laborCost"] > 0 and not numeric_differs:
            dupes.append((item["name"], u["name"], "COST_VECTOR"))
            is_dup = True
            break
    if not is_dup:
        unique.append(item)

print(f"  ✅ Unique items after deduplication: {len(unique)}")
if dupes:
    for d in dupes:
        print(f"  🔁 Duplicate removed: '{d[0]}' ~ '{d[1]}' (score: {d[2]})")
print()

# ─────────────────────────────────────────────────────────────
# STEP 5: BUILD ASSEMBLIES
# ─────────────────────────────────────────────────────────────
print("─── Step 5: AssemblyBuilderAgent ───────────────────────────")

# Build lookup: prefer first match per substring key
cat_index = defaultdict(dict)
for item in unique:
    cat_index[item["category"]][item["name"].lower()] = item["id"]

def find(category, *keywords):
    """Find first item id in category whose name contains ALL keywords (case-insensitive)."""
    for name_lower, item_id in cat_index.get(category, {}).items():
        if all(kw.lower() in name_lower for kw in keywords):
            return item_id
    return None

def li(category, qty, *keywords):
    item_id = find(category, *keywords)
    if item_id:
        return {"costBookItemId": item_id, "quantity": float(qty)}
    return None

def build_assembly(name, category, line_items):
    filtered = [l for l in line_items if l is not None]
    if not filtered:
        return None
    return {"id": str(uuid.uuid4()), "name": name, "category": category, "lineItems": filtered}

assemblies = []

# ── DRYWALL ASSEMBLIES ────────────────────────────────────────
a = build_assembly("12x12 Room Drywall Standard Package", "Assemblies - Drywall", [
    li("Drywall", 528, "1/2 inch regular", "walls"),
    li("Drywall", 528, "level 4"),
    li("Drywall",  40, "corner bead", "metal"),
    li("Drywall",   1, "delivery"),
    li("Drywall",   1, "scrap removal"),
])
if a: assemblies.append(a)

a = build_assembly("Soundproof Demising Wall - 1000 SF", "Assemblies - Drywall", [
    li("Drywall", 1000, "soundproof", "walls"),
    li("Drywall",  500, "resilient channel"),
    li("Drywall", 1000, "level 4"),
])
if a: assemblies.append(a)

a = build_assembly("Fire-Rated Stairwell Shaft System - 500 SF", "Assemblies - Drywall", [
    li("Drywall", 500, "shaftwall liner"),
    li("Drywall", 500, "5/8 inch", "type x", "ceilings"),
    li("Drywall", 500, "level 3"),
    li("Drywall", 250, "resilient channel"),
])
if a: assemblies.append(a)

a = build_assembly("Full Room Level 5 Smooth Package - 700 SF", "Assemblies - Drywall", [
    li("Drywall", 700, "1/2 inch regular", "walls"),
    li("Drywall", 700, "level 5"),
    li("Drywall",  50, "corner bead", "metal"),
    li("Drywall", 700, "drywall primer"),
])
if a: assemblies.append(a)

# ── FRAMING ASSEMBLIES ────────────────────────────────────────
a = build_assembly("Standard 10 ft Interior Steel Stud Wall - Per LF", "Assemblies - Framing", [
    li("Framing",  10, "3-5/8 inch 20 gauge", "stud"),
    li("Framing",   2, "3-5/8 inch steel track"),
])
if a: assemblies.append(a)

a = build_assembly("2x6 Wood Frame Exterior Wall - Per LF", "Assemblies - Framing", [
    li("Framing",  10, "2x6 wood stud", "16 oc"),
    li("Framing",   2, "double top plate"),
    li("Framing",   1, "pressure treated bottom"),
    li("Framing",   1, "7/16 inch osb wall sheathing"),
])
if a: assemblies.append(a)

a = build_assembly("Floor System Package - 20x20 Room", "Assemblies - Framing", [
    li("Framing",  400, "i-joist", "9-1/2"),
    li("Framing",  400, "3/4 inch osb subfloor"),
    li("Framing",   80, "rim joist"),
    li("Framing",   20, "joist bridging"),
])
if a: assemblies.append(a)

a = build_assembly("Standard Roof Truss Assembly - Per 20 LF Span", "Assemblies - Framing", [
    li("Framing",   5, "prefab roof truss"),
    li("Framing", 400, "7/16 inch osb roof"),
    li("Framing",  40, "rafter hurricane tie"),
    li("Framing",  20, "ridge board"),
])
if a: assemblies.append(a)

# ── CONCRETE ASSEMBLIES ───────────────────────────────────────
a = build_assembly("4 Inch Garage Slab Package - Per 100 SF", "Assemblies - Concrete", [
    li("Concrete", 100, "4 inch garage"),
    li("Concrete", 100, "welded wire mesh", "6x6"),
    li("Concrete",  40, "wood form", "slab edge 4 inch"),
    li("Concrete", 100, "curing compound"),
    li("Concrete", 100, "broom finish"),
])
if a: assemblies.append(a)

a = build_assembly("Standard Continuous Footing - Per 100 LF", "Assemblies - Concrete", [
    li("Concrete", 100, "continuous concrete footing", "12x12"),
    li("Concrete", 400, "#4 rebar"),
    li("Concrete",  10, "concrete delivery", "3000 psi"),
])
if a: assemblies.append(a)

a = build_assembly("Concrete Driveway Package - Per 500 SF", "Assemblies - Concrete", [
    li("Concrete", 500, "concrete driveway", "4 inch"),
    li("Concrete", 500, "welded wire mesh", "4x4"),
    li("Concrete",  80, "wood form", "slab edge 6 inch"),
    li("Concrete", 500, "concrete broom finish"),
    li("Concrete", 500, "curing compound"),
    li("Concrete", 100, "concrete saw cutting"),
])
if a: assemblies.append(a)

a = build_assembly("Stamped Concrete Patio - Per 200 SF", "Assemblies - Concrete", [
    li("Concrete", 200, "concrete slab on grade", "standard"),
    li("Concrete", 200, "stamped concrete", "multi pattern"),
    li("Concrete", 200, "concrete slab sealed"),
    li("Concrete",  60, "wood form", "slab edge 4 inch"),
])
if a: assemblies.append(a)

print(f"  ✅ Built {len(assemblies)} assemblies")
print()

# ─────────────────────────────────────────────────────────────
# STEP 6: OPTIMIZE ASSEMBLIES
# ─────────────────────────────────────────────────────────────
print("─── Step 6: AssemblyOptimizerAgent ────────────────────────")
opt_log = []

# Build a unit lookup map from unique items
unit_map = {item["id"]: item["unit"] for item in unique}

for assy in assemblies:
    for li_item in assy["lineItems"]:
        qty  = li_item["quantity"]
        iid  = li_item["costBookItemId"]
        unit = unit_map.get(iid, "")
        if qty >= 100.0:
            new_qty = math.ceil(qty * 1.10)
            opt_log.append(f"  🔧 {assy['name']}: qty {qty:.0f} → {new_qty} (+10% waste, unit={unit})")
            li_item["quantity"] = float(new_qty)
        elif unit == "LF":
            # Flat 5% waste for all LF items regardless of qty
            new_qty = math.ceil(qty * 1.05)
            if new_qty != qty:
                opt_log.append(f"  🔧 {assy['name']}: LF qty {qty:.0f} → {new_qty} (+5% LF waste)")
                li_item["quantity"] = float(new_qty)

if opt_log:
    for l in opt_log:
        print(l)
    print(f"  ✅ {len(opt_log)} quantity adjustments made.")
else:
    print("  ✅ No optimization needed.")
print()

# ─────────────────────────────────────────────────────────────
# STEP 7: PRICING SANITY CHECK
# ─────────────────────────────────────────────────────────────
print("─── Step 7: PricingSanityAgent ─────────────────────────────")

# Min cost thresholds by unit
MIN_COST = {"SF": 0.05, "LF": 0.10, "EA": 1.00, "HR": 12.00, "CY": 8.00, "SQ": 5.00, "CF": 0.50}
MAX_LABOR_RATIO = 0.98  # labor cannot be > 98% of total

sanity_ok, sanity_flags = [], []

for item in unique:
    total  = item["laborCost"] + item["materialCost"] + item["equipmentCost"]
    unit   = item["unit"]
    min_t  = MIN_COST.get(unit, 0.01)
    flags  = []
    if total < min_t:
        flags.append(f"Total cost {total:.2f} below min {min_t} for {unit}")
    if total > 0 and item["laborCost"] / total > MAX_LABOR_RATIO:
        flags.append(f"Labor ratio {item['laborCost']/total:.0%} suspiciously high")
    if flags:
        sanity_flags.append((item["name"], flags))
    else:
        sanity_ok.append(item)

print(f"  ✅ Passed: {len(sanity_ok)}")
if sanity_flags:
    for name, flags in sanity_flags:
        print(f"  ⚠️  Flagged '{name}': {flags}")
print()

# ─────────────────────────────────────────────────────────────
# STEP 8: FORMAT AND EXPORT
# ─────────────────────────────────────────────────────────────
print("─── Step 8: ExportFormatterAgent ───────────────────────────")

# Enforce strict 2-decimal float serialization
def enforce_decimals(items):
    out = []
    for item in items:
        item = dict(item)
        item["laborCost"]     = round(float(item["laborCost"]), 2)
        item["materialCost"]  = round(float(item["materialCost"]), 2)
        item["equipmentCost"] = round(float(item["equipmentCost"]), 2)
        # Remove null notes
        if item.get("notes") is None:
            item.pop("notes", None)
        out.append(item)
    return out

def enforce_assembly_decimals(assemblies):
    out = []
    for a in assemblies:
        a = dict(a)
        a["lineItems"] = [{"costBookItemId": li["costBookItemId"], "quantity": round(float(li["quantity"]), 2)} for li in a["lineItems"]]
        out.append(a)
    return out

payload = {
    "items": enforce_decimals(sanity_ok),
    "assemblies": enforce_assembly_decimals(assemblies)
}

os.makedirs("Data/working", exist_ok=True)
os.makedirs("Data/export", exist_ok=True)

with open("Data/working/costbook.json", "w") as f:
    json.dump(payload, f, indent=2)
with open("Data/export/costbook.json", "w") as f:
    json.dump(payload, f, indent=2)

print(f"  ✅ Exported {len(payload['items'])} items + {len(payload['assemblies'])} assemblies")
print("  Saved → Data/working/costbook.json")
print("  Saved → Data/export/costbook.json")
print()

# ─────────────────────────────────────────────────────────────
# STEP 9: MOCK PUBLISH
# ─────────────────────────────────────────────────────────────
print("─── Step 9: SyncPublisherAgent ─────────────────────────────")
print("  Connecting to Supabase (mock)...")
print(f"  200 OK — Synchronized {len(payload['items'])} items, {len(payload['assemblies'])} assemblies")
print()

# ─────────────────────────────────────────────────────────────
# STEP 10: FEEDBACK LOG
# ─────────────────────────────────────────────────────────────
print("─── Step 10: AgentFeedbackAgent ────────────────────────────")

# Tally items by trade
by_trade = defaultdict(int)
for item in payload["items"]:
    by_trade[item["category"]] += 1

print("  📊 Final Item Counts by Trade:")
for trade, count in sorted(by_trade.items()):
    print(f"       {trade}: {count} items")

print(f"\n  📦 Assemblies: {len(payload['assemblies'])}")
print(f"  🔁 Duplicates removed: {len(dupes)}")
print(f"  ❌ Items rejected: {len(rejected)}")
print(f"  ⚠️  Sanity flagged: {len(sanity_flags)}")
print(f"  🔧 Assembly optimizations: {len(opt_log)}")

print()
print("="*65)
print(f"  ✅  PIPELINE COMPLETE — {len(payload['items'])} items | {len(payload['assemblies'])} assemblies")
print("="*65)
