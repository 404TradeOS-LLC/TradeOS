"""
TradeOS Master Pipeline — Full 19-Agent Run
Imports all CostBookAgents, runs Steps 2-10 pipeline.
Replaces generate_all.py + pipeline.py for the full agent tree.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "generation"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "export"))

import json, uuid, math, difflib, re
from collections import defaultdict
from sync_manager import RelationalSynchronizer
from package_root import resolve_package_root, resolve_export_root

# ─────────────────────────────────────────────────────────────
# STEP 1: GENERATE — import all agents
# ─────────────────────────────────────────────────────────────
print("\n" + "="*70)
print("  TradeOS Orchestrator — Full 19-Agent Pipeline")
print("="*70 + "\n")
print("─── Step 1: CostItemGeneratorAgent ────────────────────────────────")

from seeds.structural.framing_agent      import ITEMS as FRAMING
from seeds.structural.concrete_agent     import ITEMS as CONCRETE
from seeds.structural.excavation_agent   import ITEMS as EXCAVATION
from seeds.envelope.roofing_agent        import ITEMS as ROOFING
from seeds.envelope.siding_agent         import ITEMS as SIDING
from seeds.envelope.insulation_agent     import ITEMS as INSULATION
from seeds.envelope.windows_doors_agent  import ITEMS as WINDOWS_DOORS
from seeds.mep.electrical_agent          import ITEMS as ELECTRICAL
from seeds.mep.plumbing_agent            import ITEMS as PLUMBING
from seeds.mep.hvac_agent                import ITEMS as HVAC
from seeds.interior.drywall_agent        import ITEMS as DRYWALL
from seeds.interior.painting_agent       import ITEMS as PAINTING
from seeds.interior.flooring_agent       import ITEMS as FLOORING
from seeds.interior.trim_agent           import ITEMS as TRIM
from seeds.interior.cabinetry_agent     import ITEMS as CABINETRY
from seeds.exterior.deck_agent           import ITEMS as DECK
from seeds.exterior.fence_agent          import ITEMS as FENCE
from seeds.exterior.flatwork_agent       import ITEMS as FLATWORK
from seeds.exterior.landscaping_agent    import ITEMS as LANDSCAPING
from seeds.general.general_conditions_agent import ITEMS as GENERAL

from seeds.assemblies.assembly_agents import build_all_assembly_agent_assemblies

ALL_ITEMS = (
    FRAMING + CONCRETE + EXCAVATION +
    ROOFING + SIDING + INSULATION + WINDOWS_DOORS +
    ELECTRICAL + PLUMBING + HVAC +
    DRYWALL + PAINTING + FLOORING + TRIM + CABINETRY +
    DECK + FENCE + FLATWORK + LANDSCAPING +
    GENERAL
)

print(f"  ✅ Loaded {len(ALL_ITEMS)} raw items from 17 agents")
by_agent = defaultdict(int)
for item in ALL_ITEMS:
    by_agent[item["category"]] += 1
for cat, cnt in sorted(by_agent.items()):
    print(f"       {cat}: {cnt} items")
print()

# ─────────────────────────────────────────────────────────────
# STEP 2: VALIDATE
# ─────────────────────────────────────────────────────────────
print("─── Step 2: CostItemValidatorAgent ────────────────────────────────")
REQUIRED_KEYS = {"id", "name", "category", "unit", "laborCost", "materialCost", "equipmentCost"}
VALID_UNITS   = {"SF", "LF", "EA", "HR", "CY", "SQ", "CF"}

valid_items, rejected = [], []
for item in ALL_ITEMS:
    errors = []
    if not all(k in item for k in REQUIRED_KEYS):
        errors.append("Missing required keys")
    if item.get("unit", "").upper() not in VALID_UNITS:
        errors.append(f"Invalid unit: {item.get('unit')}")
    total = (item.get("laborCost", 0) or 0) + (item.get("materialCost", 0) or 0) + (item.get("equipmentCost", 0) or 0)
    if total <= 0:
        errors.append("Total cost zero or negative")
    if not item.get("name", "").strip():
        errors.append("Empty name")
    if errors:
        rejected.append((item.get("name", "?"), errors))
    else:
        valid_items.append(item)

print(f"  ✅ Passed: {len(valid_items)}  |  Rejected: {len(rejected)}")
if rejected:
    for name, errs in rejected:
        print(f"  ❌ '{name}': {errs}")
print()

# ─────────────────────────────────────────────────────────────
# STEP 3: NORMALIZE
# ─────────────────────────────────────────────────────────────
print("─── Step 3: CostItemNormalizerAgent ────────────────────────────────")
UNIT_MAP = {
    "sq ft": "SF", "sqft": "SF", "square feet": "SF",
    "lin ft": "LF", "linft": "LF", "lineal feet": "LF",
    "each": "EA", "hour": "HR", "hr": "HR",
    "cubic yard": "CY", "cub yd": "CY", "square": "SQ", "cubic foot": "CF",
}
ACRONYMS = {
    "SF","LF","EA","HR","CY","SQ","CF","OSB","LVL","OC","PSL","RC","ICF","CMU",
    "PT","PVA","PSI","STC","RSIC","EPS","RO","TV","RV","CF","EIFS","ERV","HRV",
    "AFUE","BTU","SEER","PVC","ABS","CPVC","HDPE","EMT","RGS","GFCI","AFCI",
    "UV","IAQ","HVAC","MEP","OAC","RFI","HOA","PPE","WC","CO","PM","EV","SWPPP",
    "TPO","EPDM","BUR","LVP","LVT","SLU","PRV","GFI","DWV","CSST","MDF","PEX",
}

def normalize_unit(u):
    return UNIT_MAP.get(u.strip().lower(), u.strip().upper())

def title_case(s):
    words = s.strip().split()
    result = []
    for w in words:
        if w.upper() in ACRONYMS:
            result.append(w.upper())
        elif re.match(r'\d', w) or "-" in w:
            result.append(w)
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

print(f"  ✅ Normalized {len(normalized)} items.  Changes applied: {n_changes}")
print()

# ─────────────────────────────────────────────────────────────
# STEP 4: DEDUPLICATE (threshold 0.80 + numeric-variant guard)
# ─────────────────────────────────────────────────────────────
print("─── Step 4: DeduplicationAgent ─────────────────────────────────────")
FUZZY_THRESHOLD = 0.80
NUMBER_PATTERN  = re.compile(r'\b(\d[\d/\-\.]*)\b')

def numeric_tokens(s):
    return set(NUMBER_PATTERN.findall(s.lower()))

unique, dupes = [], []
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
        nums_a = numeric_tokens(name_a)
        nums_b = numeric_tokens(name_b)
        numeric_differs = (nums_a != nums_b) and bool(nums_a) and bool(nums_b)
        if numeric_differs:
            continue   # preserve numeric variants
        if sim >= FUZZY_THRESHOLD and same_unit:
            dupes.append((item["name"], u["name"], round(sim, 3)))
            is_dup = True
            break
        if same_unit and same_cost and item["laborCost"] > 0 and not numeric_differs:
            # require name sim >= 0.75 for cost-vector dedup (Run 2 fix)
            if sim >= 0.75:
                dupes.append((item["name"], u["name"], "COST_VECTOR"))
                is_dup = True
                break
    if not is_dup:
        unique.append(item)

print(f"  ✅ Unique items after deduplication: {len(unique)}  |  Removed: {len(dupes)}")
print()

# ─────────────────────────────────────────────────────────────
# STEP 5: BUILD ASSEMBLIES (legacy + all new assembly agents)
# ─────────────────────────────────────────────────────────────
print("─── Step 5: AssemblyBuilderAgent ───────────────────────────────────")
unit_map = {item["id"]: item["unit"] for item in unique}

def find_id(category, *keywords):
    kws = [k.lower() for k in keywords]
    for item in unique:
        if item["category"].lower() != category.lower():
            continue
        if all(k in item["name"].lower() for k in kws):
            return item["id"]
    return None

def make_li(category, qty, *keywords):
    iid = find_id(category, *keywords)
    return {"costBookItemId": iid, "quantity": float(qty)} if iid else None

def make_assembly(name, category, line_items):
    filtered = [x for x in line_items if x is not None]
    if not filtered:
        return None
    return {"id": str(uuid.uuid4()), "name": name, "category": category, "lineItems": filtered}

assemblies = []

# ── Structural ────────────────────────────────────────────────
a = make_assembly("Full Exterior Wall System - 100 LF 10 Ft", "Assemblies - Structural", [
    make_li("Framing",     1000, "2x6 wood stud", "16 oc"),
    make_li("Framing",      200, "double top plate"),
    make_li("Framing",      100, "pressure treated bottom"),
    make_li("Framing",     1000, "7/16 inch osb wall sheathing"),
    make_li("Insulation",  1000, "fiberglass batt r-19"),
    make_li("Siding",      1000, "fiber cement lap", "6.25"),
])
if a: assemblies.append(a)

a = make_assembly("Floor System - 20x20 Room", "Assemblies - Structural", [
    make_li("Framing",  400, "i-joist", "9-1/2"),
    make_li("Framing",  400, "3/4 inch osb subfloor"),
    make_li("Framing",   80, "rim joist"),
    make_li("Framing",   20, "joist bridging"),
])
if a: assemblies.append(a)

a = make_assembly("Standard Roof Truss Assembly - 20 LF Span", "Assemblies - Structural", [
    make_li("Framing",   5, "prefab roof truss"),
    make_li("Framing", 400, "7/16 inch osb roof sheathing"),
    make_li("Roofing",   5, "rafter hurricane tie"),
])
if a: assemblies.append(a)

# ── Drywall ───────────────────────────────────────────────────
a = make_assembly("12x12 Room Drywall Standard Package", "Assemblies - Drywall", [
    make_li("Drywall", 528, "1/2 inch regular drywall", "walls"),
    make_li("Drywall", 528, "tape and finish", "level 4"),
    make_li("Drywall",  40, "corner bead", "metal"),
    make_li("General Conditions", 1, "daily site cleanup"),
])
if a: assemblies.append(a)

a = make_assembly("Soundproof Demising Wall - 1000 SF", "Assemblies - Drywall", [
    make_li("Drywall", 1000, "soundproof", "walls"),
    make_li("Drywall",  500, "resilient channel"),
    make_li("Drywall", 1000, "tape and finish", "level 4"),
])
if a: assemblies.append(a)

# ── MEP ──────────────────────────────────────────────────────
a = make_assembly("Whole House HVAC System - 2000 SF Home", "Assemblies - MEP", [
    make_li("HVAC", 1, "gas furnace", "96% afue", "80k"),
    make_li("HVAC", 1, "central ac", "3 ton"),
    make_li("HVAC", 1, "thermostat", "wi-fi"),
    make_li("HVAC", 1, "whole house humidifier", "bypass"),
    make_li("HVAC", 1, "erv"),
])
if a: assemblies.append(a)

a = make_assembly("200A Electrical Service Package", "Assemblies - MEP", [
    make_li("Electrical", 1, "200 amp overhead service"),
    make_li("Electrical", 1, "200 amp main panel", "40 circuit"),
    make_li("Electrical", 1, "whole house surge"),
    make_li("Electrical", 1, "grounding electrode"),
    make_li("Electrical", 1, "ev charger circuit"),
])
if a: assemblies.append(a)

a = make_assembly("Standard 2-Bathroom Plumbing Package", "Assemblies - MEP", [
    make_li("Plumbing", 1, "50 gallon gas"),
    make_li("Plumbing", 1, "expansion tank"),
    make_li("Plumbing", 2, "rough-in", "per fixture"),
    make_li("Plumbing", 2, "trim-out", "per fixture"),
    make_li("Plumbing", 1, "backflow preventer"),
    make_li("Plumbing", 1, "main water shutoff"),
])
if a: assemblies.append(a)

# ── Concrete (legacy) ─────────────────────────────────────────
a = make_assembly("4 Inch Garage Slab Package - 100 SF", "Assemblies - Concrete", [
    make_li("Concrete", 100, "4 inch garage concrete"),
    make_li("Concrete", 100, "welded wire mesh", "6x6"),
    make_li("Concrete",  40, "wood form", "slab edge 4 inch"),
    make_li("Concrete", 100, "curing compound"),
    make_li("Concrete", 100, "broom finish"),
])
if a: assemblies.append(a)

a = make_assembly("Concrete Driveway Package - 500 SF", "Assemblies - Concrete", [
    make_li("Concrete", 500, "concrete driveway", "4 inch"),
    make_li("Concrete", 500, "welded wire mesh", "4x4"),
    make_li("Concrete", 500, "concrete broom finish"),
    make_li("Concrete", 500, "curing compound"),
    make_li("Concrete", 100, "concrete saw cutting"),
])
if a: assemblies.append(a)

# ── Exterior ─────────────────────────────────────────────────
a = make_assembly("Standard Wood Deck - 200 SF", "Assemblies - Exterior", [
    make_li("Deck",   4, "deck concrete footing", "12x12"),
    make_li("Deck",   4, "6x6 pressure treated post"),
    make_li("Deck", 200, "composite decking", "mid grade"),
    make_li("Deck",  60, "composite railing system"),
    make_li("Deck",   1, "wood walk gate", "6 ft"),
])
if a: assemblies.append(a)

a = make_assembly("6 Ft Privacy Fence - 150 LF", "Assemblies - Exterior", [
    make_li("Fence", 150, "6 ft privacy wood fence", "board on board"),
    make_li("Fence",   2, "wood walk gate", "4 ft"),
    make_li("Fence",  40, "wood post", "4x4 pt"),
])
if a: assemblies.append(a)

# ── Roofing ──────────────────────────────────────────────────
a = make_assembly("Full Residential Roof Package - 2000 SF", "Assemblies - Roofing", [
    make_li("Roofing",  20, "shingle tear-off", "single layer"),
    make_li("Roofing",  20, "ice and water shield", "eaves"),
    make_li("Roofing",  20, "synthetic underlayment", "light"),
    make_li("Roofing",  20, "architectural shingle", "standard"),
    make_li("Roofing", 120, "hip and ridge cap"),
    make_li("Roofing",  80, "drip edge"),
    make_li("Roofing",  60, "aluminum gutter", "5 inch k-style"),
    make_li("Roofing",  30, "downspout", "2x3"),
])
if a: assemblies.append(a)

# ── Insulation ────────────────────────────────────────────────
a = make_assembly("Full House Insulation Package - 2000 SF", "Assemblies - Insulation", [
    make_li("Insulation",  2000, "fiberglass batt r-11", "2x4 wall"),
    make_li("Insulation",  2000, "blown-in cellulose", "attic r-49"),
    make_li("Insulation",   400, "closed cell foam", "rim joist"),
    make_li("Insulation",   400, "6 mil poly vapor barrier"),
    make_li("Insulation",     1, "blower door test"),
])
if a: assemblies.append(a)

# ── Flooring ─────────────────────────────────────────────────
a = make_assembly("Hardwood Flooring Package - Main Floor 1200 SF", "Assemblies - Flooring", [
    make_li("Flooring", 1200, "engineered hardwood", "1/2 inch"),
    make_li("Flooring",  480, "quarter round trim"),
    make_li("Flooring",   40, "floor transition", "t-molding"),
    make_li("Flooring",    1, "subfloor leveling"),
])
if a: assemblies.append(a)

# ── Windows & Doors ──────────────────────────────────────────
a = make_assembly("Full House Window & Entry Door Package", "Assemblies - Envelope", [
    make_li("Windows", 12, "vinyl single hung", "3x5"),
    make_li("Windows",  2, "vinyl slider", "4x4"),
    make_li("Doors",    1, "fiberglass entry door", "pre-hung"),
    make_li("Doors",    1, "steel fire door", "90 minute"),
    make_li("Doors",    1, "vinyl sliding patio door", "6-0"),
    make_li("Hardware", 3, "entry lockset", "deadbolt"),
])
if a: assemblies.append(a)

# ── Detailed Structural Assemblies ─────────────────────────────────────
a = make_assembly("Full Foundation Assembly - 2000 SF", "Assemblies - Structural", [
    make_li("Concrete", 2000, "footings", "8 inch"),
    make_li("Concrete", 2000, "rebar", "grade 60"),
    make_li("Concrete", 2000, "formwork", "wood"),
    make_li("Concrete", 2000, "curing compound"),
])
if a: assemblies.append(a)

a = make_assembly("Full Framing Assembly - 2000 SF", "Assemblies - Structural", [
    make_li("Framing", 2000, "2x6 wood studs", "16 oc"),
    make_li("Framing", 200, "double top plate"),
    make_li("Framing", 200, "pressure treated bottom plate"),
    make_li("Framing", 2000, "OSB wall sheathing", "7/16"),
])
if a: assemblies.append(a)

a = make_assembly("Basement Shell Assembly - 1500 SF", "Assemblies - Structural", [
    make_li("Concrete", 1500, "basement slab", "6 inch"),
    make_li("Insulation", 1500, "rigid foam", "R-5"),
    make_li("Framing", 1500, "basement wall studs", "2x4"),
])
if a: assemblies.append(a)

# ── Detailed Envelope Assemblies ─────────────────────────────────────
a = make_assembly("Roofing Complete Assembly - 2000 SF", "Assemblies - Envelope", [
    make_li("Roofing", 20, "shingle tear-off", "single layer"),
    make_li("Roofing", 20, "ice and water shield", "eaves"),
    make_li("Roofing", 20, "synthetic underlayment", "light"),
    make_li("Roofing", 20, "architectural shingle", "standard"),
    make_li("Roofing", 120, "hip and ridge cap"),
    make_li("Roofing", 80, "drip edge"),
    make_li("Roofing", 60, "aluminum gutter", "5 inch k-style"),
    make_li("Roofing", 30, "downspout", "2x3"),
    make_li("Insulation", 2000, "roof insulation", "R-30"),
])
if a: assemblies.append(a)

a = make_assembly("Siding Complete Assembly - 2000 SF", "Assemblies - Envelope", [
    make_li("Siding", 2000, "fiber cement siding", "6.25"),
    make_li("Siding", 2000, "house wrap"),
    make_li("Siding", 2000, "flashing", "windows & doors"),
    make_li("Siding", 2000, "trim", "casing"),
])
if a: assemblies.append(a)

# ── Detailed MEP Assemblies ────────────────────────────────────────
a = make_assembly("HVAC Ductwork Assembly - 2000 SF Home", "Assemblies - MEP", [
    make_li("HVAC", 1, "air handler", "5 ton"),
    make_li("HVAC", 1, "supply duct", "galvanized"),
    make_li("HVAC", 1, "return duct", "galvanized"),
    make_li("HVAC", 1, "register", "per room"),
    make_li("HVAC", 1, "duct insulation", "R-8"),
])
if a: assemblies.append(a)

a = make_assembly("Full Bath Plumbing Assembly - 2 Bath", "Assemblies - MEP", [
    make_li("Plumbing", 2, "tub/shower combo", "per unit"),
    make_li("Plumbing", 2, "toilet", "per unit"),
    make_li("Plumbing", 2, "lavatory faucet", "per unit"),
    make_li("Plumbing", 2, "sink basin", "per unit"),
    make_li("Plumbing", 1, "main water supply", "per house"),
    make_li("Plumbing", 1, "drain vent stack"),
])
if a: assemblies.append(a)

# ── Detailed Interior Assemblies ─────────────────────────────────────
a = make_assembly("Drywall Full Package - 2000 SF Walls & Ceilings", "Assemblies - Drywall", [
    make_li("Drywall", 2000, "5/8 inch gypsum board", "walls"),
    make_li("Drywall", 2000, "tape and finish", "level 5"),
    make_li("Drywall", 100, "corner bead", "metal"),
    make_li("Drywall", 2000, "sanding and texture"),
])
if a: assemblies.append(a)

a = make_assembly("Painting Complete Assembly - 2000 SF", "Assemblies - Painting", [
    make_li("Painting", 2000, "primer", "interior"),
    make_li("Painting", 2000, "paint", "2 coats"),
    make_li("Painting", 2000, "trim painting", "walls"),
])
if a: assemblies.append(a)

a = make_assembly("Flooring Full Package - 1500 SF", "Assemblies - Flooring", [
    make_li("Flooring", 1500, "subfloor leveling", "per area"),
    make_li("Flooring", 1500, "engineered hardwood", "3/8 inch"),
    make_li("Flooring", 150, "quarter round trim"),
    make_li("Flooring", 150, "transition molding", "t-molding"),
])
if a: assemblies.append(a)

# ── Detailed Exterior Assemblies ─────────────────────────────────────
a = make_assembly("Deck Complete Assembly - 300 SF", "Assemblies - Exterior", [
    make_li("Deck", 4, "concrete footings", "12x12"),
    make_li("Deck", 4, "pressure treated posts", "6x6"),
    make_li("Deck", 300, "composite decking", "mid grade"),
    make_li("Deck", 60, "composite railing", "standard"),
    make_li("Deck", 1, "deck stairs", "4 steps"),
])
if a: assemblies.append(a)

a = make_assembly("Landscaping Full Package - 2000 SF", "Assemblies - Exterior", [
    make_li("Landscaping", 2000, "sod", "kentucky bluegrass"),
    make_li("Landscaping", 5, "trees", "maple"),
    make_li("Landscaping", 20, "shrubs", "various"),
    make_li("Hardscaping", 200, "paver patio", "concrete"),
    make_li("Hardscaping", 20, "landscape edging", "aluminum"),
    make_li("Landscaping", 10, "mulch", "cedar"),
])
if a: assemblies.append(a)

# ── End of detailed RS assemblies ─────────────────────────────────────


# ── Cabinetry ───────────────────────────────────────────────
a = make_assembly("Modern Kitchen Cabinetry & Quartz Package", "Assemblies - Interior", [
    make_li("Cabinetry",  8, "base cabinet", "24x34"),
    make_li("Cabinetry",  4, "base drawer cabinet"),
    make_li("Cabinetry", 10, "wall cabinet", "24x30"),
    make_li("Cabinetry",  1, "base sink cabinet"),
    make_li("Countertops", 60, "quartz countertop", "3cm"),
    make_li("Countertops",  1, "undermount", "cutout"),
    make_li("Hardware",   25, "cabinet pull", "install"),
])
if a: assemblies.append(a)

# ── Landscaping ──────────────────────────────────────────────
a = make_assembly("Front Yard Landscaping & Paver Path", "Assemblies - Exterior", [
    make_li("Landscaping", 2000, "kentucky bluegrass sod"),
    make_li("Landscaping",    2, "deciduous tree", "maple"),
    make_li("Landscaping",   10, "small shrub"),
    make_li("Hardscaping",  150, "concrete paver patio"),
    make_li("Landscaping",   10, "shredded cedar mulch"),
    make_li("Hardscaping",   20, "aluminum landscape edging"),
])
if a: assemblies.append(a)
def load_remodel_assemblies():
    import json
    from pathlib import Path
    path = Path(__file__).parent / "remodel_assemblies.json"
    if not path.is_file():
        return
    with open(path) as f:
        data = json.load(f)
    for entry in data:
        line_items = []
        for li in entry["lineItems"]:
            line_items.append(make_li(li["category"], li["quantity"], *li["keywords"]))
        a = make_assembly(entry["name"], entry["category"], line_items)
        if a:
            assemblies.append(a)
load_remodel_assemblies()
# ── Assembly agents (Bathroom, Kitchen, Basement) ─────────────
agent_assemblies = build_all_assembly_agent_assemblies(unique)
assemblies.extend(agent_assemblies)

print(f"  ✅ Built {len(assemblies)} assemblies  ({len(agent_assemblies)} from assembly agents)")
print()

# ─────────────────────────────────────────────────────────────
# STEP 6: OPTIMIZE ASSEMBLIES
# ─────────────────────────────────────────────────────────────
print("─── Step 6: AssemblyOptimizerAgent ─────────────────────────────────")
opt_log = []
for assy in assemblies:
    for li_item in assy["lineItems"]:
        qty  = li_item["quantity"]
        unit = unit_map.get(li_item["costBookItemId"], "")
        if qty >= 100.0:
            new_qty = math.ceil(qty * 1.10)
            opt_log.append(f"  🔧 {assy['name'][:55]}: qty {qty:.0f}→{new_qty} (+10% waste)")
            li_item["quantity"] = float(new_qty)
        elif unit == "LF":
            new_qty = math.ceil(qty * 1.05)
            if new_qty != int(qty):
                opt_log.append(f"  🔧 {assy['name'][:55]}: LF {qty:.0f}→{new_qty} (+5%)")
                li_item["quantity"] = float(new_qty)

print(f"  ✅ {len(opt_log)} quantity adjustments made.")
print()

# ─────────────────────────────────────────────────────────────
# STEP 7: PRICING SANITY CHECK
# ─────────────────────────────────────────────────────────────
print("─── Step 7: PricingSanityAgent ─────────────────────────────────────")
MIN_COST = {"SF": 0.05, "LF": 0.10, "EA": 0.25, "HR": 12.00, "CY": 8.00, "SQ": 5.00, "CF": 0.50}
MAX_LABOR_RATIO = 0.98

# Run 2 whitelist: pure-labor EA items that are legitimately 100% labor
LABOR_ONLY_KEYWORDS = {
    "inspection", "engineer", "permit", "per day", "per visit", "meeting",
    "report", "review", "consult", "test", "walk", "plan", "coordination",
    "photos", "documentation", "closeout", "manager", "superintendent",
    "foreman", "officer", "preparation", "processing", "photography",
    "cleanup", "clean", "general labor", "stack", "labor add-on",
    "hoa", "survey", "callback", "warranty", "rfi", "submittal", "safety",
    "oac", "subcontractor", "back charge", "change order", "zoning",
    "preconstruction", "kickoff", "hand stock", "load calculation", "engineering",
    "repair", "install", "design", "estimate", "bid", "scheduling", "permitting",
    "administration", "supervision", "project management", "technical writing",
    "drafting", "as-built", "audit", "punch list", "measurement", "trip",
    "estimator", "scheduler", "liaison", "rate",
}

sanity_ok, sanity_flags = [], []
for item in unique:
    total = item["laborCost"] + item["materialCost"] + item["equipmentCost"]
    unit  = item["unit"]
    name_lower = item["name"].lower()
    errors = []
    if total < MIN_COST.get(unit, 0.01):
        errors.append(f"Total {total:.2f} below min {MIN_COST.get(unit)} for {unit}")
    if total > 0 and item["laborCost"] / total > MAX_LABOR_RATIO:
        # whitelist pure-labor inspection/management items
        if not any(kw in name_lower for kw in LABOR_ONLY_KEYWORDS):
            errors.append(f"Labor ratio {item['laborCost']/total:.0%} suspicious")
    if errors:
        sanity_flags.append((item["name"], errors))
    else:
        sanity_ok.append(item)

print(f"  ✅ Passed: {len(sanity_ok)}  |  Flagged: {len(sanity_flags)}")
if sanity_flags:
    for name, errs in sanity_flags:
        print(f"  ⚠️  '{name}': {errs}")
print()

# ─────────────────────────────────────────────────────────────
# STEP 8: FORMAT AND EXPORT
# ─────────────────────────────────────────────────────────────
print("─── Step 8: ExportFormatterAgent ───────────────────────────────────")

def enforce_decimals(items):
    out = []
    for item in items:
        item = dict(item)
        # Rule Update: Serialize costs as 2-decimal strings (Run 1 compliance)
        item["laborCost"]     = f"{float(item['laborCost']):.2f}"
        item["materialCost"]  = f"{float(item['materialCost']):.2f}"
        item["equipmentCost"] = f"{float(item['equipmentCost']):.2f}"
        if item.get("notes") is None:
            item.pop("notes", None)
        out.append(item)
    return out

def enforce_assembly_decimals(assemblies):
    out = []
    for a in assemblies:
        a = dict(a)
        a["lineItems"] = [
            {
                "costBookItemId": li["costBookItemId"], 
                "quantity": f"{float(li['quantity']):.2f}"
            }
            for li in a["lineItems"]
        ]
        out.append(a)
    return out

payload = {
    "items": enforce_decimals(sanity_ok),
    "assemblies": enforce_assembly_decimals(assemblies)
}

# Phase B: anchored to the canonical package root (packages/knowledge-engine/), not to the
# invoking process's cwd. This is what makes output deterministic regardless of whether this
# script is run from the package root, from pipelines/, or from anywhere else -- see
# packages/knowledge-engine/PATHS.md. Historical stale output already on disk under
# pipelines/knowledge/cost-items/ and pipelines/exports/ (produced by earlier wrong-cwd runs
# of the old relative-path logic) is intentionally left untouched by this change.
knowledge_cost_items_dir = resolve_package_root() / "knowledge" / "cost-items"
export_json_dir = resolve_export_root() / "json"
os.makedirs(knowledge_cost_items_dir, exist_ok=True)
os.makedirs(export_json_dir, exist_ok=True)

knowledge_cost_items_path = knowledge_cost_items_dir / "costbook.json"
export_costbook_path = export_json_dir / "costbook.json"

with open(knowledge_cost_items_path, "w") as f:
    json.dump(payload, f, indent=2)
with open(export_costbook_path, "w") as f:
    json.dump(payload, f, indent=2)

print(f"  ✅ Exported {len(payload['items'])} items + {len(payload['assemblies'])} assemblies")
print(f"  Saved → {knowledge_cost_items_path}")
print(f"  Saved → {export_costbook_path}")
print()

# ─────────────────────────────────────────────────────────────
# STEP 9: LIVE PUBLISH (SYNC MANAGER)
# ─────────────────────────────────────────────────────────────
print("─── Step 9: SyncPublisherAgent [LIVE RELATIONAL] ───────────────────")
sync_mgr = RelationalSynchronizer(payload)
success = sync_mgr.sync()

if success:
    print(f"  ✅ Relational sync prepared for {len(payload['items'])} items + {len(payload['assemblies'])} assemblies")
else:
    print("  ❌ Sync failed.")
print()

# ─────────────────────────────────────────────────────────────
# STEP 10: FEEDBACK LOG
# ─────────────────────────────────────────────────────────────
print("─── Step 10: AgentFeedbackAgent ────────────────────────────────────")
by_trade = defaultdict(int)
for item in payload["items"]:
    by_trade[item["category"]] += 1

print("  📊 Final Item Counts by Trade:")
for trade, count in sorted(by_trade.items()):
    print(f"       {trade}: {count} items")

print(f"\n  📦 Assemblies:              {len(payload['assemblies'])}")
print(f"  🔁 Duplicates removed:      {len(dupes)}")
print(f"  ❌ Items rejected:           {len(rejected)}")
print(f"  ⚠️  Sanity flagged:          {len(sanity_flags)}")
print(f"  🔧 Assembly optimizations:  {len(opt_log)}")

print()
print("="*70)
print(f"  ✅  PIPELINE COMPLETE — {len(payload['items'])} items | {len(payload['assemblies'])} assemblies")
print("="*70)
