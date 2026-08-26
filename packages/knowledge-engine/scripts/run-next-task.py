#!/usr/bin/env python3
import os
import json
import uuid
from datetime import datetime

QUEUE_PATH = "runtime/queue.json"
STATE_PATH = "runtime/state.json"
CURRENT_TASK_PATH = "runtime/current-task.md"

# Default prompt templates mapping for workers
WORKER_PROMPTS = {
    "ReviewAgent": (
        "# Active Task: ReviewAgent Run\n\n"
        "## Mission\n"
        "You are the TradeOS ReviewAgent. Audit the newly staged assemblies and cost items.\n\n"
        "## Instructions\n"
        "1. Open review/pending/ files and verify schemas.\n"
        "2. Cross-reference costBookItemId links between the staged files.\n"
        "3. Output a validation log inside review/approved/ or review/rejected/.\n"
    ),
    "CoverageAgent": (
        "# Active Task: CoverageAgent Run\n\n"
        "## Mission\n"
        "You are the TradeOS CoverageAgent. Assess the current database coverage.\n\n"
        "## Instructions\n"
        "1. Scan the costbook and assembly indexes.\n"
        "2. Recalculate metrics in docs/coverage-dashboard.md and docs/coverage-heatmap.md.\n"
    ),
    "AssemblyArchitect": (
        "# Active Task: AssemblyArchitect Run\n\n"
        "## Mission\n"
        "You are the TradeOS AssemblyArchitect. Generate a new batch of assemblies.\n\n"
        "## Instructions\n"
        "1. Generate exactly 10 production-grade assemblies matching schemas/assembly.schema.json.\n"
        "2. Save the individual files and stage the consolidated payload in review/pending/.\n"
    ),
    "CostbookArchitect": (
        "# Active Task: CostbookArchitect Run\n\n"
        "## Mission\n"
        "You are the TradeOS CostbookArchitect. Generate a new batch of cost items.\n\n"
        "## Instructions\n"
        "1. Generate exactly 25 production-grade cost items matching schemas/cost-item.schema.json.\n"
        "2. Stage the consolidated payload in review/pending/.\n"
    )
}

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

def run():
    if not os.path.exists(QUEUE_PATH):
        print(f"Error: Queue file not found at {QUEUE_PATH}")
        return

    queue = load_json(QUEUE_PATH, [])
    
    # Find first pending task
    target_task = None
    for task in queue:
        if task.get("status") == "pending":
            target_task = task
            break
            
    if not target_task:
        print("No pending tasks in the queue.")
        return
        
    # Assign a unique taskId if it doesn't exist
    if "id" not in target_task:
        target_task["id"] = str(uuid.uuid4())[:8] # short UUID prefix for human typing ease
        
    target_task["status"] = "in_progress"
    target_task["started"] = datetime.now().isoformat()
    
    worker = target_task.get("worker", "Generic")
    trade = target_task.get("trade", "Generic")
    task_id = target_task["id"]
    notes = target_task.get("notes", "")
    
    print(f"[{datetime.now().isoformat()}] Preparing Task {task_id}...")
    print(f"  Worker Type: {worker}")
    print(f"  Trade Focus: {trade}")
    print(f"  Description: {notes}")
    
    # Get prompt content
    prompt_content = WORKER_PROMPTS.get(worker, (
        f"# Active Task: {worker} Run\n\n"
        f"Generate components for trade: {trade}.\n"
    ))
    
    # Append task specific context to the prompt
    full_prompt = (
        f"<!-- TASK_ID: {task_id} -->\n"
        f"{prompt_content}\n"
        f"## Active Context\n"
        f"- **Task ID**: {task_id}\n"
        f"- **Target Trade**: {trade}\n"
        f"- **Task Description**: {notes}\n\n"
        f"Please execute this task and stage the output in review/pending/. Once staged, notify the operator.\n"
    )
    
    # Write current-task.md
    with open(CURRENT_TASK_PATH, "w") as f:
        f.write(full_prompt)
        
    # Save queue back
    save_json(QUEUE_PATH, queue)
    
    # Update state.json
    state = load_json(STATE_PATH, {})
    state["status"] = "BUSY"
    state["active_worker"] = worker
    state["active_task_id"] = task_id
    state["last_run"] = datetime.now().isoformat()
    save_json(STATE_PATH, state)
    
    print(f"\n✅ Prompt successfully generated at {CURRENT_TASK_PATH}!")
    print("\n==================================================")
    print("👉 STEPS TO EXECUTE THE TASK:")
    print("==================================================")
    print(f"1. Copy the contents of {CURRENT_TASK_PATH}")
    print("2. Paste it into your agent/chat interface to run the worker task")
    print("3. After the worker stages its files, run the completion command:")
    print(f"   python3 scripts/complete-task.py {task_id}")
    print("==================================================")

if __name__ == "__main__":
    run()
