"""
AssemblyBuilderAgents — Bathroom, Kitchen, Basement
Builds assemblies from the already-deduped unique items pool.
Called by master_pipeline.py AFTER deduplication.
"""
import uuid

def uid(): return str(uuid.uuid4())

def find(unique, category, *keywords):
    """Return first item ID whose name contains all keywords (case-insensitive)."""
    kws = [k.lower() for k in keywords]
    for item in unique:
        if item["category"].lower() != category.lower():
            continue
        name = item["name"].lower()
        if all(k in name for k in kws):
            return item["id"]
    return None

def li(unique, category, qty, *keywords):
    iid = find(unique, category, *keywords)
    if iid:
        return {"costBookItemId": iid, "quantity": float(qty)}
    return None

def build_assembly(name, category, line_items):
    filtered = [x for x in line_items if x is not None]
    if not filtered:
        return None
    return {"id": uid(), "name": name, "category": category, "lineItems": filtered}


def build_bathroom_assemblies(unique):
    assemblies = []

    a = build_assembly("Standard Full Bathroom Rough-In - New Construction", "Assemblies - Bathroom", [
        li(unique, "Plumbing", 1, "rough-in", "per fixture"),
        li(unique, "Plumbing", 1, "toilet flange"),
        li(unique, "Plumbing", 1, "walk-in shower pan"),
        li(unique, "Plumbing", 1, "pex-a", "1/2 inch"),
        li(unique, "Electrical", 1, "gfci outlet", "20 amp"),
        li(unique, "Electrical", 1, "bathroom fan"),
        li(unique, "Drywall",  60, "cement board", "1/2 inch"),
    ])
    if a: assemblies.append(a)

    a = build_assembly("Full Bathroom Trim-Out - Standard", "Assemblies - Bathroom", [
        li(unique, "Plumbing", 1, "toilet", "floor mount", "2 piece"),
        li(unique, "Plumbing", 1, "vanity lavatory", "drop in"),
        li(unique, "Plumbing", 1, "bathroom faucet", "single handle"),
        li(unique, "Plumbing", 1, "shower valve", "thermostatic"),
        li(unique, "Plumbing", 1, "shower head"),
        li(unique, "Plumbing", 1, "exterior hose bib"),
    ])
    if a: assemblies.append(a)

    a = build_assembly("Master Bathroom Full Build - 100 SF", "Assemblies - Bathroom", [
        li(unique, "Plumbing",  1, "freestanding soaking tub"),
        li(unique, "Plumbing",  1, "walk-in shower pan"),
        li(unique, "Plumbing",  1, "toilet", "floor mount", "1 piece"),
        li(unique, "Plumbing",  1, "bathroom faucet", "widespread"),
        li(unique, "Flooring", 100, "porcelain floor tile", "12x12"),
        li(unique, "Drywall",  100, "cement board", "1/2 inch"),
        li(unique, "Painting",   1, "interior wall paint", "primer plus 2"),
        li(unique, "Electrical", 1, "bathroom fan"),
        li(unique, "HVAC",       1, "radiant floor", "electric"),
    ])
    if a: assemblies.append(a)

    a = build_assembly("Half Bath Powder Room Build-Out", "Assemblies - Bathroom", [
        li(unique, "Plumbing", 1, "toilet", "floor mount", "2 piece"),
        li(unique, "Plumbing", 1, "pedestal sink"),
        li(unique, "Plumbing", 1, "bathroom faucet", "single handle"),
        li(unique, "Electrical", 1, "vanity light"),
        li(unique, "Painting",   1, "interior wall paint", "2 coat"),
    ])
    if a: assemblies.append(a)

    return assemblies


