import json, random

categories = [
    ("Assemblies - Kitchen", "Remodel – Kitchen – "),
    ("Assemblies - Bathroom", "Remodel – Bathroom – "),
    ("Assemblies - Flooring", "Remodel – Flooring – "),
    ("Assemblies - Painting", "Remodel – Painting – "),
    ("Assemblies - Roofing", "Remodel – Roofing – "),
    ("Assemblies - Exterior", "Remodel – Exterior – "),
    ("Assemblies - Misc", "Remodel – Misc – ")
]

keyword_pool = {
    "Cabinetry": ["base cabinet", "wall cabinet", "drawer", "sink cabinet"],
    "Countertops": ["quartz", "granite", "laminate"],
    "Flooring": ["hardwood", "engineered wood", "tile", "laminate"],
    "Painting": ["primer", "paint", "trim paint"],
    "Roofing": ["shingle", "underlayment", "drip edge"],
    "Siding": ["fiber cement", "vinyl", "stucco"],
    "Landscaping": ["sod", "tree", "shrub", "mulch"],
    "Hardscaping": ["paver patio", "retaining wall", "deck"],
    "General Conditions": ["site cleanup", "inspection"]
}

entries = []
for i in range(250):
    cat, prefix = random.choice(categories)
    name = f"{prefix}{i+1}"
    line_items = []
    for _ in range(random.randint(2,5)):
        subcat = random.choice(list(keyword_pool.keys()))
        kw = random.choice(keyword_pool[subcat])
        qty = random.randint(1, 100)
        line_items.append({
            "category": subcat,
            "keywords": [kw],
            "quantity": qty
        })
    entries.append({"name": name, "category": cat, "lineItems": line_items})

with open("/Users/showb/TradeOS Costbook Editor/pipelines/remodel_assemblies.json", "w") as f:
    json.dump(entries, f, indent=2)
print(f"Generated {len(entries)} remodel assemblies JSON.")
