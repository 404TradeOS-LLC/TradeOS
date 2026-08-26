# TradeOS Knowledge Factory - Batch Specification

This document defines the strict standard for worker agent outputs and execution batches.

---

## 1. Batch Size & Constraints
To ensure all generated knowledge remains manageable and reviewable:
* Every batch submitted by an autonomous worker agent must contain **exactly 10 records**:
  * Exactly **10 Cost Items**
  * OR
  * Exactly **10 Assemblies**
  * OR
  * Exactly **10 Crew Recipes**
  * OR
  * Exactly **10 Production Rates**
* Large expansions must be split into multiple distinct batches (e.g. generating 50 items requires 5 separate batch files: `batch_1.json` to `batch_5.json`).

---

## 2. File Naming & Location Rules
* **Pending Batches**: Saved to `review/pending/{trade}/{worker_name}_batch_{timestamp}.json`.
* **Verification**: Each batch must contain a metadata block:
  ```json
  {
    "metadata": {
      "batchId": "uuid-string",
      "trade": "Tree Service",
      "worker": "CostbookArchitect",
      "timestamp": "2026-07-02T17:08:00Z",
      "recordCount": 10
    },
    "data": [
      // List of exactly 10 schema-compliant JSON objects
    ]
  }
  ```
* **Independent Review**: The pipeline validator audits each batch independently, generating a corresponding validation report before requesting human review.
