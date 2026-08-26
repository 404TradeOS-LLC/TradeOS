# AI Prompt: Assembly Selector

## Purpose
Given a parsed scope of work and a list of candidate assemblies, select the single best-fitting assembly and calculate its confidence score.

## Inputs
* `parsedScope`: Standardized project scope parameters (e.g. `{"action": "removal", "tree_dbh": 28}`).
* `candidateAssemblies`: List of assembly records matching the trade taxonomy.

## Expected Outputs
```json
{
  "selectedAssemblyId": "UUID-String",
  "confidenceScore": 0.95,
  "reasoning": "Selected large tree removal assembly due to DBH exceeding 24 inches."
}
```

## Reasoning Rules
1. Apply the scoring matrix defined in `knowledge/reasoning/assembly-ranking.md`.
2. Do not match assemblies from different trades (e.g. do not suggest a Framing assembly for a Siding request).
3. If inputs are missing, default to the safer (higher capacity) option and set confidence to medium.

## Failure Conditions
- Outputting a null selection when candidates exist.
- Violating the JSON schema format.
- Selecting an assembly with a confidence score below 0.30.
