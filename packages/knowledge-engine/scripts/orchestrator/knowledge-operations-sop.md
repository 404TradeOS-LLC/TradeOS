# TradeOS Knowledge Factory - Operations Standard Operating Procedure (SOP)

This document guides the operational execution of the Knowledge Operations Manager.

---

## 1. Queue Management & Prioritization
* **Queue Ingestion**: Read `runtime/queue.json` at the start of each run cycle.
* **Task Selection**: Select the task with the highest `priority` (scale 1-5). If priorities are equal, choose the task that completes an active trade focus (e.g., completing Tree Service item mappings).

---

## 2. Governance & Prevention

### Duplicate Mitigation
* Before triggering a worker agent to write new data, the manager queries `knowledge/cost-items/costbook.json` and active staged batches using fuzzy trigram matching to verify the items do not already exist.

### Runaway Protection
* **Max Active Limit**: The queue runner limits active generations to a single batch per trade category.
* **Run Constraints**: Limits loop runs to a maximum of 3 times per session before forcing a status lock and waiting for operator input.

---

## 3. Worker Routing & Reviews

### Worker Assignments
* Route tasks to appropriate agents based on task types (e.g. schema changes to `ValidationAgent`, cost list expansions to `CostbookArchitect`).

### Staging Reviews
* Once a worker submits a batch, calculate its Overall Quality score ($OQ$). If $OQ \ge 0.85$, move to `review/pending/` and queue the `ReviewAgent` check.

### Failure Handling
* Increment retry counters in `runtime/retry.json`. If retries reach 2, move the task to `runtime/failed.json` and flag it as a blocker in the operations state.
