---
name: normalizing-costbook-items
description: Normalizes and cleans CostBook item data for consistency. Use to enforce naming conventions, trim whitespace, standardize units, and strictly format pricing to two decimal places.
---
# Normalizing CostBook Items

## When to use this skill
- A batch of CostBook items needs superficial formatting and cleaning before being saved.
- Data imported from external sources features inconsistent syntax or casing.
- The user asks you to standardize and tidy up an existing CostBook array.

## Workflow
- [ ] Receive an array of `CostBookItem` objects.
- [ ] Iterate through each item and apply text and numeric formatting transformations.
- [ ] Process string fields (`name`, `category`, `notes`) to trim erratic whitespace.
- [ ] Standardize the capitalization formatting of the `name` field.
- [ ] Ensure formatting on `unit` strings conforms to accepted all-caps abbreviations.
- [ ] Round all cost fields to exactly two decimal places.
- [ ] Return the cleaned array of `CostBookItems`.

## Instructions
When executing normalization, you must strictly preserve the actual pricing and intent of the data. **DO NOT change pricing logic significantly.**

### Transformation Rules
1. **Whitespace Operations**: Perform a `.trim()` equivalent operation on relevant strings to eliminate accidental leading and trailing spaces.
2. **Naming conventions**: Consistently apply standard casing (e.g., Title Case) to the `name` field so the item catalog remains professional and uniform.
3. **Decimal Rounding**: Enforce currency-style rounding on `laborCost`, `materialCost`, and `equipmentCost`. They must be mathematically rounded to two decimal points (e.g., `4.111` -> `4.11`, `4.118` -> `4.12`).
4. **Unit Enforcement**: Unify unit representations to their standard construction abbreviations:
   - Lineal Feet / Lin Ft -> `LF`
   - Square Feet / Sq Ft -> `SF`
   - Each -> `EA`
   - Hour / Hr -> `HR`
   - Cubic Yard / Cub Yd -> `CY`
   - Square (100 SF) -> `SQ`

### Immutability Reminders
- You are re-formatting, not re-engineering.
- Maintain existing UUIDs strictly.
- Never arbitrarily increase or decrease prices beyond standard decimal math rounding logic.

## Resources
- Correlate output format with the master payload definitions inside `gemini.md`.
