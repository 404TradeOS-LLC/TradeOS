---
name: checking-pricing-sanity
description: Evaluates pricing in CostBook items or Assemblies to ensure it aligns with regional expectations. Use to flag outliers or unrealistic labor/material ratios.
---
# Checking Pricing Sanity

## When to use this skill
- Before finalizing a costbook or assembly catalog for production.
- When an imported batch needs a reality check against common construction baseline costs.
- The user requests a review of data for inflated, outdated, or skewed pricing.

## Workflow
- [ ] Receive inputs: An array of CostBook `items` or `assemblies`.
- [ ] Initialize `flaggedItems[]` and `suggestedAdjustments[]` structures.
- [ ] Iterate through the payloads and apply heuristic-based math evaluations.
- [ ] Check for **Outliers**: Flag any items where costs are drastically too high or too low for the given trade category and unit.
- [ ] Check **Ratios**: Ensure the balance between `laborCost`, `materialCost`, and `equipmentCost` makes proportional sense. 
- [ ] Do not mutate the source data. Output the resulting arrays of flagged items mapping strictly to the mathematically recommended fixes.

## Instructions
This validation goes beyond schema structure; it evaluates the real-world accuracy of the numbers.

### Core Validation Heuristics
1. **Gross Outliers Check**:
   - Cross-check standard unit prices. (e.g., $1,000/SF for paint is too high; $0.05/SF for framing lumber is too low). Flag any obvious impossibilities.
2. **Labor vs. Material Ratios**:
   - Assess trade norms. Painting/Drywall tends to lean heavier toward labor (e.g., 60-70% labor vs 30-40% material). HVAC/Plumbing fixtures lean heavy toward material (e.g., 20% labor vs 80% material).
   - If a standard drywall item lists 95% material cost and 5% labor cost, flag it immediately.
3. **Equipment Context**:
   - Verify `equipmentCost`. Basic hand-tool installations (e.g., hanging a door, painting a wall) should usually have $0.00 equipment cost. Heavy machinery tasks (Excavation, Concrete Pumping) should carry high equipment costs.

### Structured Response Format
Present findings cleanly so the orchestrating agent or user can decide whether to approve or reject the `suggestedAdjustments`.

```json
{
  "flaggedItems": [
    {
      "originalItem": { /* Copy of the offending CostBookItem or Assembly */ },
      "reason": "Labor-to-Material ratio is extremely skewed (95% Material, 5% Labor for residential plumbing)."
    }
  ],
  "suggestedAdjustments": [
    {
      "itemId": "uuid-of-flagged-item",
      "recommendedLabor": 45.50,
      "recommendedMaterial": 8.75,
      "recommendedEquipment": 0.0,
      "note": "Rebalanced to typical 80/20 split for labor-intensive trim carpentry."
    }
  ]
}
```

## Resources
- Ensure `CostBookItem` and `Assembly` checks align with the schemas dictated in `gemini.md`.
