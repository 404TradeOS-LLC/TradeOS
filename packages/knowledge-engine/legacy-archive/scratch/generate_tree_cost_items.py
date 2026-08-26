import os
import json
from datetime import datetime

# Directory target
OUTPUT_DIR = "knowledge/cost-items/tree-service"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Define the 25 Tree Service Cost Items
cost_items_raw = [
    {
        "id": "6f8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
        "slug": "climber-arborist-labor",
        "subcategory": "Labor",
        "name": "Climber Arborist Labor Rate",
        "unit": "HR",
        "description": "Standard hourly rate for climbing arborist performing pruning and technical tree dismantling.",
        "laborCost": 75.00,
        "materialCost": 0.00,
        "equipmentCost": 5.00,
        "notes": "Includes standard safety climbing harness and basic ropes."
    },
    {
        "id": "7f8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
        "slug": "ground-crew-loader-labor",
        "subcategory": "Labor",
        "name": "Ground Crew Loader Labor Rate",
        "unit": "HR",
        "description": "Standard hourly rate for ground loaders, brush handlers, and helper crew.",
        "laborCost": 45.00,
        "materialCost": 0.00,
        "equipmentCost": 0.00,
        "notes": "Responsible for debris collection, staging, and feeding the wood chipper."
    },
    {
        "id": "8f8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
        "slug": "standard-chainsaw-operating",
        "subcategory": "Equipment",
        "name": "Standard Chainsaw Operating Rate",
        "unit": "HR",
        "description": "Hourly operating cost of standard 20-inch gas chainsaw, including fuel and blade wear.",
        "laborCost": 0.00,
        "materialCost": 2.50,
        "equipmentCost": 12.50,
        "notes": "Used for felling, limbing, and bucking tree trunks."
    },
    {
        "id": "9f8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
        "slug": "large-wood-chipper-operating",
        "subcategory": "Equipment",
        "name": "Large Wood Chipper Operating Rate",
        "unit": "HR",
        "description": "Hourly operating cost of a towable 12-inch capacity wood chipper, including fuel and blade wear.",
        "laborCost": 0.00,
        "materialCost": 5.00,
        "equipmentCost": 35.00,
        "notes": "Chips tree limbs on site into organic mulch."
    },
    {
        "id": "af8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
        "slug": "stump-grinder-operating",
        "subcategory": "Equipment",
        "name": "Stump Grinder Operating Rate",
        "unit": "HR",
        "description": "Hourly operating rate for hydraulic stump grinding machinery.",
        "laborCost": 0.00,
        "materialCost": 4.50,
        "equipmentCost": 45.00,
        "notes": "Grinds tree stumps 6 to 12 inches below grade."
    },
    {
        "id": "bf8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
        "slug": "haul-truck-dump-fee",
        "subcategory": "Disposal",
        "name": "Haul Truck and Dump Fee",
        "unit": "EA",
        "description": "Flat rate charge per load for truck hauling and municipal bio-mass dumping fee.",
        "laborCost": 25.00,
        "materialCost": 0.00,
        "equipmentCost": 125.00,
        "notes": "Includes haul-away of logs, branches, and wood debris."
    },
    {
        "id": "cf8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
        "slug": "bucket-truck-operating",
        "subcategory": "Equipment",
        "name": "Bucket Truck Operating Rate",
        "unit": "HR",
        "description": "Hourly operating rate of a 60-foot aerial lift/bucket truck, including fuel.",
        "laborCost": 0.00,
        "materialCost": 0.00,
        "equipmentCost": 55.00,
        "notes": "Used for canopy access where climbing is hazardous."
    },
    {
        "id": "df8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
        "slug": "safety-rigging-gear-kit",
        "subcategory": "Materials",
        "name": "Safety Rigging Gear Kit",
        "unit": "EA",
        "description": "Standard wear-and-tear charge for safety blocks, friction brakes, and lowering lines.",
        "laborCost": 0.00,
        "materialCost": 35.00,
        "equipmentCost": 0.00,
        "notes": "Charged per job requiring technical lowering rigging."
    },
    {
        "id": "ef8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
        "slug": "arborist-permit-processing",
        "subcategory": "Admin",
        "name": "Arborist Permit Processing",
        "unit": "EA",
        "description": "Admin filing fee for municipal tree removal permits.",
        "laborCost": 50.00,
        "materialCost": 75.00,
        "equipmentCost": 0.00,
        "notes": "Includes filing and municipal permit validation fees."
    },
    {
        "id": "1f8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
        "slug": "ground-worker-apprentice-labor",
        "subcategory": "Labor",
        "name": "Ground Worker Apprentice Labor",
        "unit": "HR",
        "description": "Hourly wage for apprentice helpers assisting with cleanup and wood stacking.",
        "laborCost": 28.00,
        "materialCost": 0.00,
        "equipmentCost": 0.00,
        "notes": "Apprentice ground helper."
    },
    {
        "id": "2f8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
        "slug": "consulting-arborist-review",
        "subcategory": "Labor",
        "name": "Consulting Arborist Expert Review",
        "unit": "HR",
        "description": "Hourly consulting rate for Certified ISA Arborist structural health evaluations.",
        "laborCost": 115.00,
        "materialCost": 0.00,
        "equipmentCost": 0.00,
        "notes": "Provides structural report and health diagnosis."
    },
    {
        "id": "3f8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
        "slug": "light-chainsaw-operating",
        "subcategory": "Equipment",
        "name": "Light Chainsaw 14-Inch Operating",
        "unit": "HR",
        "description": "Hourly operating cost of light 14-inch pruning chainsaw.",
        "laborCost": 0.00,
        "materialCost": 1.50,
        "equipmentCost": 8.00,
        "notes": "Pruning chainsaw."
    },
    {
        "id": "4f8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
        "slug": "heavy-logging-chainsaw-operating",
        "subcategory": "Equipment",
        "name": "Heavy Logging Chainsaw 36-Inch Operating",
        "unit": "HR",
        "description": "Hourly operating cost of heavy duty 36-inch logging chainsaw.",
        "laborCost": 0.00,
        "materialCost": 4.00,
        "equipmentCost": 18.50,
        "notes": "Used for bucking large diameter trunks."
    },
    {
        "id": "5f8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
        "slug": "hydraulic-crane-support",
        "subcategory": "Equipment",
        "name": "Hydraulic Crane Support Rate",
        "unit": "HR",
        "description": "Hourly rental rate for hydraulic crane and licensed operator support.",
        "laborCost": 125.00,
        "materialCost": 0.00,
        "equipmentCost": 175.00,
        "notes": "Used for lifting heavy log segments over buildings."
    },
    {
        "id": "0f8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
        "slug": "skid-steer-grapple",
        "subcategory": "Equipment",
        "name": "Skid Steer with Grapple Attachment",
        "unit": "HR",
        "description": "Hourly operating rate for compact track skid steer with grapple jaws.",
        "laborCost": 0.00,
        "materialCost": 3.50,
        "equipmentCost": 65.00,
        "notes": "Used for moving logs on lot clearing sites."
    },
    {
        "id": "1a8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
        "slug": "dynamic-tree-cabling-kit",
        "subcategory": "Materials",
        "name": "Dynamic Tree Cabling Kit",
        "unit": "EA",
        "description": "Material cost for dynamic cobra cabling structural support system.",
        "laborCost": 0.00,
        "materialCost": 95.00,
        "equipmentCost": 0.00,
        "notes": "Includes splice lines, expansion rings, and shock absorbers."
    },
    {
        "id": "2a8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
        "slug": "deep-root-nutrient-fertilizer",
        "subcategory": "Materials",
        "name": "Deep Root Nutrient Liquid Fertilizer",
        "unit": "CY",
        "description": "Nutrient fertilizer mix injected per cubic yard of dry soil area.",
        "laborCost": 0.00,
        "materialCost": 12.50,
        "equipmentCost": 0.00,
        "notes": "Slow-release custom arborist nutrient mix."
    },
    {
        "id": "3a8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
        "slug": "insecticide-soil-drench",
        "subcategory": "Materials",
        "name": "Insecticide Soil Drench Inoculant",
        "unit": "EA",
        "description": "Standard chemical pack for systemic emerald ash borer protection.",
        "laborCost": 0.00,
        "materialCost": 85.00,
        "equipmentCost": 0.00,
        "notes": "Systemic arborist chemical control."
    },
    {
        "id": "4a8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
        "slug": "biomass-dumping-fee",
        "subcategory": "Disposal",
        "name": "Basic Biomass Dumping Fee",
        "unit": "CY",
        "description": "Tipping fee per cubic yard of wood chips and green brush waste.",
        "laborCost": 0.00,
        "materialCost": 8.00,
        "equipmentCost": 0.00,
        "notes": "Municipal bio-mass recycling center."
    },
    {
        "id": "5a8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
        "slug": "heavy-log-tipping-fee",
        "subcategory": "Disposal",
        "name": "Heavy Log Disposal Tipping Fee",
        "unit": "CY",
        "description": "Tipping fee per cubic yard for root flares and unsplit large logs.",
        "laborCost": 0.00,
        "materialCost": 18.00,
        "equipmentCost": 0.00,
        "notes": "Charged due to heavy handling processing requirements."
    },
    {
        "id": "6a8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
        "slug": "arborist-inspection-filing",
        "subcategory": "Admin",
        "name": "Arborist Inspection Report Filing",
        "unit": "EA",
        "description": "Processing charge to compile and submit arborist inspection report.",
        "laborCost": 65.00,
        "materialCost": 0.00,
        "equipmentCost": 0.00,
        "notes": "Required in historical zones."
    },
    {
        "id": "7a8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
        "slug": "emergency-mobilization-surcharge",
        "subcategory": "Admin",
        "name": "Emergency Mobilization Surcharge",
        "unit": "EA",
        "description": "Flat emergency dispatcher callout rate.",
        "laborCost": 150.00,
        "materialCost": 0.00,
        "equipmentCost": 0.00,
        "notes": "Applied for after-hours or storm callouts."
    },
    {
        "id": "8a8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
        "slug": "tree-growth-regulator",
        "subcategory": "Materials",
        "name": "Tree Growth Regulator Application",
        "unit": "EA",
        "description": "Growth regulator compound to slow canopy extension around wires.",
        "laborCost": 0.00,
        "materialCost": 60.00,
        "equipmentCost": 0.00,
        "notes": "Reduces necessary pruning frequencies."
    },
    {
        "id": "9a8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
        "slug": "wood-chips-mulch-backfill",
        "subcategory": "Materials",
        "name": "Standard Wood Chips Mulch Backfill",
        "unit": "CY",
        "description": "Standard arborist wood chips used to backfill stump cavities.",
        "laborCost": 0.00,
        "materialCost": 5.00,
        "equipmentCost": 0.00,
        "notes": "Organic backfill."
    },
    {
        "id": "0a8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
        "slug": "topsoil-backfill-seed",
        "subcategory": "Materials",
        "name": "Topsoil Backfill and Seed Cover",
        "unit": "CY",
        "description": "Cubic yard cost for topsoil and grass seed cover over ground stumps.",
        "laborCost": 0.00,
        "materialCost": 22.00,
        "equipmentCost": 0.00,
        "notes": "Lawn reclamation backfill."
    }
]

