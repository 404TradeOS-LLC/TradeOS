#!/usr/bin/env python3
import os
import sys
import json
from datetime import datetime

QUEUE_PATH = "runtime/queue.json"
FAILED_PATH = "runtime/failed.json"
STATE_PATH = "runtime/state.json"
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

def fail_task(task_id):
    queue = load_json(QUEUE_PATH, [])
    failed_list = load_json(FAILED_PATH, [])
    
    # Find the task
    target_task = None
    target_index = -1
    for i, task in enumerate(queue):
        if task.get("id") == task_id:
            target_task = task
            target_index = i
            break
            
    if not target_task:
        print(f"Error: Task with ID '{task_id}' not found in queue.")
        return
        
    # Update status
    target_task["status"] = "failed"
    target_task["completed"] = datetime.now().isoformat()
    
    # Remove from queue, add to failed list
    queue.pop(target_index)
    failed_list.append(target_task)
    
    save_json(QUEUE_PATH, queue)
    save_json(FAILED_PATH, failed_list)
    
    # Update state.json
    state = load_json(STATE_PATH, {})
    state["status"] = "IDLE"
    state["active_worker"] = None
    state["active_task_id"] = None
    state["last_failed_task"] = task_id
    save_json(STATE_PATH, state)
    
    # Clean up current-task.md if it exists
    if os.path.exists(CURRENT_TASK_PATH):
        try:
            os.remove(CURRENT_TASK_PATH)
        except Exception:
            pass
            
    print(f"[{datetime.now().isoformat()}] Task {task_id} marked FAILED and logged.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/fail-task.py <task-id>")
        sys.exit(1)
        
    fail_task(sys.argv[1])
