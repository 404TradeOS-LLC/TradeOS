#!/usr/bin/env python3
import os
import sys
import json
from datetime import datetime

ACTIVE_RUN_PATH = "runtime/active-run.json"

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

def reject_batch():
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
        
    reason = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Quality issues / schema deviation"
    
    print(f"[{datetime.now().isoformat()}] Rejecting Batch {current_batch_num}...")
    print(f"  Reason: {reason}")
    
    # Update active-run.json state
    target_batch["status"] = "rejected"
    target_batch["rejectionReason"] = reason
    save_json(ACTIVE_RUN_PATH, active)
    
    # Remove file from review/pending to allow fresh overwrite
    staged_file = target_batch["outputFile"]
    if os.path.exists(staged_file):
        try:
            os.remove(staged_file)
            print(f"  Staged file {staged_file} removed.")
        except Exception as e:
            print(f"  Warning: Could not remove staged file: {e}")
            
    print(f"\nBatch {current_batch_num} marked REJECTED.")
    print("Run `python3 scripts/next-batch.py` to regenerate the prompt for this batch.")

if __name__ == "__main__":
    reject_batch()
