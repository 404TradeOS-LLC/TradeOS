---
name: validating-costbook-items
description: Validates arrays of CostBook item JSON data against system rules. Use when verifying new cost items, auditing imported data, or catching pricing errors in the CostBook.
---
# Validating CostBook Items

## When to use this skill
- A batch of new CostBook items has been generated or imported.
- The user requests an audit of the current CostBook data.
- The user suspects errors or duplicates in the pricing information.

## Workflow
- [ ] Intialize validation check across an array of `CostBookItem` JSON objects.
- [ ] Initialize `validItems[]`, `rejectedItems[]`, and `errorReasons[]` structures to track results.
- [ ] Iterate through each item and evaluate it against the rule constraints.
- [ ] Identify and flag any duplicate names across the entire parsed batch.
- [ ] **Data Integrity**: Do NOT modify, fix, or mutate any of the provided data during this operation. You must act only as a strict, read-only verifier.
- [ ] Compile and report the categorized findings to the user or system.

## Instructions
Evaluate the provided payload systematically against the master guidelines. If any check fails, route the item object to `rejectedItems` and attach the exact reason to `errorReasons`. 

### Validation Constraints
1. **Name Field**: The `name` property must be populated and cannot be an empty string.
2. **Positive Value Constraint**: The mathematical sum of `laborCost`, `materialCost`, and `equipmentCost` must mathematically exceed `0.0`. 
3. **Valid Unit Type**: The `unit` field must reflect standard construction measurements (e.g., `LF`, `SF`, `EA`, `HR`, `CY`, `SY`, `SQ`).
4. **Realistic Constraints**: The values assigned to the cost categories must make sense (e.g., no negative numbers, flag extremely obvious illogical outliers like $1,000,000 for a 2x4 stud).
5. **No Duplicate Names**: The `name` must be unique across the provided dataset. First occurrence is valid; subsequent occurrences of the exact same name string are duplicates.

### Standard Output Format
Present the results so they can be digested quickly:
```json
{
  "validItems": [
    // Array of untouched, validated CostBookItems
  ],
  "rejectedItems": [
    // Array of untouched CostBookItems that failed
  ],
  "errorReasons": {
    "item-uuid-1": ["Total cost must be > 0"],
    "item-uuid-2": ["Name cannot be empty", "Duplicate item name found"]
  }
}
```

## Resources
- Ensure structural matching to the baseline global data schema for CostBook items established in `gemini.md`.
