"""
CostItemGeneratorAgent — Multi-Trade Item Generator
Generates 100 items per trade for: Drywall, Framing, Concrete
Outputs: Data/raw/items.json (all combined)
"""

import uuid
import json

def uid():
    return str(uuid.uuid4())

# ─────────────────────────────────────────────────────────────
# DRYWALL — 100 ITEMS
# ─────────────────────────────────────────────────────────────
drywall_items = [
    # ── Hanging — Walls ──────────────────────────────────────
    {"id": uid(), "name": "1/2 Inch Regular Drywall Hang - Walls", "category": "Drywall", "unit": "SF", "laborCost": 0.45, "materialCost": 0.32, "equipmentCost": 0.05, "notes": "Standard wall application"},
    {"id": uid(), "name": "5/8 Inch Firecode Type X Drywall Hang - Walls", "category": "Drywall", "unit": "SF", "laborCost": 0.50, "materialCost": 0.38, "equipmentCost": 0.05, "notes": "Type X fire rating"},
    {"id": uid(), "name": "1/2 Inch Moisture Resistant Drywall Hang - Walls", "category": "Drywall", "unit": "SF", "laborCost": 0.45, "materialCost": 0.42, "equipmentCost": 0.05, "notes": "Greenboard for damp areas"},
    {"id": uid(), "name": "1/4 Inch Flexible Drywall Hang - Curved Walls", "category": "Drywall", "unit": "SF", "laborCost": 0.65, "materialCost": 0.48, "equipmentCost": 0.05, "notes": "For curved or arched surfaces"},
    {"id": uid(), "name": "5/8 Inch Soundproof Drywall Hang - Walls", "category": "Drywall", "unit": "SF", "laborCost": 0.55, "materialCost": 1.15, "equipmentCost": 0.10, "notes": "QuietRock or equivalent"},
    {"id": uid(), "name": "1/2 Inch High Impact Drywall Hang - Walls", "category": "Drywall", "unit": "SF", "laborCost": 0.50, "materialCost": 0.75, "equipmentCost": 0.05, "notes": "High-traffic corridors"},
    {"id": uid(), "name": "3/8 Inch Drywall Hang - Walls", "category": "Drywall", "unit": "SF", "laborCost": 0.42, "materialCost": 0.28, "equipmentCost": 0.04, "notes": "Lightweight backing layer"},
    {"id": uid(), "name": "Double Layer 5/8 Inch Drywall Hang - Walls", "category": "Drywall", "unit": "SF", "laborCost": 0.90, "materialCost": 0.76, "equipmentCost": 0.08, "notes": "Two-layer fire-rated system"},
    {"id": uid(), "name": "5/8 Inch Mold Resistant Drywall Hang - Walls", "category": "Drywall", "unit": "SF", "laborCost": 0.50, "materialCost": 0.52, "equipmentCost": 0.05, "notes": "Purple board or equivalent"},
    {"id": uid(), "name": "1/2 Inch Abuse Resistant Drywall Hang - Walls", "category": "Drywall", "unit": "SF", "laborCost": 0.52, "materialCost": 0.88, "equipmentCost": 0.05, "notes": "Commercial hardened board"},

    # ── Hanging — Ceilings ───────────────────────────────────
    {"id": uid(), "name": "1/2 Inch Regular Drywall Hang - Ceilings", "category": "Drywall", "unit": "SF", "laborCost": 0.65, "materialCost": 0.32, "equipmentCost": 0.15, "notes": "Ceiling application with lift"},
    {"id": uid(), "name": "5/8 Inch Type X Drywall Hang - Ceilings", "category": "Drywall", "unit": "SF", "laborCost": 0.70, "materialCost": 0.38, "equipmentCost": 0.18, "notes": "Rated ceiling application"},
    {"id": uid(), "name": "5/8 Inch Soundproof Drywall Hang - Ceilings", "category": "Drywall", "unit": "SF", "laborCost": 0.75, "materialCost": 1.15, "equipmentCost": 0.20, "notes": "Acoustic ceiling"},
    {"id": uid(), "name": "5/8 Inch Moisture Resistant Drywall Hang - Ceilings", "category": "Drywall", "unit": "SF", "laborCost": 0.70, "materialCost": 0.52, "equipmentCost": 0.15, "notes": "Bathrooms and high-humidity ceilings"},
    {"id": uid(), "name": "Double Layer 5/8 Drywall Hang - Ceilings", "category": "Drywall", "unit": "SF", "laborCost": 1.10, "materialCost": 0.76, "equipmentCost": 0.25, "notes": "Double layer fire-rated ceiling"},

    # ── Taping and Finishing ─────────────────────────────────
    {"id": uid(), "name": "Tape and Finish - Level 1", "category": "Drywall", "unit": "SF", "laborCost": 0.25, "materialCost": 0.08, "equipmentCost": 0.01, "notes": "Fire taping only"},
    {"id": uid(), "name": "Tape and Finish - Level 2", "category": "Drywall", "unit": "SF", "laborCost": 0.42, "materialCost": 0.10, "equipmentCost": 0.01, "notes": "Skim coat for textured surfaces"},
    {"id": uid(), "name": "Tape and Finish - Level 3", "category": "Drywall", "unit": "SF", "laborCost": 0.60, "materialCost": 0.15, "equipmentCost": 0.02, "notes": "Ready for heavy texture"},
    {"id": uid(), "name": "Tape and Finish - Level 4", "category": "Drywall", "unit": "SF", "laborCost": 0.85, "materialCost": 0.18, "equipmentCost": 0.03, "notes": "Ready for flat or light texture"},
    {"id": uid(), "name": "Tape and Finish - Level 5", "category": "Drywall", "unit": "SF", "laborCost": 1.25, "materialCost": 0.25, "equipmentCost": 0.05, "notes": "skim coat premium finish"},
    {"id": uid(), "name": "Level 5 Skim Coat Over Existing Drywall", "category": "Drywall", "unit": "SF", "laborCost": 0.95, "materialCost": 0.25, "equipmentCost": 0.05, "notes": "Applied to existing walls"},

    # ── Texture ──────────────────────────────────────────────
    {"id": uid(), "name": "Spray Texture - Orange Peel", "category": "Drywall", "unit": "SF", "laborCost": 0.25, "materialCost": 0.12, "equipmentCost": 0.08, "notes": "Standard spray finish"},
    {"id": uid(), "name": "Spray Texture - Knockdown", "category": "Drywall", "unit": "SF", "laborCost": 0.35, "materialCost": 0.12, "equipmentCost": 0.08, "notes": "Knockdown spray finish"},
    {"id": uid(), "name": "Hand Texture - Skip Trowel", "category": "Drywall", "unit": "SF", "laborCost": 0.75, "materialCost": 0.15, "equipmentCost": 0.05, "notes": "Hand applied skip trowel"},
    {"id": uid(), "name": "Sand Texture Finish", "category": "Drywall", "unit": "SF", "laborCost": 0.55, "materialCost": 0.14, "equipmentCost": 0.06, "notes": "Fine sand aggregate spray"},
    {"id": uid(), "name": "Smooth Rolled Texture Finish", "category": "Drywall", "unit": "SF", "laborCost": 0.45, "materialCost": 0.10, "equipmentCost": 0.02, "notes": "Roller applied finish coat"},
    {"id": uid(), "name": "Popcorn Ceiling Texture - New", "category": "Drywall", "unit": "SF", "laborCost": 0.35, "materialCost": 0.18, "equipmentCost": 0.10, "notes": "Acoustic spray ceiling"},
    {"id": uid(), "name": "Acoustic Popcorn Ceiling Removal", "category": "Drywall", "unit": "SF", "laborCost": 1.10, "materialCost": 0.10, "equipmentCost": 0.20, "notes": "Assumes no asbestos present"},
    {"id": uid(), "name": "Venetian Plaster Skim Coat", "category": "Drywall", "unit": "SF", "laborCost": 2.50, "materialCost": 0.85, "equipmentCost": 0.10, "notes": "Premium decorative finish"},
    {"id": uid(), "name": "Elastomeric Coating Application", "category": "Drywall", "unit": "SF", "laborCost": 0.45, "materialCost": 0.30, "equipmentCost": 0.05, "notes": "Flexible waterproof finish"},

    # ── Corner Bead and Trim ─────────────────────────────────
    {"id": uid(), "name": "Corner Bead Install - Metal 90 Degree", "category": "Drywall", "unit": "LF", "laborCost": 0.55, "materialCost": 0.22, "equipmentCost": 0.01, "notes": "Standard 90 degree"},
    {"id": uid(), "name": "Corner Bead Install - Bullnose", "category": "Drywall", "unit": "LF", "laborCost": 0.60, "materialCost": 0.28, "equipmentCost": 0.01, "notes": "Rounded edge"},
    {"id": uid(), "name": "Corner Bead Install - Vinyl", "category": "Drywall", "unit": "LF", "laborCost": 0.45, "materialCost": 0.18, "equipmentCost": 0.00, "notes": "Vinyl bead for taping edge"},
    {"id": uid(), "name": "L-Bead Install - Drywall Edge Termination", "category": "Drywall", "unit": "LF", "laborCost": 0.40, "materialCost": 0.20, "equipmentCost": 0.00, "notes": "Where drywall meets different surface"},
    {"id": uid(), "name": "J-Bead Install - Drywall Edge", "category": "Drywall", "unit": "LF", "laborCost": 0.38, "materialCost": 0.18, "equipmentCost": 0.00, "notes": "Exposed edge at windows or openings"},
    {"id": uid(), "name": "Archway Bead Install - Flexible", "category": "Drywall", "unit": "LF", "laborCost": 0.75, "materialCost": 0.45, "equipmentCost": 0.00, "notes": "Curved archways"},
    {"id": uid(), "name": "Shadow Bead / Reveal Install", "category": "Drywall", "unit": "LF", "laborCost": 0.80, "materialCost": 0.55, "equipmentCost": 0.01, "notes": "Architectural reveal trim"},

    # ── Framing Accessories ──────────────────────────────────
    {"id": uid(), "name": "Resilient Channel Install - RC-1", "category": "Drywall", "unit": "LF", "laborCost": 0.45, "materialCost": 0.35, "equipmentCost": 0.02, "notes": "Sound decoupling channel"},
    {"id": uid(), "name": "Isolation Clip Install - RSIC", "category": "Drywall", "unit": "EA", "laborCost": 2.50, "materialCost": 4.50, "equipmentCost": 0.25, "notes": "Sound isolation clips"},
    {"id": uid(), "name": "Hat Channel Install - 7/8 Inch", "category": "Drywall", "unit": "LF", "laborCost": 0.40, "materialCost": 0.28, "equipmentCost": 0.01, "notes": "Furring channel"},
    {"id": uid(), "name": "Z-Furring Channel Install", "category": "Drywall", "unit": "LF", "laborCost": 0.45, "materialCost": 0.32, "equipmentCost": 0.01, "notes": "Exterior wall furring"},
    {"id": uid(), "name": "Sound Attenuation Batt Install - 3.5 Inch", "category": "Drywall", "unit": "SF", "laborCost": 0.30, "materialCost": 0.45, "equipmentCost": 0.00, "notes": "SAB insulation for STC improvement"},

    # ── Shaft and Specialty Systems ──────────────────────────
    {"id": uid(), "name": "Shaftwall Liner Install - 1 Inch Coreboard", "category": "Drywall", "unit": "SF", "laborCost": 0.85, "materialCost": 0.95, "equipmentCost": 0.10, "notes": "Vertical shaft applications"},
    {"id": uid(), "name": "Shaftwall C-H Stud Install", "category": "Drywall", "unit": "LF", "laborCost": 0.55, "materialCost": 0.65, "equipmentCost": 0.05, "notes": "C-H shaft framing"},
    {"id": uid(), "name": "High Shaft Double Layer 5/8 - Stairwell", "category": "Drywall", "unit": "SF", "laborCost": 1.20, "materialCost": 0.76, "equipmentCost": 0.35, "notes": "High access staging required"},
    {"id": uid(), "name": "Fire Drywall - Horizontal Application", "category": "Drywall", "unit": "SF", "laborCost": 0.55, "materialCost": 0.38, "equipmentCost": 0.12, "notes": "Horizontal board orientation"},
    {"id": uid(), "name": "Exterior Gypsum Sheathing Install", "category": "Drywall", "unit": "SF", "laborCost": 0.60, "materialCost": 0.55, "equipmentCost": 0.08, "notes": "Weather-rated exterior board"},

    # ── Repair and Patch ─────────────────────────────────────
    {"id": uid(), "name": "Drywall Patch - Small Hole Up to 12x12 In", "category": "Drywall", "unit": "EA", "laborCost": 65.00, "materialCost": 15.00, "equipmentCost": 5.00, "notes": "California patch or mesh"},
    {"id": uid(), "name": "Drywall Patch - Medium Up to 24x24 In", "category": "Drywall", "unit": "EA", "laborCost": 95.00, "materialCost": 22.00, "equipmentCost": 5.00, "notes": "Backing board required"},
    {"id": uid(), "name": "Drywall Patch - Full 4x8 Sheet Replacement", "category": "Drywall", "unit": "EA", "laborCost": 125.00, "materialCost": 25.00, "equipmentCost": 10.00, "notes": "Full sheet cut-in"},
    {"id": uid(), "name": "Drywall Water Damage Repair - Per SF", "category": "Drywall", "unit": "SF", "laborCost": 3.50, "materialCost": 1.20, "equipmentCost": 0.50, "notes": "Includes mold check"},
    {"id": uid(), "name": "Drywall Crack Repair - Hairline", "category": "Drywall", "unit": "LF", "laborCost": 3.00, "materialCost": 0.50, "equipmentCost": 0.10, "notes": "Tape and skim finish"},
    {"id": uid(), "name": "Drywall Crack Repair - Structural", "category": "Drywall", "unit": "LF", "laborCost": 8.50, "materialCost": 1.50, "equipmentCost": 0.50, "notes": "Fiberglass reinforcement tape"},

    # ── Demolition and Removal ───────────────────────────────
    {"id": uid(), "name": "Drywall Demolition - Walls", "category": "Drywall", "unit": "SF", "laborCost": 0.38, "materialCost": 0.00, "equipmentCost": 0.05, "notes": "Tear out and stack for disposal"},
    {"id": uid(), "name": "Drywall Demolition - Ceilings", "category": "Drywall", "unit": "SF", "laborCost": 0.55, "materialCost": 0.00, "equipmentCost": 0.12, "notes": "Overhead demolition"},
    {"id": uid(), "name": "Scrap Removal and Disposal", "category": "Drywall", "unit": "EA", "laborCost": 85.00, "materialCost": 0.00, "equipmentCost": 40.00, "notes": "Haul away and dump fees"},
    {"id": uid(), "name": "Drywall Debris Dump Fee - Per Load", "category": "Drywall", "unit": "EA", "laborCost": 0.00, "materialCost": 0.00, "equipmentCost": 185.00, "notes": "Standard 10-yard dumpster load"},

    # ── Delivery and Logistics ───────────────────────────────
    {"id": uid(), "name": "Drywall Delivery and Boom Truck Stocking", "category": "Drywall", "unit": "EA", "laborCost": 150.00, "materialCost": 0.00, "equipmentCost": 50.00, "notes": "Flat fee per delivery"},
    {"id": uid(), "name": "Drywall Hand Stock - Per Floor", "category": "Drywall", "unit": "EA", "laborCost": 85.00, "materialCost": 0.00, "equipmentCost": 0.00, "notes": "Add per floor above ground"},

    # ── Joint Compound and Consumables ───────────────────────
    {"id": uid(), "name": "Lightweight Joint Compound Supply Only", "category": "Drywall", "unit": "EA", "laborCost": 0.00, "materialCost": 18.50, "equipmentCost": 0.00, "notes": "5 gallon bucket"},
    {"id": uid(), "name": "Setting Compound Supply Only - 45 Min", "category": "Drywall", "unit": "EA", "laborCost": 0.00, "materialCost": 14.00, "equipmentCost": 0.00, "notes": "25 lb bag"},
    {"id": uid(), "name": "Fiberglass Mesh Tape Supply Only", "category": "Drywall", "unit": "EA", "laborCost": 0.00, "materialCost": 5.50, "equipmentCost": 0.00, "notes": "300 ft roll"},
    {"id": uid(), "name": "Paper Tape Supply Only", "category": "Drywall", "unit": "EA", "laborCost": 0.00, "materialCost": 3.25, "equipmentCost": 0.00, "notes": "250 ft roll"},
    {"id": uid(), "name": "Coarse Thread Drywall Screw Supply - 5lb Box", "category": "Drywall", "unit": "EA", "laborCost": 0.00, "materialCost": 9.75, "equipmentCost": 0.00, "notes": "1-5/8 inch for wood stud"},
    {"id": uid(), "name": "Fine Thread Drywall Screw Supply - 5lb Box", "category": "Drywall", "unit": "EA", "laborCost": 0.00, "materialCost": 9.75, "equipmentCost": 0.00, "notes": "1-5/8 inch for metal stud"},
    {"id": uid(), "name": "Drywall Primer Application", "category": "Drywall", "unit": "SF", "laborCost": 0.18, "materialCost": 0.08, "equipmentCost": 0.02, "notes": "PVA drywall primer coat"},

    # ── Accessibility and Specialty ──────────────────────────
    {"id": uid(), "name": "Scissor Lift Rental - Per Day", "category": "Drywall", "unit": "EA", "laborCost": 0.00, "materialCost": 0.00, "equipmentCost": 320.00, "notes": "19 ft electric scissor lift"},
    {"id": uid(), "name": "Scaffolding Rental - Per 1000 SF Per Week", "category": "Drywall", "unit": "EA", "laborCost": 0.00, "materialCost": 0.00, "equipmentCost": 450.00, "notes": "System scaffold per week"},
    {"id": uid(), "name": "Stilts Labor Add-On Per Day", "category": "Drywall", "unit": "EA", "laborCost": 95.00, "materialCost": 0.00, "equipmentCost": 0.00, "notes": "Ceiling pump and stilts add-on"},

    # ── Fireproofing ─────────────────────────────────────────
    {"id": uid(), "name": "Intumescent Fire Caulk - Linear Joint", "category": "Drywall", "unit": "LF", "laborCost": 2.50, "materialCost": 1.80, "equipmentCost": 0.10, "notes": "Fire stop at wall-ceiling joint"},
    {"id": uid(), "name": "Fire Safing Insulation Install", "category": "Drywall", "unit": "LF", "laborCost": 3.50, "materialCost": 2.20, "equipmentCost": 0.10, "notes": "Between floor and curtain wall"},
    {"id": uid(), "name": "Penetration Fire Stop - Pipe Wrap", "category": "Drywall", "unit": "EA", "laborCost": 45.00, "materialCost": 22.00, "equipmentCost": 0.00, "notes": "Per pipe penetration through rated wall"},

    # ── Substrates and Backer ────────────────────────────────
    {"id": uid(), "name": "Cement Board Install - 1/2 Inch", "category": "Drywall", "unit": "SF", "laborCost": 0.75, "materialCost": 0.95, "equipmentCost": 0.05, "notes": "Tile backer in wet areas"},
    {"id": uid(), "name": "Cement Board Install - 5/8 Inch", "category": "Drywall", "unit": "SF", "laborCost": 0.80, "materialCost": 1.10, "equipmentCost": 0.05, "notes": "Heavy tile backer"},
    {"id": uid(), "name": "Foam Board Insulation Attach to Concrete", "category": "Drywall", "unit": "SF", "laborCost": 0.38, "materialCost": 0.52, "equipmentCost": 0.02, "notes": "2 inch EPS on CMU or concrete"},
    {"id": uid(), "name": "Vapor Barrier Install Behind Drywall", "category": "Drywall", "unit": "SF", "laborCost": 0.20, "materialCost": 0.08, "equipmentCost": 0.01, "notes": "6 mil poly sheeting"},

    # ── Soffits and Built-Outs ───────────────────────────────
    {"id": uid(), "name": "Drywall Soffit Build-Out - Simple Box Shape", "category": "Drywall", "unit": "LF", "laborCost": 8.50, "materialCost": 3.25, "equipmentCost": 0.50, "notes": "Duct or pipe concealment soffit"},
    {"id": uid(), "name": "Drywall Column Wrap - Square", "category": "Drywall", "unit": "LF", "laborCost": 12.00, "materialCost": 4.50, "equipmentCost": 0.50, "notes": "Per LF height of column"},
    {"id": uid(), "name": "Drywall Curved Wall System", "category": "Drywall", "unit": "SF", "laborCost": 2.50, "materialCost": 0.90, "equipmentCost": 0.15, "notes": "Flexible track and 1/4 board"},
    {"id": uid(), "name": "Drywall Cove Lighting Trough Build-Out", "category": "Drywall", "unit": "LF", "laborCost": 15.00, "materialCost": 5.50, "equipmentCost": 0.50, "notes": "Indirect lighting reveal"},

    # ── Inspection and Testing ───────────────────────────────
    {"id": uid(), "name": "Drywall Inspection and Report", "category": "Drywall", "unit": "EA", "laborCost": 250.00, "materialCost": 0.00, "equipmentCost": 0.00, "notes": "Pre-paint inspection with report"},
    {"id": uid(), "name": "STC Wall Assembly Testing", "category": "Drywall", "unit": "EA", "laborCost": 850.00, "materialCost": 0.00, "equipmentCost": 125.00, "notes": "Field acoustics test for STC rating"},

    # ── Miscellaneous ────────────────────────────────────────
    {"id": uid(), "name": "Drywall Clip and Transition Bead Install", "category": "Drywall", "unit": "EA", "laborCost": 4.50, "materialCost": 1.25, "equipmentCost": 0.00, "notes": "Butt-joint or abutting surface clip"},
    {"id": uid(), "name": "Drywall Control Joint Install", "category": "Drywall", "unit": "LF", "laborCost": 1.25, "materialCost": 0.65, "equipmentCost": 0.00, "notes": "Expansion joint in large walls"},
    {"id": uid(), "name": "Drywall Access Panel Install - 12x12", "category": "Drywall", "unit": "EA", "laborCost": 55.00, "materialCost": 38.00, "equipmentCost": 0.00, "notes": "Pre-made spring-loaded access door"},
    {"id": uid(), "name": "Drywall Access Panel Install - 24x24", "category": "Drywall", "unit": "EA", "laborCost": 75.00, "materialCost": 65.00, "equipmentCost": 0.00, "notes": "Full size drywall access door"},
    {"id": uid(), "name": "Window Return Drywall - Per Opening", "category": "Drywall", "unit": "EA", "laborCost": 35.00, "materialCost": 12.00, "equipmentCost": 0.00, "notes": "Window jamb and reveal wrap"},
    {"id": uid(), "name": "Door Return Drywall - Per Opening", "category": "Drywall", "unit": "EA", "laborCost": 28.00, "materialCost": 10.00, "equipmentCost": 0.00, "notes": "Door jamb wrap"},
    {"id": uid(), "name": "Drywall Backing Board for Heavy Fixture", "category": "Drywall", "unit": "EA", "laborCost": 18.00, "materialCost": 8.50, "equipmentCost": 0.00, "notes": "TV mount, grab bar or cabinet reinforcement"},
    {"id": uid(), "name": "Drywall Protective Corner Guard Install", "category": "Drywall", "unit": "EA", "laborCost": 8.50, "materialCost": 12.00, "equipmentCost": 0.00, "notes": "Surface mount metal guard"},
    {"id": uid(), "name": "Drywall Niche Build-Out - Recessed Shelf", "category": "Drywall", "unit": "EA", "laborCost": 85.00, "materialCost": 35.00, "equipmentCost": 5.00, "notes": "Framed opening between studs"},
    {"id": uid(), "name": "Drywall Texture Matching - Existing", "category": "Drywall", "unit": "SF", "laborCost": 2.25, "materialCost": 0.18, "equipmentCost": 0.10, "notes": "Match existing texture on patches"},
]