timestamp = datetime.now().isoformat()
batch_data = []

for item in cost_items_raw:
    # Serialize costs as strings matching Python float serialization rule or formatting rules
    # "All cost fields must be serialized using f'{val:.2f}'" (from GEMINI.md Maintenance Log!)
    labor_cost_str = f"{item['laborCost']:.2f}"
    material_cost_str = f"{item['materialCost']:.2f}"
    equipment_cost_str = f"{item['equipmentCost']:.2f}"

    cost_item = {
        "id": item["id"],
        "slug": item["slug"],
        "version": "1.0.0",
        "created": timestamp,
        "updated": timestamp,
        "trade": "Tree Service",
        "category": "Tree Service",
        "subcategory": item["subcategory"],
        "name": item["name"],
        "unit": item["unit"],
        "description": item["description"],
        "laborCost": labor_cost_str,
        "materialCost": material_cost_str,
        "equipmentCost": equipment_cost_str,
        "notes": item["notes"],
        "pricingStatus": "PLACEHOLDER",
        "requiredInputs": ["Access width constraints", "Crew sizes"],
        "productionNotes": "Double-check overhead electric lines before rigging.",
        "assumptions": ["Standard access permitted within 50 feet of job location."],
        "exclusions": ["Municipal permit filing fees (unless explicitly selected)."],
        "futurePricingHooks": "Link to diesel price indexes.",
        "confidenceScore": 0.95
    }
    
    # Save individual file
    file_path = os.path.join(OUTPUT_DIR, f"{item['slug']}.json")
    with open(file_path, "w") as f:
        json.dump(cost_item, f, indent=2)
    
    batch_data.append(cost_item)

# Create batch wrapper file in review/pending/
batch_payload = {
    "metadata": {
        "batchId": "2f8e7d2c-1a3b-4c5d-6e7f-8a9b0c1d2e3f",
        "trade": "Tree Service",
        "worker": "CostbookArchitect",
        "timestamp": timestamp,
        "recordCount": len(batch_data)
    },
    "data": batch_data
}

batch_file_path = "review/pending/tree_service_cost_items_batch_1.json"
with open(batch_file_path, "w") as f:
    json.dump(batch_payload, f, indent=2)

print(f"Generated 25 cost items under {OUTPUT_DIR} and successfully created batch file {batch_file_path}.")
