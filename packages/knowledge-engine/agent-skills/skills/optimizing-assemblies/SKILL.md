---
name: optimizing-assemblies
description: Improves and refines existing assemblies for efficiency and realism. Use when the user requests a review of an assembly, wants to adjust quantities to match real-world norms, or needs redundant items removed.
---
# Optimizing Assemblies

## When to use this skill
- A newly built assembly feels overly complex or contains redundant tasks.
- The user requests a pass to ensure the quantities inside an assembly make logical sense for the real world.
- You need to standardize the grouping of line items within a composite array.

## Workflow
- [ ] Receive an `Assembly` JSON object to optimize, along with access to the master `costItems[]` array for reference.
- [ ] Review the `lineItems` array within the Assembly.
- [ ] Identify and **remove redundant items** (e.g., if you have "Install 1/2in Drywall" and "Hang Drywall", drop one).
- [ ] **Adjust quantities** to match realistic construction ratios (e.g., the square footage of paint should loosely correlate to the square footage of drywall).
- [ ] Ensure **logical grouping** and ordering of the `lineItems` (e.g., physically order them chronologically: Demolition -> Framing -> Plumbing -> Drywall -> Paint).
- [ ] Return the cleaned, `optimized Assembly` object.

## Instructions
Optimization requires a fundamental understanding of how construction projects go together. Your goal is to make the Assembly leaner and more realistic.

### Optimization Rules
1. **Remove Redundancy**: An assembly should not double-count labor or materials. Be strictly opposed to overlapping scopes.
2. **Quantity Ratios**: Quantities should be proportional. 
   - A 100 SF room might have 100 SF of flooring, but 400 SF of wall drywall and paint. Ensure these math ratios generally make sense based on standard construction practices.
3. **Chronological Sorting**: While JSON order doesn't technically matter, sorting the `lineItems` array into logical workflow phases makes the data significantly easier for humans to audit and verify.

### Payload Immutability
Do not change the fundamental `id`, `name`, or `category` of the root Assembly object. Only manipulate the contents of the `lineItems` array. The output must strictly adhere to the global `Assembly` schema.

```json
{
  "id": "uuid-for-this-assembly",
  "name": "Original Name",
  "category": "Original Category",
  "lineItems": [
    // Optimized, lean, and chronologically sorted items
  ]
}
```

## Resources
- Validate the optimized output structure against the `gemini.md` architecture requirements.