def build_kitchen_assemblies(unique):
    assemblies = []

    a = build_assembly("Standard Kitchen Plumbing Rough-In", "Assemblies - Kitchen", [
        li(unique, "Plumbing", 1, "kitchen sink", "double bowl"),
        li(unique, "Plumbing", 1, "kitchen faucet"),
        li(unique, "Plumbing", 1, "garbage disposal"),
        li(unique, "Plumbing", 1, "dishwasher plumbing"),
        li(unique, "Plumbing", 1, "pot filler"),
    ])
    if a: assemblies.append(a)

    a = build_assembly("Kitchen Electrical Package - New Construction", "Assemblies - Kitchen", [
        li(unique, "Electrical", 1, "20 amp dedicated outlet", "appliance"),
        li(unique, "Electrical", 1, "50 amp range outlet"),
        li(unique, "Electrical", 1, "20 amp dedicated outlet"),
        li(unique, "Electrical", 1, "gfci outlet"),
        li(unique, "Electrical", 4, "recessed can", "4 inch"),
        li(unique, "Electrical", 1, "under cabinet", "led strip"),
    ])
    if a: assemblies.append(a)

    a = build_assembly("Kitchen HVAC - Range Exhaust Package", "Assemblies - Kitchen", [
        li(unique, "HVAC", 1, "range hood", "ducted"),
        li(unique, "HVAC", 1, "range hood duct", "6 inch"),
    ])
    if a: assemblies.append(a)

    a = build_assembly("Full Kitchen Finish Package - 200 SF", "Assemblies - Kitchen", [
        li(unique, "Painting",  200, "cabinet painting", "full kitchen"),
        li(unique, "Flooring",  200, "lvp", "mid grade"),
        li(unique, "Painting",  200, "interior wall paint", "2 coat"),
        li(unique, "Electrical",  6, "recessed can", "6 inch"),
        li(unique, "Trim",        1, "interior door", "pre-hung"),
    ])
    if a: assemblies.append(a)

    return assemblies


def build_basement_assemblies(unique):
    assemblies = []

    a = build_assembly("Basement Framing Package - 800 SF", "Assemblies - Basement", [
        li(unique, "Framing",  320, "3-5/8 inch 20 gauge steel stud"),
        li(unique, "Framing",  160, "3-5/8 inch steel track - floor"),
        li(unique, "Insulation", 800, "closed cell spray foam", "walls"),
        li(unique, "Drywall",  800, "1/2 inch regular drywall", "walls"),
    ])
    if a: assemblies.append(a)

    a = build_assembly("Basement Egress Window - Per Opening", "Assemblies - Basement", [
        li(unique, "Excavation", 1, "trench excavation", "18 inch"),
        li(unique, "Concrete",   1, "core drilling", "12 inch"),
        li(unique, "Framing",    1, "window rough opening"),
    ])
    if a: assemblies.append(a)

    a = build_assembly("Basement Full Finish Package - 800 SF", "Assemblies - Basement", [
        li(unique, "Drywall",   800, "tape and finish", "level 4"),
        li(unique, "Painting",  800, "interior wall paint", "2 coat"),
        li(unique, "Flooring",  800, "lvp", "mid grade"),
        li(unique, "Trim",      160, "baseboard", "3.5 inch mdf"),
        li(unique, "Electrical",  4, "recessed can", "6 inch"),
        li(unique, "HVAC",        1, "bathroom exhaust fan"),
        li(unique, "Plumbing",    1, "rough-in", "per fixture"),
    ])
    if a: assemblies.append(a)

    a = build_assembly("Basement Bathroom Rough-In", "Assemblies - Basement", [
        li(unique, "Concrete",   1, "core drilling", "4 inch"),
        li(unique, "Plumbing",   1, "toilet flange"),
        li(unique, "Plumbing",   1, "rough-in", "per fixture"),
        li(unique, "Electrical", 1, "gfci outlet"),
        li(unique, "Electrical", 1, "bathroom fan"),
    ])
    if a: assemblies.append(a)

    return assemblies


def build_all_assembly_agent_assemblies(unique):
    """Called by master_pipeline with the unique items list.
    Returns combined list from all assembly agents."""
    result = []
    result.extend(build_bathroom_assemblies(unique))
    result.extend(build_kitchen_assemblies(unique))
    result.extend(build_basement_assemblies(unique))
    return result
