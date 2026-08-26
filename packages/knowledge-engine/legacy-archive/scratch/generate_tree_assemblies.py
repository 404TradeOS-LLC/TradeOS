import os
import json
import uuid
from datetime import datetime

# Directory target
OUTPUT_DIR = "knowledge/assemblies/tree-service"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Shared Mock Cost Book Item UUIDs for Tree Service
ITEMS = {
    "arborist_labor": "6f8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
    "ground_labor": "7f8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
    "chainsaw_rental": "8f8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
    "chipper_rental": "9f8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
    "stump_grinder": "af8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
    "haul_truck": "bf8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
    "bucket_truck": "cf8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
    "rigging_gear": "df8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
    "permit_fee": "ef8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f"
}

# The 10 Tree Service assemblies
assemblies_raw = [
    {
        "slug": "basic-tree-removal",
        "name": "Basic Tree Removal",
        "description": "Standard removal of small to medium trees up to 12 inches DBH without safety rigging obstructions.",
        "lineItems": [
            {"costBookItemId": ITEMS["arborist_labor"], "quantity": 4.0},
            {"costBookItemId": ITEMS["ground_labor"], "quantity": 4.0},
            {"costBookItemId": ITEMS["chainsaw_rental"], "quantity": 1.0},
            {"costBookItemId": ITEMS["haul_truck"], "quantity": 1.0}
        ]
    },
    {
        "slug": "large-tree-removal",
        "name": "Large Tree Removal",
        "description": "Removal of large trees exceeding 24 inches DBH requiring crane support or extensive rigging.",
        "lineItems": [
            {"costBookItemId": ITEMS["arborist_labor"], "quantity": 16.0},
            {"costBookItemId": ITEMS["ground_labor"], "quantity": 16.0},
            {"costBookItemId": ITEMS["bucket_truck"], "quantity": 1.0},
            {"costBookItemId": ITEMS["haul_truck"], "quantity": 2.0},
            {"costBookItemId": ITEMS["rigging_gear"], "quantity": 1.0}
        ]
    },
    {
        "slug": "hazard-tree-removal",
        "name": "Hazard Tree Removal",
        "description": "Hazardous tree removals close to residential properties, power lines, or structural hazards.",
        "lineItems": [
            {"costBookItemId": ITEMS["arborist_labor"], "quantity": 12.0},
            {"costBookItemId": ITEMS["ground_labor"], "quantity": 12.0},
            {"costBookItemId": ITEMS["bucket_truck"], "quantity": 1.0},
            {"costBookItemId": ITEMS["rigging_gear"], "quantity": 1.0},
            {"costBookItemId": ITEMS["permit_fee"], "quantity": 1.0}
        ]
    },
    {
        "slug": "emergency-storm-cleanup",
        "name": "Emergency Storm Cleanup",
        "description": "Priority emergency clearing of fallen trees, hanging hazard limbs, and storm hazard debris.",
        "lineItems": [
            {"costBookItemId": ITEMS["arborist_labor"], "quantity": 8.0},
            {"costBookItemId": ITEMS["ground_labor"], "quantity": 16.0},
            {"costBookItemId": ITEMS["chainsaw_rental"], "quantity": 2.0},
            {"costBookItemId": ITEMS["haul_truck"], "quantity": 2.0}
        ]
    },
    {
        "slug": "stump-grinding",
        "name": "Stump Grinding",
        "description": "Grinding tree stumps below grade, including backfilling with chips and topsoil prep.",
        "lineItems": [
            {"costBookItemId": ITEMS["ground_labor"], "quantity": 2.0},
            {"costBookItemId": ITEMS["stump_grinder"], "quantity": 1.0}
        ]
    },
    {
        "slug": "brush-chipping",
        "name": "Brush Chipping",
        "description": "On-site chipping of brush, twigs, and small tree limbs into organic mulch.",
        "lineItems": [
            {"costBookItemId": ITEMS["ground_labor"], "quantity": 4.0},
            {"costBookItemId": ITEMS["chipper_rental"], "quantity": 1.0}
        ]
    },
    {
        "slug": "limbing-pruning",
        "name": "Limbing and Pruning",
        "description": "Standard ANSI-compliant structural pruning, limb removal, and crown reduction.",
        "lineItems": [
            {"costBookItemId": ITEMS["arborist_labor"], "quantity": 6.0},
            {"costBookItemId": ITEMS["ground_labor"], "quantity": 6.0},
            {"costBookItemId": ITEMS["bucket_truck"], "quantity": 1.0}
        ]
    },
    {
        "slug": "deadwood-removal",
        "name": "Deadwood Removal",
        "description": "Removing dead, dying, or diseased branches from tree canopy to improve safety and health.",
        "lineItems": [
            {"costBookItemId": ITEMS["arborist_labor"], "quantity": 4.0},
            {"costBookItemId": ITEMS["ground_labor"], "quantity": 4.0},
            {"costBookItemId": ITEMS["rigging_gear"], "quantity": 1.0}
        ]
    },
    {
        "slug": "lot-clearing",
        "name": "Lot Clearing",
        "description": "Clearing all trees, brush, and ground vegetation on residential or commercial lots.",
        "lineItems": [
            {"costBookItemId": ITEMS["arborist_labor"], "quantity": 24.0},
            {"costBookItemId": ITEMS["ground_labor"], "quantity": 48.0},
            {"costBookItemId": ITEMS["chipper_rental"], "quantity": 1.0},
            {"costBookItemId": ITEMS["haul_truck"], "quantity": 4.0}
        ]
    },
    {
        "slug": "haul-away-only",
        "name": "Haul-Away Only",
        "description": "Loading, hauling, and tipping pre-cut logs, trunks, wood chips, and branch debris.",
        "lineItems": [
            {"costBookItemId": ITEMS["ground_labor"], "quantity": 4.0},
            {"costBookItemId": ITEMS["haul_truck"], "quantity": 1.0}
        ]
    }
]

