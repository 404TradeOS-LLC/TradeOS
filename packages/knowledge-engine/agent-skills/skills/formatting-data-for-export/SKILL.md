---
name: formatting-data-for-export
description: Converts validated CostBook and Assembly data into the final Swift-compatible JSON format. Use when finalizing the pipeline and preparing the data payload for export into the TradeOS application.
---
# Formatting Data for Export

## When to use this skill
- All data generation, validation, and deduplication passes are complete.
- We are ready to shift data from the `Data/working/` directory to the final `Data/export/` directory.
- The user requests a production-ready payload for the TradeOS iOS app to consume.

## Workflow
- [ ] Receive the finalized arrays of `CostBookItems` and `Assemblies`.
- [ ] Construct the root JSON object containing the `items` and `assemblies` array containers.
- [ ] Iterate through all objects to ensure strict Swift `Codable` compatibility.
- [ ] Strip out or resolve any `null` values.
- [ ] Guarantee a clean, structurally sound payload without hanging references.
- [ ] Output the final string or save it directly to `Data/export/costbook.json`.

## Instructions
The resulting payload is the exact foundational JSON that the TradeOS Swift backend will ingest. It must be flawless to prevent `DecodingError` crashes in iOS.

### Swift Formatting Rules
1. **No Null Values**: Do not pass `"key": null` anywhere in the payload. Swift `Codable` handles nulls unpredictably unless implicitly coded as Optionals. 
   - If an optional field like `notes` is empty, either omit the key from the object entirely, or provide an empty string `""`.
2. **Type Strictness**:
   - `id` values MUST be strings.
   - `laborCost`, `materialCost`, `equipmentCost`, and `quantity` fields MUST be floating-point numbers (e.g., `4.50`), not strings wrapped in quotes (e.g., `"4.50"`).
3. **Root Wrapper**: The data must be wrapped in a single parent dictionary with `"items"` and `"assemblies"` arrays to match the expected root decoding struct.

### Final Export Data Shape
```json
{
  "items": [
    {
      "id": "uuid-string-here",
      "name": "Install 1/2in Drywall",
      "category": "Drywall",
      "unit": "SF",
      "laborCost": 1.25,
      "materialCost": 0.45,
      "equipmentCost": 0.0
      // Notice 'notes' is simply omitted rather than null
    }
  ],
  "assemblies": [
    {
      "id": "uuid-string-here",
      "name": "Standard Bathroom Remodel",
      "category": "Interiors",
      "lineItems": [
        {
          "costBookItemId": "uuid-string-here",
          "quantity": 350.0
        }
      ]
    }
  ]
}
```

## Resources
- Ensure absolute adherence to the "Processed Output Shape" found in `gemini.md`.
