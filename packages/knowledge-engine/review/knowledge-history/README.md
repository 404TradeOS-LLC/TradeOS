# TradeOS Knowledge Evolution Log

This directory archives historical change logs for all approved knowledge factory merges.

---

## 1. Evolution Log Structure
Every approved merge must generate a log file inside this directory named:
`evolution_log_{version}_{timestamp}.json`

### Log Document Schema
```json
{
  "version": "1.0.1",
  "worker": "CostbookArchitect",
  "trade": "Tree Service",
  "batchId": "uuid-string",
  "changesApplied": [
    { "action": "ADD | UPDATE | DELETE", "itemId": "uuid", "description": "Added large tree removal item" }
  ],
  "reason": "Expanding baseline arboriculture pricing structure.",
  "approvedBy": "Human Evaluator Name",
  "timestamp": "2026-07-02T17:10:00Z"
}
```

This log maintains a complete, auditable paper trail for version control and rollback safety.