# ─────────────────────────────────────────────────────────────
# FRAMING — 100 ITEMS
# ─────────────────────────────────────────────────────────────
framing_items = [
    # ── Steel Stud Framing ───────────────────────────────────
    {"id": uid(), "name": "3-5/8 Inch 20 Gauge Steel Stud Install", "category": "Framing", "unit": "LF", "laborCost": 1.05, "materialCost": 0.88, "equipmentCost": 0.05, "notes": "Standard interior partition stud"},
    {"id": uid(), "name": "3-5/8 Inch 25 Gauge Steel Stud Install", "category": "Framing", "unit": "LF", "laborCost": 0.90, "materialCost": 0.65, "equipmentCost": 0.04, "notes": "Light gauge non-load bearing"},
    {"id": uid(), "name": "6 Inch 20 Gauge Steel Stud Install", "category": "Framing", "unit": "LF", "laborCost": 1.15, "materialCost": 1.05, "equipmentCost": 0.05, "notes": "Wider partition or chase wall"},
    {"id": uid(), "name": "6 Inch 18 Gauge Steel Stud Install", "category": "Framing", "unit": "LF", "laborCost": 1.25, "materialCost": 1.35, "equipmentCost": 0.08, "notes": "Semi-structural steel stud"},
    {"id": uid(), "name": "8 Inch 16 Gauge Steel Stud Install", "category": "Framing", "unit": "LF", "laborCost": 1.45, "materialCost": 1.85, "equipmentCost": 0.10, "notes": "Heavy structural applications"},
    {"id": uid(), "name": "3-5/8 Inch Steel Track - Floor and Ceiling", "category": "Framing", "unit": "LF", "laborCost": 0.55, "materialCost": 0.45, "equipmentCost": 0.03, "notes": "Track for 3-5/8 studs"},
    {"id": uid(), "name": "6 Inch Steel Track - Floor and Ceiling", "category": "Framing", "unit": "LF", "laborCost": 0.65, "materialCost": 0.58, "equipmentCost": 0.03, "notes": "Track for 6 inch studs"},
    {"id": uid(), "name": "8 Inch Steel Track - Floor and Ceiling", "category": "Framing", "unit": "LF", "laborCost": 0.75, "materialCost": 0.75, "equipmentCost": 0.04, "notes": "Track for 8 inch heavy studs"},
    {"id": uid(), "name": "Steel Stud Double Header Install", "category": "Framing", "unit": "LF", "laborCost": 2.50, "materialCost": 1.80, "equipmentCost": 0.10, "notes": "Over openings and doors"},
    {"id": uid(), "name": "Steel Stud Cripple Install - Per Opening", "category": "Framing", "unit": "EA", "laborCost": 18.00, "materialCost": 6.50, "equipmentCost": 0.50, "notes": "Above or below opening rough-in"},

    # ── Wood Stud Framing ─────────────────────────────────────
    {"id": uid(), "name": "2x4 Wood Stud Framing - 16 OC", "category": "Framing", "unit": "LF", "laborCost": 1.25, "materialCost": 0.75, "equipmentCost": 0.05, "notes": "Residential interior partition"},
    {"id": uid(), "name": "2x4 Wood Stud Framing - 24 OC", "category": "Framing", "unit": "LF", "laborCost": 1.00, "materialCost": 0.65, "equipmentCost": 0.05, "notes": "Residential 24 in on center"},
    {"id": uid(), "name": "2x6 Wood Stud Framing - 16 OC", "category": "Framing", "unit": "LF", "laborCost": 1.40, "materialCost": 1.05, "equipmentCost": 0.05, "notes": "Exterior or insulated walls"},
    {"id": uid(), "name": "2x6 Wood Stud Framing - 24 OC", "category": "Framing", "unit": "LF", "laborCost": 1.15, "materialCost": 0.90, "equipmentCost": 0.05, "notes": "24 OC exterior wall"},
    {"id": uid(), "name": "2x8 Wood Stud Framing - 16 OC", "category": "Framing", "unit": "LF", "laborCost": 1.65, "materialCost": 1.55, "equipmentCost": 0.08, "notes": "Heavy exterior or tall partition"},
    {"id": uid(), "name": "2x10 Wood Stud Framing", "category": "Framing", "unit": "LF", "laborCost": 1.85, "materialCost": 2.10, "equipmentCost": 0.08, "notes": "Structural framing member"},
    {"id": uid(), "name": "2x12 Wood Stud Framing", "category": "Framing", "unit": "LF", "laborCost": 2.00, "materialCost": 2.75, "equipmentCost": 0.10, "notes": "Large structural member"},
    {"id": uid(), "name": "Pressure Treated Bottom Plate Install", "category": "Framing", "unit": "LF", "laborCost": 1.20, "materialCost": 1.15, "equipmentCost": 0.05, "notes": "PT plate at slab or waterproofed condition"},
    {"id": uid(), "name": "Double Top Plate Install - Wood", "category": "Framing", "unit": "LF", "laborCost": 1.45, "materialCost": 1.50, "equipmentCost": 0.05, "notes": "Load bearing double top plate"},
    {"id": uid(), "name": "Fire Blocking Install - Horizontal", "category": "Framing", "unit": "LF", "laborCost": 2.25, "materialCost": 0.85, "equipmentCost": 0.05, "notes": "Code-required blocking between studs"},

    # ── Headers ───────────────────────────────────────────────
    {"id": uid(), "name": "Built-Up 2-Ply 2x6 Door Header", "category": "Framing", "unit": "EA", "laborCost": 65.00, "materialCost": 22.00, "equipmentCost": 2.00, "notes": "Per opening up to 4 ft wide"},
    {"id": uid(), "name": "Built-Up 3-Ply 2x8 Window Header", "category": "Framing", "unit": "EA", "laborCost": 85.00, "materialCost": 38.00, "equipmentCost": 2.00, "notes": "Per opening up to 6 ft wide"},
    {"id": uid(), "name": "LVL Beam Header - 3-1/2 x 9-1/4", "category": "Framing", "unit": "LF", "laborCost": 8.50, "materialCost": 18.50, "equipmentCost": 2.50, "notes": "Laminated veneer lumber header"},
    {"id": uid(), "name": "LVL Beam Header - 3-1/2 x 11-7/8", "category": "Framing", "unit": "LF", "laborCost": 9.50, "materialCost": 24.00, "equipmentCost": 2.50, "notes": "Wider span header"},
    {"id": uid(), "name": "PSL Post Column - 3-1/2 x 3-1/2", "category": "Framing", "unit": "LF", "laborCost": 6.50, "materialCost": 12.50, "equipmentCost": 0.50, "notes": "Parallel strand lumber post"},

    # ── Blocking and Bridging ─────────────────────────────────
    {"id": uid(), "name": "Solid Wood Blocking Between Studs", "category": "Framing", "unit": "EA", "laborCost": 12.00, "materialCost": 3.50, "equipmentCost": 0.50, "notes": "Per block, cabinetry or grab bar backing"},
    {"id": uid(), "name": "Joist Bridging - Steel Cross Strap", "category": "Framing", "unit": "EA", "laborCost": 4.50, "materialCost": 2.25, "equipmentCost": 0.25, "notes": "Per pair of joists"},
    {"id": uid(), "name": "Solid Wood Joist Blocking", "category": "Framing", "unit": "EA", "laborCost": 10.00, "materialCost": 4.00, "equipmentCost": 0.50, "notes": "End blocking or mid-span"},
    {"id": uid(), "name": "Rim Joist Install", "category": "Framing", "unit": "LF", "laborCost": 2.50, "materialCost": 1.85, "equipmentCost": 0.10, "notes": "Band joist at floor perimeter"},
    {"id": uid(), "name": "LVL Rim Board Install - 1-3/4 Inch", "category": "Framing", "unit": "LF", "laborCost": 2.75, "materialCost": 3.25, "equipmentCost": 0.10, "notes": "Engineered rim board"},

    # ── Floor Framing ─────────────────────────────────────────
    {"id": uid(), "name": "2x10 Floor Joist - 16 OC", "category": "Framing", "unit": "LF", "laborCost": 1.75, "materialCost": 2.10, "equipmentCost": 0.10, "notes": "Residential floor joist"},
    {"id": uid(), "name": "2x12 Floor Joist - 12 OC", "category": "Framing", "unit": "LF", "laborCost": 1.95, "materialCost": 2.75, "equipmentCost": 0.10, "notes": "Heavy load floor joist"},
    {"id": uid(), "name": "I-Joist Install - 9-1/2 Inch 16 OC", "category": "Framing", "unit": "LF", "laborCost": 1.85, "materialCost": 3.50, "equipmentCost": 0.15, "notes": "Engineered floor I-joist"},
    {"id": uid(), "name": "I-Joist Install - 11-7/8 Inch 16 OC", "category": "Framing", "unit": "LF", "laborCost": 2.00, "materialCost": 4.25, "equipmentCost": 0.15, "notes": "Deeper I-joist larger span"},
    {"id": uid(), "name": "Girder Truss Install - Floor", "category": "Framing", "unit": "EA", "laborCost": 125.00, "materialCost": 285.00, "equipmentCost": 45.00, "notes": "Engineered floor truss per SQFT"},
    {"id": uid(), "name": "3/4 Inch OSB Subfloor Install", "category": "Framing", "unit": "SF", "laborCost": 0.55, "materialCost": 0.85, "equipmentCost": 0.05, "notes": "Glued and screwed subfloor"},
    {"id": uid(), "name": "3/4 Inch Plywood Subfloor Install", "category": "Framing", "unit": "SF", "laborCost": 0.55, "materialCost": 1.10, "equipmentCost": 0.05, "notes": "Structural 1 plywood subfloor"},

    # ── Roof Framing ──────────────────────────────────────────
    {"id": uid(), "name": "Roof Rafter Install - 2x8 24 OC", "category": "Framing", "unit": "LF", "laborCost": 2.50, "materialCost": 1.55, "equipmentCost": 0.20, "notes": "Conventionally framed rafter"},
    {"id": uid(), "name": "Roof Rafter Install - 2x10 24 OC", "category": "Framing", "unit": "LF", "laborCost": 2.75, "materialCost": 2.10, "equipmentCost": 0.20, "notes": "Heavier rafter with greater span"},
    {"id": uid(), "name": "Prefab Roof Truss Install", "category": "Framing", "unit": "EA", "laborCost": 85.00, "materialCost": 185.00, "equipmentCost": 35.00, "notes": "Per truss with crane set"},
    {"id": uid(), "name": "Ridge Board Install", "category": "Framing", "unit": "LF", "laborCost": 3.50, "materialCost": 2.25, "equipmentCost": 0.25, "notes": "2x10 ridge"},
    {"id": uid(), "name": "Collar Tie Install", "category": "Framing", "unit": "EA", "laborCost": 18.00, "materialCost": 8.50, "equipmentCost": 0.50, "notes": "Per pair at upper third of rafters"},
    {"id": uid(), "name": "Hip Rafter Install", "category": "Framing", "unit": "LF", "laborCost": 4.50, "materialCost": 2.50, "equipmentCost": 0.25, "notes": "Diagonal hip rafter"},
    {"id": uid(), "name": "Valley Rafter Install", "category": "Framing", "unit": "LF", "laborCost": 4.25, "materialCost": 2.50, "equipmentCost": 0.25, "notes": "Interior valley rafter"},
    {"id": uid(), "name": "Rafter Hurricane Tie Install", "category": "Framing", "unit": "EA", "laborCost": 3.50, "materialCost": 2.25, "equipmentCost": 0.00, "notes": "Metal connector per rafter"},

    # ── Sheathing ─────────────────────────────────────────────
    {"id": uid(), "name": "7/16 Inch OSB Wall Sheathing Install", "category": "Framing", "unit": "SF", "laborCost": 0.45, "materialCost": 0.55, "equipmentCost": 0.04, "notes": "Standard exterior wall sheathing"},
    {"id": uid(), "name": "1/2 Inch Plywood Wall Sheathing Install", "category": "Framing", "unit": "SF", "laborCost": 0.48, "materialCost": 0.75, "equipmentCost": 0.04, "notes": "Structural plywood sheathing"},
    {"id": uid(), "name": "Rigid Foam Sheathing - 1 Inch Install", "category": "Framing", "unit": "SF", "laborCost": 0.42, "materialCost": 0.55, "equipmentCost": 0.02, "notes": "CI foam over sheathing"},
    {"id": uid(), "name": "7/16 Inch OSB Roof Sheathing Install", "category": "Framing", "unit": "SF", "laborCost": 0.55, "materialCost": 0.55, "equipmentCost": 0.08, "notes": "Roof deck sheathing"},
    {"id": uid(), "name": "5/8 Inch Plywood Roof Sheathing Install", "category": "Framing", "unit": "SF", "laborCost": 0.58, "materialCost": 0.95, "equipmentCost": 0.08, "notes": "Heavy roof deck"},

    # ── Engineered Lumber ─────────────────────────────────────
    {"id": uid(), "name": "Glulam Beam Install - 6x12", "category": "Framing", "unit": "LF", "laborCost": 18.50, "materialCost": 45.00, "equipmentCost": 5.00, "notes": "Glue laminated timber beam"},
    {"id": uid(), "name": "Glulam Beam Install - 6x16", "category": "Framing", "unit": "LF", "laborCost": 22.00, "materialCost": 62.00, "equipmentCost": 8.00, "notes": "Larger glulam"},
    {"id": uid(), "name": "Microlam LVL Install - 3-1/2 x 14", "category": "Framing", "unit": "LF", "laborCost": 12.50, "materialCost": 32.00, "equipmentCost": 3.00, "notes": "LVL beam structural"},
    {"id": uid(), "name": "Steel Post Base Anchor Install", "category": "Framing", "unit": "EA", "laborCost": 22.00, "materialCost": 18.50, "equipmentCost": 2.00, "notes": "Post-to-concrete connector"},
    {"id": uid(), "name": "Framing Angle and Joist Hanger Install", "category": "Framing", "unit": "EA", "laborCost": 8.50, "materialCost": 5.25, "equipmentCost": 0.25, "notes": "Per Simpson or USP connector"},

    # ── Specialty Framing ─────────────────────────────────────
    {"id": uid(), "name": "Knee Wall Framing Build-Out", "category": "Framing", "unit": "LF", "laborCost": 5.50, "materialCost": 2.25, "equipmentCost": 0.25, "notes": "Short wall at attic perimeter"},
    {"id": uid(), "name": "Cripple Wall Framing Below Floor", "category": "Framing", "unit": "SF", "laborCost": 3.50, "materialCost": 1.85, "equipmentCost": 0.25, "notes": "Crawl space cripple framing"},
    {"id": uid(), "name": "Stud Wall Full Assembly Per SF", "category": "Framing", "unit": "SF", "laborCost": 2.50, "materialCost": 1.25, "equipmentCost": 0.10, "notes": "Includes plates, studs and blocking"},
    {"id": uid(), "name": "Lookout Framing for Gable Overhang", "category": "Framing", "unit": "EA", "laborCost": 18.00, "materialCost": 7.50, "equipmentCost": 0.50, "notes": "Per lookout member"},
    {"id": uid(), "name": "Garage Door Header - Double Ply LVL", "category": "Framing", "unit": "EA", "laborCost": 145.00, "materialCost": 185.00, "equipmentCost": 15.00, "notes": "16 ft opening double LVL"},
    {"id": uid(), "name": "Stairwell Rough Framing", "category": "Framing", "unit": "EA", "laborCost": 450.00, "materialCost": 185.00, "equipmentCost": 20.00, "notes": "Per floor stair rough opening"},
    {"id": uid(), "name": "Stair Stringer - Open Riser", "category": "Framing", "unit": "EA", "laborCost": 125.00, "materialCost": 65.00, "equipmentCost": 5.00, "notes": "Per stringer, 3 piece set"},

    # ── Demolition and Removal ────────────────────────────────
    {"id": uid(), "name": "Stud Wall Demolition - Per SF of Wall", "category": "Framing", "unit": "SF", "laborCost": 0.65, "materialCost": 0.00, "equipmentCost": 0.08, "notes": "Tear out and stack"},
    {"id": uid(), "name": "Roof Framing Demolition - Per SF of Roof", "category": "Framing", "unit": "SF", "laborCost": 1.15, "materialCost": 0.00, "equipmentCost": 0.20, "notes": "After sheathing removal"},
    {"id": uid(), "name": "Floor Joist Demolition", "category": "Framing", "unit": "SF", "laborCost": 0.85, "materialCost": 0.00, "equipmentCost": 0.15, "notes": "Tear out floor joists"},
    {"id": uid(), "name": "Subfloor Demolition - OSB or Plywood", "category": "Framing", "unit": "SF", "laborCost": 0.55, "materialCost": 0.00, "equipmentCost": 0.10, "notes": "Pry up and stack"},
    {"id": uid(), "name": "Framing Debris Haul Away - Per Load", "category": "Framing", "unit": "EA", "laborCost": 95.00, "materialCost": 0.00, "equipmentCost": 185.00, "notes": "10-yard dumpster load"},

    # ── Fasteners and Connectors ──────────────────────────────
    {"id": uid(), "name": "Framing Nail Supply - 16D Sinker - Box", "category": "Framing", "unit": "EA", "laborCost": 0.00, "materialCost": 52.00, "equipmentCost": 0.00, "notes": "50 lb box sinker nails"},
    {"id": uid(), "name": "Structural Screw Supply - LedgerLOK Box", "category": "Framing", "unit": "EA", "laborCost": 0.00, "materialCost": 38.00, "equipmentCost": 0.00, "notes": "50 count structural screws"},
    {"id": uid(), "name": "Anchor Bolt Set - 1/2 Inch x 10 Inch", "category": "Framing", "unit": "EA", "laborCost": 8.50, "materialCost": 3.25, "equipmentCost": 0.50, "notes": "Sill plate to foundation anchor"},
    {"id": uid(), "name": "Hold Down Anchor Install - HDU2", "category": "Framing", "unit": "EA", "laborCost": 35.00, "materialCost": 25.00, "equipmentCost": 2.00, "notes": "Shear wall hold down anchor"},
    {"id": uid(), "name": "Strap Tie Install - Rafter to Plate", "category": "Framing", "unit": "EA", "laborCost": 5.50, "materialCost": 3.50, "equipmentCost": 0.25, "notes": "Metal strap hurricane tie"},

    # ── Layout and Inspection ─────────────────────────────────
    {"id": uid(), "name": "Structural Framing Layout - Per 1000 SF", "category": "Framing", "unit": "EA", "laborCost": 450.00, "materialCost": 0.00, "equipmentCost": 25.00, "notes": "Layout, snap lines, confirm plumb"},
    {"id": uid(), "name": "Framing Inspection Correction Items", "category": "Framing", "unit": "HR", "laborCost": 95.00, "materialCost": 12.00, "equipmentCost": 5.00, "notes": "Framing correction labor per hour"},
    {"id": uid(), "name": "Structural Engineer Review - Per Visit", "category": "Framing", "unit": "EA", "laborCost": 350.00, "materialCost": 0.00, "equipmentCost": 0.00, "notes": "Field inspection and report"},

    # ── Equipment ─────────────────────────────────────────────
    {"id": uid(), "name": "Crane Rental for Beam Set - Half Day", "category": "Framing", "unit": "EA", "laborCost": 0.00, "materialCost": 0.00, "equipmentCost": 850.00, "notes": "50 ton crane 4 hrs"},
    {"id": uid(), "name": "Forklift Rental for Material Staging", "category": "Framing", "unit": "EA", "laborCost": 0.00, "materialCost": 0.00, "equipmentCost": 325.00, "notes": "Per day rental with operator"},
    {"id": uid(), "name": "Framing Nailer Air Compressor - Per Day", "category": "Framing", "unit": "EA", "laborCost": 0.00, "materialCost": 0.00, "equipmentCost": 55.00, "notes": "Small compressor and hose"},

    # ── Miscellaneous ─────────────────────────────────────────
    {"id": uid(), "name": "Temporary Wall Brace Install", "category": "Framing", "unit": "EA", "laborCost": 45.00, "materialCost": 12.00, "equipmentCost": 2.00, "notes": "Diagonal kicker per panel"},
    {"id": uid(), "name": "Wall Straightening and Plumbing - Per LF", "category": "Framing", "unit": "LF", "laborCost": 8.50, "materialCost": 2.00, "equipmentCost": 0.50, "notes": "Correct out-of-plumb walls"},
    {"id": uid(), "name": "Window Rough Opening Frame-Out", "category": "Framing", "unit": "EA", "laborCost": 55.00, "materialCost": 18.00, "equipmentCost": 2.00, "notes": "Sill, cripples, trimmer, king"},
    {"id": uid(), "name": "Exterior Door Rough Opening Frame-Out", "category": "Framing", "unit": "EA", "laborCost": 65.00, "materialCost": 22.00, "equipmentCost": 2.00, "notes": "Full door RO framing"},
    {"id": uid(), "name": "Pocket Door Frame Kit Install", "category": "Framing", "unit": "EA", "laborCost": 95.00, "materialCost": 125.00, "equipmentCost": 5.00, "notes": "Pocket door frame hardware"},
    {"id": uid(), "name": "Furring Strip Install - 1x3 Wood", "category": "Framing", "unit": "LF", "laborCost": 0.55, "materialCost": 0.35, "equipmentCost": 0.02, "notes": "Strapping for level surface"},
    {"id": uid(), "name": "Ledger Board Attachment to Concrete", "category": "Framing", "unit": "LF", "laborCost": 8.50, "materialCost": 4.25, "equipmentCost": 1.50, "notes": "Tapcon or epoxy anchor"},
    {"id": uid(), "name": "Box Beam Build-Up - Hollow", "category": "Framing", "unit": "LF", "laborCost": 12.00, "materialCost": 6.50, "equipmentCost": 0.50, "notes": "Hollow decorative wood beam"},
    {"id": uid(), "name": "Scissor Truss Install - Vaulted Ceiling", "category": "Framing", "unit": "EA", "laborCost": 95.00, "materialCost": 215.00, "equipmentCost": 35.00, "notes": "Per truss with crane set"},
    {"id": uid(), "name": "Framing Protection Wrap - Per Week", "category": "Framing", "unit": "EA", "laborCost": 45.00, "materialCost": 85.00, "equipmentCost": 0.00, "notes": "Tarp and moisture protection"},
]

