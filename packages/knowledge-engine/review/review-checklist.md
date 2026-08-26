# TradeOS Human Review Pipeline - Checklist

This document acts as the verification guide for human reviewers auditing staged autonomous agent batches before they are merged into the production costbook.

---

## 1. Safety & Verification Steps

- [ ] **1. Schema Validation Check**
  - Verify that the automated validation logs show `schema_valid = true`.
- [ ] **2. Pricing Floors Audit**
  - Check that all item prices are realistic and do not trigger pricing floor warnings (e.g. ensure hourly rates are $\ge \$12.00/HR$).
- [ ] **3. Acronyms & Casing Check**
  - Verify that all names are in Title Case and all standard abbreviations (e.g. OSB, PVC, DBH) are fully capitalized.
- [ ] **4. Waste Adjustments Review**
  - Confirm that composite/drywall sheet goods incorporate a $10\%$ waste factor, and linear items include a $5\%$ waste factor.
- [ ] **5. Exclusion Clashes**
  - Check that proposal templates do not include overlapping scopes (such as promising lawn seeding in both tree removal and sod installation).
- [ ] **6. Dependency Check**
  - Ensure that assemblies correctly reference valid cost items (no orphan or missing UUIDs).

---

## 2. Review Resolution Rules
* **Approve**: Move the batch JSON to `review/approved/` and execute `python3 pipelines/master_pipeline.py` to merge.
* **Reject**: Move the batch JSON to `review/rejected/`, attach a `rejection_log.txt` explaining the reasons, and re-queue the task for the generator worker.
