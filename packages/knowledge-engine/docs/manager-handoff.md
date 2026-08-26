# TradeOS Knowledge Factory - Manager Handoff

This document directs the immediate next steps for the next execution session of the Knowledge Engine factory.

---

## 1. Current State Summary
* **Completed Setup**: Standardized directories, operations manager prompt, operations state, weekly reporting templates, and the active prioritized queue.
* **Staged Assets Awaiting Review**:
  - `review/pending/tree_service_batch_1.json` (10 tree service assemblies)
  - `review/pending/tree_service_cost_items_batch_1.json` (25 tree service cost items)

---

## 2. Next Session Actions

### Step 1: Run the Review Agent
* **Task**: Verify that all `costBookItemId` links inside `tree_service_batch_1.json` correspond to correct item definitions inside `tree_service_cost_items_batch_1.json`.
* **Standard**: Conform to the checks defined in `review/review-checklist.md`.

### Step 2: Merge Staged Batches
* **Task**: Move verified JSON items and assemblies into their final production folders:
  - Assemblies $\rightarrow$ `knowledge/assemblies/tree-service/`
  - Cost Items $\rightarrow$ `knowledge/cost-items/tree-service/`
* **Trigger**: Run the master orchestrator pipeline (`python3 pipelines/master_pipeline.py`) to compile the consolidated JSON databases and compile `sync_final.sql`.

### Step 3: Run the Next Queue Item
* **Task**: Trigger `AssemblyArchitect` to begin generating **Roofing Assembly Batch 1**.
