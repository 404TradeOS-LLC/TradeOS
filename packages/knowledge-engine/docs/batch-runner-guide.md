# TradeOS Knowledge Factory - Controlled Batch Runner Guide

This document details the usage of the human-in-the-loop batch generation runner. It allows operators to safely expand trade categories (cost items or assemblies) in smaller 10-item increments.

---

## 1. How to Start a Trade Run
Initialize a new trade run using the `start-trade-run.py` script:
```bash
python3 scripts/start-trade-run.py --trade <trade-name> --type <cost-items|assemblies> --target <target-count> --batch-size <size>
```

### Examples:
* **Start 100 Roofing cost items**:
  ```bash
  python3 scripts/start-trade-run.py --trade roofing --type cost-items --target 100 --batch-size 10
  ```
* **Start 30 Deck assemblies**:
  ```bash
  python3 scripts/start-trade-run.py --trade deck --type assemblies --target 30 --batch-size 10
  ```

---

## 2. Generate Next Batch Prompt
Prepare the instructional prompt for the current batch:
```bash
python3 scripts/next-batch.py
```
This updates the status lock and outputs the instruction prompt to [runtime/current-task.md](file:///Users/showb/TradeOS%20Costbook%20Editor/runtime/current-task.md).

---

## 3. Execute with Gemini/Antigravity
1. Open and copy [runtime/current-task.md](file:///Users/showb/TradeOS%20Costbook%20Editor/runtime/current-task.md).
2. Paste the prompt into the agent chat interface.
3. The agent compiles the data and writes it directly to `review/pending/<trade>_<type>_batch_<num>.json`.

---

## 4. Review and Approve
Inspect the staged file under `review/pending/`. If the JSON conforms to the schemas and is free of errors, approve it:
```bash
python3 scripts/approve-batch.py
```
*This copies a modular record to `knowledge/<type>/<trade>/` and merges the contents into the master consolidated databases (`exports/json/costbook.json` and `knowledge/cost-items/costbook.json`).*

---

## 5. Review and Reject
If the generated items have duplicates, typos, or schema errors:
```bash
python3 scripts/reject-batch.py "rejection reason goes here"
```
*This marks the batch as rejected, clears the temporary staged file, and lets you rerun `next-batch.py` to regenerate the instructions with fresh parameters.*

---

## 6. How to Resume or Stop
* **To Resume later**: Simply execute `python3 scripts/next-batch.py`. The active run config is persisted in `runtime/active-run.json` and will automatically pick up from the last unapproved batch.
* **To Stop/Reset**: Simply initialize a new run using `start-trade-run.py`. It will prompt you to overwrite the current active run.
