# AI Prompt: Cost Item Selector

## Purpose
Select specific cost items from the database to populate assembly line items or fill individual estimator requests.

## Inputs
* `requiredSpecs`: Spec list containing material description, size, and category.
* `costItemCandidates`: Candidate costbook items filtered by taxonomy.

## Expected Outputs
```json
{
  "matchedItemId": "UUID-String",
  "matchType": "EXACT | NEAR | FALLBACK",
  "reasoning": "Selected standard 4 inch slab on grade matching the broom finish requirement."
}
```

## Reasoning Rules
1. Prioritize exact matches over near matches, and near matches over fallbacks.
2. Filter out deprecated items.
3. Obey regional material preferences (e.g. choosing regional framing wood).

## Failure Conditions
- Selecting a cost item from an incorrect trade category.
- Selecting deprecated items without specifying a replacement.
