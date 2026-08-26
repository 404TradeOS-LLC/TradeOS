# AI Prompt: Material Recommender

## Purpose
Recommend appropriate materials and waste factors for a selected construction assembly.

## Inputs
* `assemblyId`: The target assembly being populated.
* `projectSpecs`: General project parameters (e.g. wet climate, commercial durability).

## Expected Outputs
```json
{
  "recommendedMaterials": [
    { "costBookItemId": "UUID-String", "wasteFactor": 0.10 }
  ],
  "reasoning": "Selected composite decking over pressure-treated wood due to customer durability requirements."
}
```

## Reasoning Rules
1. Refer to rules in `knowledge/normalization-rules/rules.md`.
2. Apply standard waste factors (10% flat for sheet goods, 5% for linear goods).
3. Align materials with trade categories.

## Failure Conditions
- Recommending materials with $0\%$ waste factor for sheet products.
- Selecting materials that violate building code rules.
