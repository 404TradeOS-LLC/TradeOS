#!/usr/bin/env python3
import os
import json
import shutil
from datetime import datetime

ACTIVE_RUN_PATH = "runtime/active-run.json"
MASTER_COSTBOOK_PATH = "knowledge/cost-items/costbook.json"
EXPORT_COSTBOOK_PATH = "exports/json/costbook.json"
PROGRESS_PATH = "runtime/progress.json"

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

def approve_batch():
    if not os.path.exists(ACTIVE_RUN_PATH):
        print(f"Error: No active batch run found at {ACTIVE_RUN_PATH}.")
        return
        
    active = load_json(ACTIVE_RUN_PATH, {})
    if active.get("status") != "active":
        print("Error: Active run is not in 'active' status.")
        return
        
    current_batch_num = active.get("currentBatch")
    batches = active.get("batches", [])
    
    target_batch = None
    for b in batches:
        if b["batchNumber"] == current_batch_num:
            target_batch = b
            break
            
    if not target_batch:
        print("Error: Could not locate metadata for the current active batch.")
        return
        
    staged_file = target_batch["outputFile"]
    if not os.path.exists(staged_file):
        print(f"Error: Staged output file not found at {staged_file}")
        print("Please paste the prompt into Gemini and verify the output is generated before approving.")
        return
        
    # Load staged batch content
    batch_data = load_json(staged_file, [])
    if not isinstance(batch_data, list):
        print(f"Error: Batch data in {staged_file} must be a JSON array.")
        return
        
    actual_count = len(batch_data)
    if actual_count == 0:
        print(f"Error: Staged batch in {staged_file} contains 0 items.")
        return
        
    print(f"[{datetime.now().isoformat()}] Approving Batch {current_batch_num}...")
    print(f"  Loaded {actual_count} items from staged payload.")
    
    trade = active.get("trade")
    run_type = active.get("type")
    
    # 1. Save to modular folder structure for historical safety
    archive_dir = f"knowledge/{run_type}/{trade.lower().replace(' ', '_')}"
    archive_file = os.path.join(archive_dir, os.path.basename(staged_file))
    os.makedirs(archive_dir, exist_ok=True)
    shutil.copy2(staged_file, archive_file)
    print(f"  Modular copy saved to: {archive_file}")
    
    # 2. Merge into consolidated knowledge database
    master_db = load_json(MASTER_COSTBOOK_PATH, {"items": [], "assemblies": []})
    
    # Standardize schema names if missing in basic loader
    if "items" not in master_db:
        master_db["items"] = []
    if "assemblies" not in master_db:
        master_db["assemblies"] = []
        
    if run_type == "cost-items":
        # Merge items (preventing duplicate IDs)
        existing_ids = {item["id"] for item in master_db["items"]}
        for item in batch_data:
            # Ensure price values are string-formatted decimals as per standard Costbook serialization rule
            for cost_field in ["laborCost", "materialCost", "equipmentCost"]:
                if cost_field in item:
                    item[cost_field] = f"{float(item[cost_field]):.2f}"
            if item.get("id") not in existing_ids:
                master_db["items"].append(item)
    else:
        # Merge assemblies
        existing_ids = {a["id"] for a in master_db["assemblies"]}
        for assy in batch_data:
            if assy.get("id") not in existing_ids:
                master_db["assemblies"].append(assy)
                
    save_json(MASTER_COSTBOOK_PATH, master_db)
    
    # Also sync to exports
    export_db = load_json(EXPORT_COSTBOOK_PATH, {"items": [], "assemblies": []})
    if "items" not in export_db:
        export_db["items"] = []
    if "assemblies" not in export_db:
        export_db["assemblies"] = []
        
    if run_type == "cost-items":
        existing_ids = {item["id"] for item in export_db["items"]}
        for item in batch_data:
            for cost_field in ["laborCost", "materialCost", "equipmentCost"]:
                if cost_field in item:
                    item[cost_field] = f"{float(item[cost_field]):.2f}"
            if item.get("id") not in existing_ids:
                export_db["items"].append(item)
    else:
        existing_ids = {a["id"] for a in export_db["assemblies"]}
        for assy in batch_data:
            if assy.get("id") not in existing_ids:
                export_db["assemblies"].append(assy)
    save_json(EXPORT_COSTBOOK_PATH, export_db)
    print("  Master consolidated costbooks updated.")
    
    # Clean up review/pending
    try:
        os.remove(staged_file)
    except Exception:
        pass
        
    # 3. Update active-run.json state
    target_batch["status"] = "approved"
    target_batch["approvedAt"] = datetime.now().isoformat()
    
    active["completedCount"] += actual_count
    
    next_batch_num = current_batch_num + 1
    # Check if run completed
    run_complete = True
    for b in batches:
        if b["status"] != "approved":
            run_complete = False
            break
            
    if run_complete or next_batch_num > len(batches):
        active["status"] = "completed"
        print(f"\n🎉 Trade run for {trade} {run_type} is FULLY COMPLETED! Total items generated: {active['completedCount']}.")
    else:
        active["currentBatch"] = next_batch_num
        print(f"\nBatch {current_batch_num} approved successfully. Next batch will be Batch {next_batch_num}.")
        
    save_json(ACTIVE_RUN_PATH, active)
    
    # Update progress.json
    progress = load_json(PROGRESS_PATH, {})
    if trade in progress:
        progress[trade]["completed"] = active["completedCount"]
        progress[trade]["remaining"] = max(0, progress[trade]["total_target"] - active["completedCount"])
        progress[trade]["last_updated"] = datetime.now().isoformat()
        save_json(PROGRESS_PATH, progress)
        
    # Trigger database SQL compiles
    try:
        import subprocess
        # Re-compile SQL files automatically using standard publish script
        subprocess.run(["python3", "pipelines/export/publish_to_supabase.py"], capture_output=True)
    except Exception:
        pass

if __name__ == "__main__":
    approve_batch()
