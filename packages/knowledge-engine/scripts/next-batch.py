#!/usr/bin/env python3
import os
import json
from datetime import datetime

ACTIVE_RUN_PATH = "runtime/active-run.json"
CURRENT_TASK_PATH = "runtime/current-task.md"

def load_json(path, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r") as f:
            return json.load(f)
    except Exception:
        return default

def save_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

def prepare_next_batch():
    if not os.path.exists(ACTIVE_RUN_PATH):
        print(f"Error: No active batch run found at {ACTIVE_RUN_PATH}. Run start-trade-run.py first.")
        return
        
    active = load_json(ACTIVE_RUN_PATH, {})
    if active.get("status") != "active":
        print("Error: The active run is not in 'active' status.")
        return
        
    current_batch_num = active.get("currentBatch", 1)
    batches = active.get("batches", [])
    
    # Locate target batch
    target_batch = None
    for b in batches:
        if b["batchNumber"] == current_batch_num:
            target_batch = b
            break
            
    if not target_batch:
        print("🎉 All batches for this run have been completed!")
        return
        
    trade = active.get("trade")
    run_type = active.get("type")
    start_idx, end_idx = target_batch["itemRange"]
    output_file = target_batch["outputFile"]
    qty_items = end_idx - start_idx + 1
    
    # Set schema file description
    schema_file = "schemas/cost-item.schema.json" if run_type == "cost-items" else "schemas/assembly.schema.json"
    
    # Determine the existing directories to look at for examples
    existing_dir = f"knowledge/{run_type}/{trade.lower().replace(' ', '_')}"
    
    # Mark batch status
    target_batch["status"] = "in_progress"
    save_json(ACTIVE_RUN_PATH, active)
    
    prompt = (
        f"<!-- BATCH_RUN: {trade} | {run_type} | Batch {current_batch_num} -->\n"
        f"# Controlled Batch Generation Request\n\n"
        f"You are the TradeOS Knowledge Builder Agent.\n\n"
        f"## Task Description\n"
        f"Generate exactly **{qty_items}** production-grade **{run_type}** for the trade category **{trade}**.\n"
        f"This is Batch **{current_batch_num}** (covering items {start_idx} to {end_idx}).\n\n"
        f"## Input and Schema Reference\n"
        f"- **Schema to Follow**: [{schema_file}](file:///{os.path.abspath(schema_file)})\n"
        f"- **Target Output Location**: [{output_file}](file:///{os.path.abspath(output_file)})\n"
        f"- **Reference Existing Examples**: check directories like [{existing_dir}](file:///{os.path.abspath(existing_dir)}) if they exist.\n\n"
        f"## Strict Requirements\n"
        f"1. Generate exactly the specified number of items ({qty_items}).\n"
        f"2. Ensure all fields required by the JSON schema are present and valid.\n"
        f"3. Generate unique UUIDs for all item/assembly IDs.\n"
        f"4. Format the output file cleanly as a JSON array.\n"
        f"5. Save the result directly into `{output_file}`.\n\n"
        f"Please execute this generation task now and write the file. When completed, let the user know."
    )
    
    with open(CURRENT_TASK_PATH, "w") as f:
        f.write(prompt)
        
    print(f"[{datetime.now().isoformat()}] Prepared Batch {current_batch_num} (items {start_idx}-{end_idx}).")
    print(f"👉 Prompt written to: {CURRENT_TASK_PATH}")
    print("\n==================================================")
    print("INSTRUCTIONS:")
    print("==================================================")
    print(f"1. Copy the contents of {CURRENT_TASK_PATH}")
    print("2. Paste it into your agent/chat interface to generate the batch")
    print("3. Verify the generated batch at:")
    print(f"   {output_file}")
    print("4. Approve the batch by running:")
    print(f"   python3 scripts/approve-batch.py")
    print("==================================================")

if __name__ == "__main__":
    prepare_next_batch()