timestamp = datetime.now().isoformat()
batch_data = []

for item in assemblies_raw:
    # Build complete assembly record matching schema exactly
    assembly = {
        "id": str(uuid.uuid4()),
        "slug": item["slug"],
        "version": "1.0.0",
        "created": timestamp,
        "updated": timestamp,
        "trade": "Tree Service",
        "category": "Tree Service",
        "name": item["name"],
        "description": item["description"],
        "lineItems": item["lineItems"],
        "projectTypes": ["Residential", "Commercial"],
        "constructionPhase": "Site Preparation",
        "requiredInputs": ["Access limits", "Tree DBH count"],
        "optionalInputs": ["Soil condition"],
        "materialCategories": ["Safety rigging material"],
        "laborCategories": ["Climber Arborist", "Ground Loader"],
        "equipmentCategories": ["Chainsaws", "Trucks", "Chippers"],
        "safetyRequirements": ["OSHA head protective gear", "Rigging harnesses"],
        "riskFactors": ["Power line overhead proximity", "Structural property risk"],
        "permitAwareness": "Arborist permits required in municipal boundaries for trees exceeding 8 inches DBH.",
        "inspectionAwareness": "Post-removal ground inspection for disease vectors.",
        "codeConsiderations": "Conforms to ANSI A300 Pruning Standards.",
        "dependencies": ["Utility line drops if power lines interfere"],
        "wasteDisposal": "All brush chipped on site. Large logs hauled to municipal bio-mass dump sites.",
        "proposalScopeOfWork": f"Provide professional tree service for {item['name']}.",
        "proposalAssumptions": "Assumes standard truck access within 50 feet of tree base.",
        "proposalExclusions": "Excludes soil grading, stump removal (unless selected), and turf seeding.",
        "warrantyLanguage": "30-day health assessment warranty on pruning. No warranty on complete removals.",
        "productionNotes": "Review local weather alerts. Avoid high wind executions."
    }
    
    # Save individual file
    file_path = os.path.join(OUTPUT_DIR, f"{item['slug']}.json")
    with open(file_path, "w") as f:
        json.dump(assembly, f, indent=2)
    
    batch_data.append(assembly)

# Create batch wrapper file in review/pending/
batch_payload = {
    "metadata": {
        "batchId": str(uuid.uuid4()),
        "trade": "Tree Service",
        "worker": "AssemblyArchitect",
        "timestamp": timestamp,
        "recordCount": len(batch_data)
    },
    "data": batch_data
}

batch_file_path = "review/pending/tree_service_batch_1.json"
with open(batch_file_path, "w") as f:
    json.dump(batch_payload, f, indent=2)

print(f"Generated 10 assemblies under {OUTPUT_DIR} and successfully created batch file {batch_file_path}.")
