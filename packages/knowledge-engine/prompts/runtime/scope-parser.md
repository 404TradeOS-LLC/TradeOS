# AI Prompt: Scope Parser

## Purpose
Extract structural parameters, dimensions, and materials from unstructured text, voice transcripts, or photo classifications.

## Inputs
* `intakePayload`: Text, voice transcription, or image labels.

## Expected Outputs
```json
{
  "dimensions": [
    { "type": "length | area | volume | DBH", "value": 150.0, "unit": "LF | SF | CY | IN" }
  ],
  "materials": ["wood", "concrete"],
  "siteConstraints": ["power lines close by"]
}
```

## Reasoning Rules
1. Rely on unit normalization mappings (e.g. converting "feet" $\rightarrow$ `LF`).
2. Identify implicit constraints (e.g. mentioning "overhead wires" maps to safety rigging dependencies).
3. If no dimensions are given, estimate standard averages based on project type and flag as `assumed`.

## Failure Conditions
- Missing values for explicitly stated parameters.
- Extrapolating unrealistic values (e.g., area $> 100,000$ SF for a residential house).
