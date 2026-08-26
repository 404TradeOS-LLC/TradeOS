# TradeOS Autonomous Knowledge Orchestrator

The Knowledge Orchestrator is the central coordinator for the Autonomous Knowledge Factory. It processes the batch queue, triggers specialized agents, validates quality scores, logs checkpoints, and directs human approval workflows.

---

## 1. Orchestration Strategy

```
                       ┌──────────────────────┐
                       │     Queue Parser     │
                       └──────────┬───────────┘
                                  │ (Select top priority batch)
                                  ▼
                       ┌──────────────────────┐
                       │  Duplicate Check     │ ◄─── (Skip if exists)
                       └──────────┬───────────┘
                                  │
                                  ▼
                       ┌──────────────────────┐
                       │  Worker Execution    │
                       └──────────┬───────────┘
                                  │ (Generate raw JSON batch)
                                  ▼
                       ┌──────────────────────┐
                       │   Quality Scorer     │
                       └──────────┬───────────┘
                                  │ (Score >= 0.85?)
                       ┌──────────┴──────────┐
                       │                     │
                    Yes│                   No│
                       ▼                     ▼
            ┌───────────────────┐   ┌───────────────────┐
            │ Stage for Review  │   │  Retry / Log Fail │
            │ (review/pending/) │   │ (Increment retry) │
            └───────────────────┘   └───────────────────┘
```

---

## 2. Queue & State Specifications
* **Active Queue**: Tracked in `runtime/queue.json`.
* **Retries Limit**: A single batch task is allowed up to 2 retries before being routed to `runtime/failed.json`.
* **State Checkpointing**: The orchestrator saves its current processing pointer and active worker locks to `runtime/state.json` to prevent concurrency race conditions.
