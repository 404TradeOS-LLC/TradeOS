---
name: building-assemblies
description: Creates high-level construction assemblies from foundational CostBook items. Use when the user requests generating a project type, scoping an assembly, or bundling individual cost items together.
---
# Building Assemblies

## When to use this skill
- The user requests a composite item like a "Bathroom Remodel" or "10x10 Concrete Slab".
- We need to group foundational line items into a higher-level estimate package.
- The user asks to establish relationships between standard items based on real-world scope.

## Workflow
- [ ] Receive inputs: `assemblyType` (e.g., "Full Kitchen Remodel") and an array of valid `costItems[]` to draw from.
- [ ] Determine the real-world scope required to fulfill the `assemblyType`.
- [ ] Identify the necessary `costItems[]` that make up this scope.
- [ ] Assign realistic real-world quantities to each required `costBookItemId`.
- [ ] Generate the `Assembly` JSON object matching exactly the structural schema.
- [ ] Return the finished `Assembly` object to the user or system array.

## Instructions
Assemblies are collections of CostBook items with a multiplier (quantity) applied to each.

### Assembly Logic & Rules
1. **Valid References**: Every item inside the `lineItems` array MUST reference an exact, existing `id` from the provided `costItems[]` array. Do not invent random IDs.
2. **Realistic Scope**: Ensure the logic resembles real construction practices. A "Bathroom Remodel" assembly needs demolition, plumbing adjustments, electrical, drywall, tile, fixtures, and paint.
3. **Quantities**: Quantities must reflect standard assumptions for the `assemblyType` using the unit of the referenced item (e.g., if drywall is measured in SF, a 10x10 room might require 400 SF of drywall; do not put "1" for a whole room if the referenced item unit is SF).

### Payload Schema
You must produce an object that aligns exactly with the Assembly payload structure from the global schema:
```json
{
  "id": "uuid-for-this-assembly",
  "name": "Standard Master Bathroom Remodel",
  "category": "Interiors",
  "lineItems": [
    {
      "costBookItemId": "uuid-of-existing-drywall-item",
      "quantity": 350.0
    },
    {
      "costBookItemId": "uuid-of-existing-toilet-installation",
      "quantity": 1.0
    }
  ]
}
```

## Resources
- Check Assembly outputs directly against the array shape detailed in `gemini.md`.
