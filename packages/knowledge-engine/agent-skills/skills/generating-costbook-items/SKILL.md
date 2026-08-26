---
name: generating-costbook-items
description: Generates structured CostBook item JSON arrays for specific trade categories using realistic contractor pricing based on region. Use when the user requests generating cost items, building a costbook, populating pricing data for trades, or creating CostBook items.
---
# Generating CostBook Items

## When to use this skill
- User requests generation of new cost items for a specific trade (e.g., plumbing, drywall, electrical).
- User needs a batch of realistic contractor pricing data.
- User wants to systematically populate the CostBook database.

## Workflow
- [ ] Parse inputs: `tradeCategory` (required), `region` (optional, default: Midwest), `batchSize` (optional, default: 25).
- [ ] Determine typical line items, proper units (e.g., LF, SF, EA, CY), and average local price points for the `tradeCategory` and `region`.
- [ ] Generate JSON objects adhering exactly to the CostBook item schema.
- [ ] Validate generated batch against rules: No duplicate item names, realistic distribution of costs.
- [ ] Verify against failure conditions: No empty names, total cost > 0, and valid unit types.
- [ ] Output or write the final JSON array.

## Instructions
When generating items, you MUST STRICTLY enforce the global data schemas defined in the workspace.

### Heuristics for Cost Generation
- **Pricing Breakdown**: Split your standard cost estimation into `laborCost`, `materialCost`, and `equipmentCost`. If an item does not require equipment or material, set to `0.0`.
- **Modularity**: Design items so they can be easily aggregated into assemblies. Do not create overly broad items (e.g., "Build Wall"). Delineate specifically (e.g., "Install 2x4 Wood Stud", "Hang 1/2in Drywall").
- **Cost Validation**: The sum of labor, material, and equipment must be greater than zero.

### JSON Payload Schema
You must produce an array of these objects:
```json
{
  "id": "uuid-string-here",
  "name": "Specific line item name",
  "category": "Must match the chosen tradeCategory",
  "unit": "Valid construction unit (LF, SF, EA, etc.)",
  "laborCost": 0.0,
  "materialCost": 0.0,
  "equipmentCost": 0.0,
  "notes": "Optional details about the item condition or exclusions"
}
```

## Resources
- Ensure generated schemas perfectly align with the expected input shape defined in `gemini.md`.
