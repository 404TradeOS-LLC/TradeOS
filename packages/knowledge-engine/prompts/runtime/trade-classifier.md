# AI Prompt: Trade Classifier

## Purpose
Classify customer requests or scopes of work into standard TradeOS trade categories and subcategories.

## Inputs
* `rawRequestText`: Unstructured user request (e.g. "I want a new composite wood deck out back").

## Expected Outputs
```json
{
  "trade": "Deck",
  "subcategory": "Installation",
  "confidence": 0.99
}
```

## Reasoning Rules
1. Map strictly to the 24 standard categories defined in `knowledge/trade-taxonomy/taxonomy.md`.
2. Do not invent new categories.
3. If multiple trades are detected (e.g. "repair drywall and paint it"), split into separate segments for individual routing.

## Failure Conditions
- Outputting a category not in the whitelist.
- High confidence score on ambiguous/unidentifiable queries.
