---
name: publishing-to-supabase
description: Pushes approved CostBook item and Assembly updates to the Supabase backend in batches. Handles retries on failure and logs success/failure outputs.
---
# Publishing to Supabase

## When to use this skill
- A batch of CostBook items or Assemblies has been fully generated, validated, and formatted.
- The user requests to sync the local `.json` data up to the remote TradeOS database.
- We need to perform safe, bulk data operations to keep the cloud in sync.

## Workflow
- [ ] Receive inputs: Finalized arrays of `CostBookItems` and/or `Assemblies`.
- [ ] Chunk the payloads into optimal batch sizes (e.g., 50-100 items per request) to avoid timeout or payload limit errors.
- [ ] Initiate the network request to the Supabase REST API or via the Supabase CLI/Client.
- [ ] **Implement Retry Logic**: If a batch request fails (e.g., network timeout, 50x error), apply an exponential backoff and retry up to 3 times.
- [ ] Track the exact status of each batch.
- [ ] Output a definitive JSON success/failure log summarizing the entire operation.

## Instructions
Because this touches live infrastructure, proceed with caution and prioritize data integrity.

### Syncing Rules
1. **Batch Upserts**: Send data in arrays. Rely on `upsert` functionality to match on the `id` UUID. If an ID exists, the record updates. If it does not exist, it inserts. This prevents duplicate primary key constraints from crashing the sync.
2. **Resilience**: A transient network glitch shouldn't corrupt the database. If Batch 3 fails, retry it. If it hard fails after 3 retries, halt the entire operation so the user doesn't end up with completely fragmented data.
3. **Immutability of Source**: Do NOT alter the data during this step. Your only job is networking and logging.

### Example Output Log
Provide the system or the user with a comprehensive receipt of the network job:
```json
{
  "status": "partial_success",
  "totalItemsAttempted": 250,
  "successfulItemsSynced": 200,
  "failedItems": 50,
  "logs": [
    "✅ [SUCCESS] Batch 1 (100 items) synced.",
    "✅ [SUCCESS] Batch 2 (100 items) synced.",
    "❌ [ERROR] Batch 3 (50 items) failed after 3 retries. Response: 504 Gateway Timeout."
  ]
}
```

## Resources
- Compare payloads against `gemini.md` to ensure no schema rejection from the backend Postgres tables.
