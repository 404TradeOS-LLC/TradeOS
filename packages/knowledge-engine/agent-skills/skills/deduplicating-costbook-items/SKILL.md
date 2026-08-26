---
name: deduplicating-costbook-items
description: Removes duplicate or near-duplicate cost items using fuzzy matching, category comparison, and cost similarity thresholds. Use when consolidating datasets or identifying redundant CostBook items.
---
# Deduplicating CostBook Items

## When to use this skill
- Merging two different CostBook item datasets or importing legacy CSVs.
- The user requests a cleanup of redundant or very similar CostBook items.
- A batch import appears to contain multiple line items for the exact same physical task or material.

## Workflow
- [ ] Parse an array of `CostBookItem` objects.
- [ ] Initialize `uniqueItems[]` and `mergedItems[]` arrays for your output payload.
- [ ] Iterate through the dataset and evaluate items against one another.
- [ ] Group items based on fuzzy name matching, category comparison, and cost similarity thresholds.
- [ ] Consolidate matched groups. Keep the strongest representative object in `uniqueItems[]`. 
- [ ] Log every removed or consolidated duplicate in `mergedItems[]` with an explanation.
- [ ] Return the structured JSON output to the user.

## Instructions
When deduplicating items, rely on heuristic thresholds to determine if two items represent the same real-world construction task.

### Deduplication Logic & Heuristics
1. **Fuzzy Name Matching**: Compare the `name` field using fuzzy logic. Ignore casing, punctuation, and simple pluralization. "Install 1/2in drywall" and "Installation of 1/2\" Drywall" are highly likely matches.
2. **Strict Category Comparison**: Items MUST share the exact same `category` to be considered duplicates. Similar names in different trades (e.g., "Standard Fasteners" in Electrical vs Plumbing) should remain distinct.
3. **Cost Similarity Threshold**: Compare the total costs (Labor + Material + Equipment). If names are a fuzzy match and the costs vary by less than 5%, flag them as duplicates. If costs vary significantly (e.g., > 15%), they may represent different grades or regional factors—keep them distinct unless instructed otherwise.
4. **Merge Resolution**: Once a duplicate cluster is found, retain the item with the most descriptive/complete `name` and place it in `uniqueItems[]`.

### Structured Output Payload
Do not permanently delete data without creating a clear paper trail:
```json
{
  "uniqueItems": [
    // Array of consolidated, distinct CostBookItem objects
  ],
  "mergedItems": [
    {
      "retainedItemId": "uuid-string-of-the-surviving-item",
      "removedItem": { /* The deleted CostBookItem object */ },
      "reason": "Name was 95% fuzzy match, costs were within 2% threshold"
    }
  ]
}
```

## Resources
- Ensure `CostBookItem` objects align with the base schema rules mapped out in `gemini.md`.
