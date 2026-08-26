# TradeOS Knowledge Factory - Local Automation Runner Guide

This document explains how to use the local task automation scripts to prepare, execute, and archive worker agent batches.

---

## 1. Start the Next Task
Run the task runner script to find the next pending task, mark it as `in_progress`, and prepare the prompt card:
```bash
python3 scripts/run-next-task.py
```

### What happens:
1. The script reads `runtime/queue.json` and selects the highest priority pending task.
2. It assigns a unique short `taskId` and sets state locks.
3. It outputs task instructions to `runtime/current-task.md`.

---

## 2. Execute the Task Prompt
1. Open the generated file `runtime/current-task.md`.
2. Copy the full content and paste it into the agent interface (e.g. Antigravity or Gemini Chat window).
3. The worker agent will execute the instructions and stage the generated files under `review/pending/`.

---

## 3. Mark the Task Complete or Failed
Once the output is generated and staged:

### Option A: Complete Task
Mark the task as successfully completed and archive the records:
```bash
python3 scripts/complete-task.py <task-id>
```
This moves the task details from `runtime/queue.json` into `runtime/completed.json` and updates idle states.

### Option B: Fail Task
Mark the task as failed:
```bash
python3 scripts/fail-task.py <task-id>
```
This logs the failure in `runtime/failed.json` and alerts the operator.