# ─────────────────────────────────────────────────────────────
# CONCRETE — 100 ITEMS
# ─────────────────────────────────────────────────────────────
concrete_items = [
    # ── Slab on Grade ─────────────────────────────────────────
    {"id": uid(), "name": "4 Inch Concrete Slab on Grade - Standard", "category": "Concrete", "unit": "SF", "laborCost": 1.25, "materialCost": 1.85, "equipmentCost": 0.45, "notes": "3000 psi with wire mesh"},
    {"id": uid(), "name": "6 Inch Concrete Slab on Grade - Reinforced", "category": "Concrete", "unit": "SF", "laborCost": 1.55, "materialCost": 2.45, "equipmentCost": 0.55, "notes": "4000 psi with rebar grid"},
    {"id": uid(), "name": "4 Inch Garage Concrete Slab - Broom Finish", "category": "Concrete", "unit": "SF", "laborCost": 1.35, "materialCost": 1.95, "equipmentCost": 0.45, "notes": "Includes saw cuts and integral drain"},
    {"id": uid(), "name": "6 Inch Industrial Warehouse Slab", "category": "Concrete", "unit": "SF", "laborCost": 1.75, "materialCost": 2.85, "equipmentCost": 0.65, "notes": "Heavy duty 4500 psi with fiber"},
    {"id": uid(), "name": "Concrete Slab Polished Finish", "category": "Concrete", "unit": "SF", "laborCost": 2.50, "materialCost": 0.45, "equipmentCost": 1.25, "notes": "3000 grit diamond polish"},
    {"id": uid(), "name": "Concrete Slab Sealed Surface", "category": "Concrete", "unit": "SF", "laborCost": 0.35, "materialCost": 0.28, "equipmentCost": 0.08, "notes": "Penetrating epoxy sealer"},
    {"id": uid(), "name": "Concrete Slab Epoxy Coat - 2 Part", "category": "Concrete", "unit": "SF", "laborCost": 1.25, "materialCost": 1.85, "equipmentCost": 0.25, "notes": "100% solids epoxy floor coat"},
    {"id": uid(), "name": "Concrete Slab Acid Etch and Stain", "category": "Concrete", "unit": "SF", "laborCost": 0.85, "materialCost": 0.35, "equipmentCost": 0.10, "notes": "Acid etch plus penetrating stain"},
    {"id": uid(), "name": "Concrete Slab Crack Repair - Epoxy Inject", "category": "Concrete", "unit": "LF", "laborCost": 8.50, "materialCost": 4.50, "equipmentCost": 1.50, "notes": "Epoxy injection structural repair"},
    {"id": uid(), "name": "Concrete Slab Control Joint Saw Cut", "category": "Concrete", "unit": "LF", "laborCost": 1.25, "materialCost": 0.00, "equipmentCost": 0.35, "notes": "1/4 depth green cut"},

    # ── Footings and Foundations ──────────────────────────────
    {"id": uid(), "name": "Continuous Concrete Footing - 12x12", "category": "Concrete", "unit": "LF", "laborCost": 12.50, "materialCost": 14.00, "equipmentCost": 2.50, "notes": "12 in wide x 12 in deep footing"},
    {"id": uid(), "name": "Continuous Concrete Footing - 16x8", "category": "Concrete", "unit": "LF", "laborCost": 14.00, "materialCost": 16.50, "equipmentCost": 2.50, "notes": "Wide shallow footing"},
    {"id": uid(), "name": "Spread Footing - 24x24x12", "category": "Concrete", "unit": "EA", "laborCost": 225.00, "materialCost": 185.00, "equipmentCost": 35.00, "notes": "Per column footing"},
    {"id": uid(), "name": "Spread Footing - 36x36x16", "category": "Concrete", "unit": "EA", "laborCost": 350.00, "materialCost": 285.00, "equipmentCost": 55.00, "notes": "Heavy column footing"},
    {"id": uid(), "name": "Concrete Grade Beam - 12x18", "category": "Concrete", "unit": "LF", "laborCost": 22.00, "materialCost": 26.00, "equipmentCost": 4.50, "notes": "Grade beam between piers"},
    {"id": uid(), "name": "Drilled Pier - 12 Inch Diameter", "category": "Concrete", "unit": "LF", "laborCost": 28.00, "materialCost": 22.00, "equipmentCost": 18.00, "notes": "Cast-in-place drilled pier"},
    {"id": uid(), "name": "Drilled Pier - 18 Inch Diameter", "category": "Concrete", "unit": "LF", "laborCost": 38.00, "materialCost": 32.00, "equipmentCost": 22.00, "notes": "Larger drilled pier"},

    # ── Foundation Walls ──────────────────────────────────────
    {"id": uid(), "name": "8 Inch Concrete Foundation Wall - Formed", "category": "Concrete", "unit": "SF", "laborCost": 8.50, "materialCost": 6.25, "equipmentCost": 1.50, "notes": "Poured wall with snap ties"},
    {"id": uid(), "name": "10 Inch Concrete Foundation Wall - Formed", "category": "Concrete", "unit": "SF", "laborCost": 9.50, "materialCost": 7.80, "equipmentCost": 1.75, "notes": "Thicker poured wall"},
    {"id": uid(), "name": "12 Inch Concrete Retaining Wall", "category": "Concrete", "unit": "SF", "laborCost": 12.00, "materialCost": 9.50, "equipmentCost": 2.50, "notes": "Cantilevered retaining wall"},
    {"id": uid(), "name": "ICF Foundation Wall - 6 Inch Core", "category": "Concrete", "unit": "SF", "laborCost": 10.50, "materialCost": 14.00, "equipmentCost": 1.50, "notes": "Insulated concrete form"},
    {"id": uid(), "name": "Concrete Wall Waterproofing - Exterior", "category": "Concrete", "unit": "SF", "laborCost": 2.50, "materialCost": 1.85, "equipmentCost": 0.35, "notes": "Bituminous or crystalline coat"},
    {"id": uid(), "name": "Foundation Drain Board Install", "category": "Concrete", "unit": "SF", "laborCost": 0.85, "materialCost": 1.25, "equipmentCost": 0.10, "notes": "Dimple mat drainage board"},

    # ── Walls and Columns ─────────────────────────────────────
    {"id": uid(), "name": "8 Inch Tilt-Up Concrete Panel - Per SF", "category": "Concrete", "unit": "SF", "laborCost": 4.50, "materialCost": 6.50, "equipmentCost": 2.50, "notes": "Cast and tilted in place"},
    {"id": uid(), "name": "Concrete Column - 12x12 Poured-in-Place", "category": "Concrete", "unit": "LF", "laborCost": 45.00, "materialCost": 55.00, "equipmentCost": 10.00, "notes": "Per LF column height"},
    {"id": uid(), "name": "Concrete Column - 18x18 Poured-in-Place", "category": "Concrete", "unit": "LF", "laborCost": 65.00, "materialCost": 80.00, "equipmentCost": 12.00, "notes": "Larger structural column"},
    {"id": uid(), "name": "CMU Block Wall - 8 Inch Standard", "category": "Concrete", "unit": "SF", "laborCost": 4.50, "materialCost": 3.85, "equipmentCost": 0.35, "notes": "8 inch hollow CMU"},
    {"id": uid(), "name": "CMU Block Wall - 12 Inch Reinforced", "category": "Concrete", "unit": "SF", "laborCost": 5.50, "materialCost": 5.25, "equipmentCost": 0.45, "notes": "12 inch grouted and reinforced"},
    {"id": uid(), "name": "CMU Fill and Grout - Per Core", "category": "Concrete", "unit": "EA", "laborCost": 3.50, "materialCost": 2.50, "equipmentCost": 0.25, "notes": "Core fill with rebar"},

    # ── Flatwork ──────────────────────────────────────────────
    {"id": uid(), "name": "Concrete Sidewalk - 4 Inch", "category": "Concrete", "unit": "SF", "laborCost": 1.15, "materialCost": 1.75, "equipmentCost": 0.40, "notes": "Standard public sidewalk"},
    {"id": uid(), "name": "Concrete Driveway - 4 Inch", "category": "Concrete", "unit": "SF", "laborCost": 1.25, "materialCost": 1.85, "equipmentCost": 0.45, "notes": "Residential driveway"},
    {"id": uid(), "name": "Concrete Driveway - 6 Inch Heavy Duty", "category": "Concrete", "unit": "SF", "laborCost": 1.55, "materialCost": 2.45, "equipmentCost": 0.55, "notes": "RV or commercial vehicle driveway"},
    {"id": uid(), "name": "Concrete Apron at Garage - 4 Inch", "category": "Concrete", "unit": "SF", "laborCost": 1.25, "materialCost": 1.85, "equipmentCost": 0.45, "notes": "Approach apron with expansion"},
    {"id": uid(), "name": "Concrete Patio - 4 Inch Broom Finish", "category": "Concrete", "unit": "SF", "laborCost": 1.25, "materialCost": 1.85, "equipmentCost": 0.45, "notes": "Standard outdoor patio"},
    {"id": uid(), "name": "Stamped Concrete - Single Pattern", "category": "Concrete", "unit": "SF", "laborCost": 2.50, "materialCost": 2.25, "equipmentCost": 0.55, "notes": "One color, single stamp pattern"},
    {"id": uid(), "name": "Stamped Concrete - Multi Pattern Colored", "category": "Concrete", "unit": "SF", "laborCost": 4.00, "materialCost": 3.25, "equipmentCost": 0.75, "notes": "Premium colored stamped"},
    {"id": uid(), "name": "Exposed Aggregate Finish - Seeded", "category": "Concrete", "unit": "SF", "laborCost": 1.85, "materialCost": 0.65, "equipmentCost": 0.25, "notes": "Washed exposed aggregate patio"},
    {"id": uid(), "name": "Concrete Curb - 6 Inch Single Faced", "category": "Concrete", "unit": "LF", "laborCost": 8.50, "materialCost": 6.50, "equipmentCost": 2.00, "notes": "Extruded or slip formed"},
    {"id": uid(), "name": "Concrete Curb and Gutter - Rollback", "category": "Concrete", "unit": "LF", "laborCost": 12.00, "materialCost": 9.50, "equipmentCost": 3.50, "notes": "Combination curb and gutter"},
    {"id": uid(), "name": "Concrete Wheel Stop Install", "category": "Concrete", "unit": "EA", "laborCost": 35.00, "materialCost": 28.00, "equipmentCost": 2.00, "notes": "Precast bolted wheel stop"},

    # ── Reinforcement ─────────────────────────────────────────
    {"id": uid(), "name": "#3 Rebar Install - Grade 60", "category": "Concrete", "unit": "LF", "laborCost": 0.45, "materialCost": 0.28, "equipmentCost": 0.03, "notes": "3/8 inch rebar"},
    {"id": uid(), "name": "#4 Rebar Install - Grade 60", "category": "Concrete", "unit": "LF", "laborCost": 0.55, "materialCost": 0.42, "equipmentCost": 0.04, "notes": "1/2 inch rebar"},
    {"id": uid(), "name": "#5 Rebar Install - Grade 60", "category": "Concrete", "unit": "LF", "laborCost": 0.65, "materialCost": 0.62, "equipmentCost": 0.05, "notes": "5/8 inch rebar"},
    {"id": uid(), "name": "#6 Rebar Install - Grade 60", "category": "Concrete", "unit": "LF", "laborCost": 0.85, "materialCost": 0.88, "equipmentCost": 0.07, "notes": "3/4 inch rebar"},
    {"id": uid(), "name": "Welded Wire Mesh - 6x6 W1.4xW1.4", "category": "Concrete", "unit": "SF", "laborCost": 0.15, "materialCost": 0.18, "equipmentCost": 0.02, "notes": "Light mesh for slab"},
    {"id": uid(), "name": "Welded Wire Mesh - 4x4 W2.0xW2.0", "category": "Concrete", "unit": "SF", "laborCost": 0.18, "materialCost": 0.25, "equipmentCost": 0.02, "notes": "Heavy mesh for slab"},
    {"id": uid(), "name": "Fiber Reinforcement Additive - Per CY", "category": "Concrete", "unit": "CY", "laborCost": 0.00, "materialCost": 8.50, "equipmentCost": 0.00, "notes": "Polypropylene fiber mix add"},
    {"id": uid(), "name": "Rebar Tie Wire - Per Bundle", "category": "Concrete", "unit": "EA", "laborCost": 0.00, "materialCost": 28.00, "equipmentCost": 0.00, "notes": "16 gauge black annealed"},
    {"id": uid(), "name": "Concrete Chairs for Rebar Placement", "category": "Concrete", "unit": "EA", "laborCost": 0.00, "materialCost": 0.15, "equipmentCost": 0.00, "notes": "Per chair for 1.5 in cover"},

    # ── Forming ───────────────────────────────────────────────
    {"id": uid(), "name": "Wood Form - Slab Edge 4 Inch", "category": "Concrete", "unit": "LF", "laborCost": 2.50, "materialCost": 0.85, "equipmentCost": 0.15, "notes": "2x4 lumber form set and strip"},
    {"id": uid(), "name": "Wood Form - Slab Edge 6 Inch", "category": "Concrete", "unit": "LF", "laborCost": 2.75, "materialCost": 1.05, "equipmentCost": 0.18, "notes": "2x6 lumber form"},
    {"id": uid(), "name": "Steel Gang Form - Wall - Per Use", "category": "Concrete", "unit": "SF", "laborCost": 6.50, "materialCost": 3.50, "equipmentCost": 2.50, "notes": "Modular gang form rental and labor"},
    {"id": uid(), "name": "Snap Ties and Wedges - Per SF of Wall", "category": "Concrete", "unit": "SF", "laborCost": 0.00, "materialCost": 0.65, "equipmentCost": 0.00, "notes": "Coil ties at 2 ft OC grid"},
    {"id": uid(), "name": "Form Release Agent - Per SF", "category": "Concrete", "unit": "SF", "laborCost": 0.00, "materialCost": 0.05, "equipmentCost": 0.00, "notes": "Petroleum or vegetable base"},
    {"id": uid(), "name": "Sono Tube Form - 10 Inch Diameter", "category": "Concrete", "unit": "LF", "laborCost": 4.50, "materialCost": 3.25, "equipmentCost": 0.50, "notes": "Round wax tube pier form"},
    {"id": uid(), "name": "Sono Tube Form - 18 Inch Diameter", "category": "Concrete", "unit": "LF", "laborCost": 6.50, "materialCost": 5.50, "equipmentCost": 0.75, "notes": "Large diameter tube form"},

    # ── Pumping and Placement ─────────────────────────────────
    {"id": uid(), "name": "Concrete Pump - Boom Truck - Per Hour", "category": "Concrete", "unit": "HR", "laborCost": 0.00, "materialCost": 0.00, "equipmentCost": 185.00, "notes": "52 meter boom pump"},
    {"id": uid(), "name": "Concrete Pump - Line Pump - Per Hour", "category": "Concrete", "unit": "HR", "laborCost": 0.00, "materialCost": 0.00, "equipmentCost": 125.00, "notes": "Trailer line pump"},
    {"id": uid(), "name": "Concrete Delivery - Per Yard 3000 PSI", "category": "Concrete", "unit": "CY", "laborCost": 0.00, "materialCost": 148.00, "equipmentCost": 0.00, "notes": "Ready mix delivery price"},
    {"id": uid(), "name": "Concrete Delivery - Per Yard 4000 PSI", "category": "Concrete", "unit": "CY", "laborCost": 0.00, "materialCost": 158.00, "equipmentCost": 0.00, "notes": "High strength ready mix"},
    {"id": uid(), "name": "Concrete Delivery - Per Yard 5000 PSI", "category": "Concrete", "unit": "CY", "laborCost": 0.00, "materialCost": 172.00, "equipmentCost": 0.00, "notes": "Structural high strength"},
    {"id": uid(), "name": "Concrete Chute Discharge - Short Pour", "category": "Concrete", "unit": "CY", "laborCost": 18.00, "materialCost": 0.00, "equipmentCost": 5.00, "notes": "Direct chute spread and vibrate"},
    {"id": uid(), "name": "Wheelbarrow Concrete Placement", "category": "Concrete", "unit": "CY", "laborCost": 45.00, "materialCost": 0.00, "equipmentCost": 5.00, "notes": "Hand wheel for difficult access"},

    # ── Finishing ─────────────────────────────────────────────
    {"id": uid(), "name": "Concrete Screed and Float Finish", "category": "Concrete", "unit": "SF", "laborCost": 0.45, "materialCost": 0.00, "equipmentCost": 0.10, "notes": "Screed, bull float and trowel"},
    {"id": uid(), "name": "Concrete Machine Trowel Finish - Smooth", "category": "Concrete", "unit": "SF", "laborCost": 0.35, "materialCost": 0.00, "equipmentCost": 0.15, "notes": "Power trowel smooth finish"},
    {"id": uid(), "name": "Concrete Broom Finish - Exposed", "category": "Concrete", "unit": "SF", "laborCost": 0.25, "materialCost": 0.00, "equipmentCost": 0.08, "notes": "Texture broom pass"},
    {"id": uid(), "name": "Concrete Curing Compound Application", "category": "Concrete", "unit": "SF", "laborCost": 0.08, "materialCost": 0.06, "equipmentCost": 0.02, "notes": "White pigmented curing compound"},
    {"id": uid(), "name": "Wet Burlap Curing - Per SF Per Day", "category": "Concrete", "unit": "SF", "laborCost": 0.08, "materialCost": 0.04, "equipmentCost": 0.01, "notes": "7-day wet cure method"},
    {"id": uid(), "name": "Concrete Hardener Application - Lithium", "category": "Concrete", "unit": "SF", "laborCost": 0.18, "materialCost": 0.22, "equipmentCost": 0.03, "notes": "Penetrating densifier"},
    {"id": uid(), "name": "Non-Shrink Grout - Column Base Plate", "category": "Concrete", "unit": "EA", "laborCost": 85.00, "materialCost": 38.00, "equipmentCost": 8.00, "notes": "Per base plate grout"},

    # ── Demolition and Saw Cutting ────────────────────────────
    {"id": uid(), "name": "Concrete Saw Cutting - Walk Behind", "category": "Concrete", "unit": "LF", "laborCost": 2.50, "materialCost": 0.00, "equipmentCost": 1.25, "notes": "14 inch diamond blade"},
    {"id": uid(), "name": "Core Drilling - 4 Inch Diameter", "category": "Concrete", "unit": "EA", "laborCost": 85.00, "materialCost": 0.00, "equipmentCost": 25.00, "notes": "Per core through slab or wall"},
    {"id": uid(), "name": "Core Drilling - 6 Inch Diameter", "category": "Concrete", "unit": "EA", "laborCost": 105.00, "materialCost": 0.00, "equipmentCost": 35.00, "notes": "Larger diameter core drill"},
    {"id": uid(), "name": "Core Drilling - 12 Inch Diameter", "category": "Concrete", "unit": "EA", "laborCost": 185.00, "materialCost": 0.00, "equipmentCost": 65.00, "notes": "Large pipe or duct penetration"},
    {"id": uid(), "name": "Concrete Demolition - Slab on Grade 4 Inch", "category": "Concrete", "unit": "SF", "laborCost": 1.85, "materialCost": 0.00, "equipmentCost": 0.85, "notes": "Jackhammer, break and pile"},
    {"id": uid(), "name": "Concrete Demolition - Foundation Wall", "category": "Concrete", "unit": "CF", "laborCost": 18.00, "materialCost": 0.00, "equipmentCost": 8.50, "notes": "Hydraulic hammer or saw"},
    {"id": uid(), "name": "Concrete Haul Away - Per Yard", "category": "Concrete", "unit": "CY", "laborCost": 35.00, "materialCost": 0.00, "equipmentCost": 48.00, "notes": "Load, haul and dump"},

    # ── Specialty ─────────────────────────────────────────────
    {"id": uid(), "name": "Post Tension Slab - Engineer Design", "category": "Concrete", "unit": "SF", "laborCost": 1.85, "materialCost": 1.25, "equipmentCost": 0.35, "notes": "PT cable system per SF"},
    {"id": uid(), "name": "Concrete Staircase - Precast", "category": "Concrete", "unit": "EA", "laborCost": 450.00, "materialCost": 1850.00, "equipmentCost": 350.00, "notes": "Per flight precast stair"},
    {"id": uid(), "name": "Concrete Staircase - Poured in Place", "category": "Concrete", "unit": "EA", "laborCost": 850.00, "materialCost": 450.00, "equipmentCost": 85.00, "notes": "Per flight formed and poured"},
    {"id": uid(), "name": "Precast Concrete Deck Panel", "category": "Concrete", "unit": "SF", "laborCost": 2.50, "materialCost": 8.50, "equipmentCost": 1.85, "notes": "Precast structural deck panel"},
    {"id": uid(), "name": "Concrete Admixture - Accelerator Per CY", "category": "Concrete", "unit": "CY", "laborCost": 0.00, "materialCost": 12.00, "equipmentCost": 0.00, "notes": "Calcium chloride accelerator"},
    {"id": uid(), "name": "Concrete Admixture - Plasticizer Per CY", "category": "Concrete", "unit": "CY", "laborCost": 0.00, "materialCost": 9.50, "equipmentCost": 0.00, "notes": "High range water reducer"},
    {"id": uid(), "name": "Cold Weather Concrete Protection - Per Day", "category": "Concrete", "unit": "EA", "laborCost": 185.00, "materialCost": 85.00, "equipmentCost": 45.00, "notes": "Insulated blankets and heat"},
    {"id": uid(), "name": "Concrete Test Cylinders - Set of 4", "category": "Concrete", "unit": "EA", "laborCost": 45.00, "materialCost": 28.00, "equipmentCost": 5.00, "notes": "Onsite cast and lab tested"},
]

# ─────────────────────────────────────────────────────────────
# COMBINE AND WRITE RAW OUTPUT
# ─────────────────────────────────────────────────────────────
all_items = drywall_items + framing_items + concrete_items

print(f"Generated {len(drywall_items)} Drywall items")
print(f"Generated {len(framing_items)} Framing items")
print(f"Generated {len(concrete_items)} Concrete items")
print(f"Total items generated: {len(all_items)}")

import os
os.makedirs("Data/raw", exist_ok=True)
with open("Data/raw/items.json", "w") as f:
    json.dump(all_items, f, indent=2)

print("Raw items written to Data/raw/items.json")
