#!/usr/bin/env python3
import os
import sys
import argparse
import json
from datetime import datetime

ACTIVE_RUN_PATH = "runtime/active-run.json"
QUEUE_PATH = "runtime/queue.json"
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

def start_run():
    parser = argparse.ArgumentParser(description="Start a controlled TradeOS batch run.")
    parser.add_argument("--trade", required=True, help="Trade/domain focus, e.g. 'roofing'")
    parser.add_argument("--type", required=True, choices=["cost-items", "assemblies"], help="Type of items to generate")
    parser.add_argument("--target", type=int, default=100, help="Total target count to generate")
    parser.add_argument("--batch-size", type=int, default=10, help="Items count per batch")
    
    args = parser.parse_args()
    
    # Check if there is an active run already
    if os.path.exists(ACTIVE_RUN_PATH):
        active = load_json(ACTIVE_RUN_PATH, {})
        if active.get("status") == "active":
            print(f"Warning: An active run for {active.get('trade')} ({active.get('type')}) is already in progress.")
            confirm = input("Do you want to overwrite it? (y/N): ").strip().lower()
            if confirm != 'y':
                print("Aborted.")
                sys.exit(0)
                
    # Prepare batch intervals
    batches = []
    num_batches = (args.target + args.batch_size - 1) // args.batch_size
    for b in range(1, num_batches + 1):
        start_idx = (b - 1) * args.batch_size + 1
        end_idx = min(b * args.batch_size, args.target)
        
        filename = f"{args.trade.lower().replace(' ', '_')}_{args.type.replace('-', '_')}_batch_{b}.json"
        
        batches.append({
            "batchNumber": b,
            "itemRange": [start_idx, end_idx],
            "status": "pending",
            "outputFile": f"review/pending/{filename}",
            "stagedAt": None,
            "approvedAt": None
        })
        
    active_run = {
        "trade": args.trade,
        "type": args.type,
        "target": args.target,
        "batchSize": args.batch_size,
        "currentBatch": 1,
        "completedCount": 0,
        "status": "active",
        "startedAt": datetime.now().isoformat(),
        "batches": batches
    }
    
    save_json(ACTIVE_RUN_PATH, active_run)
    
    # Log to queue.json
    queue = load_json(QUEUE_PATH, [])
    # Clear any old run tasks for clean batch-runner workflow
    queue = [q for q in queue if q.get("notes", "").find("Controlled Batch Run") == -1]
    
    queue.append({
        "trade": args.trade,
        "worker": "AssemblyArchitect" if args.type == "assemblies" else "CostbookArchitect",
        "priority": 5,
        "status": "pending",
        "created": datetime.now().isoformat(),
        "started": None,
        "completed": None,
        "retryCount": 0,
        "qualityScore": None,
        "notes": f"Controlled Batch Run: {args.trade} {args.type} (Target: {args.target})"
    })
    save_json(QUEUE_PATH, queue)
    
    # Log to progress.json
    progress = load_json(PROGRESS_PATH, {})
    progress[args.trade] = {
        "type": args.type,
        "total_target": args.target,
        "completed": 0,
        "remaining": args.target,
        "last_updated": datetime.now().isoformat()
    }
    save_json(PROGRESS_PATH, progress)
    
    print(f"\n🚀 Controlled Batch Run Initialized!")
    print(f"  Trade: {args.trade}")
    print(f"  Type: {args.type}")
    print(f"  Target Items: {args.target} ({num_batches} batches of {args.batch_size})")
    print(f"\nNext step: Run `python3 scripts/next-batch.py` to prepare Batch 1.")

if __name__ == "__main__":
    start_run()
