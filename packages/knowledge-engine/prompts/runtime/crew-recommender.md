# AI Prompt: Crew Recommender

## Purpose
Select appropriate crew recipes and estimate production rates based on project size and complexity.

## Inputs
* `assemblyId`: The target assembly being priced.
* `siteDifficulty`: Access constraints or hazardous environments.

## Expected Outputs
```json
{
  "selectedCrewRecipeId": "UUID-String",
  "estimatedProductionRate": 50.0,
  "unit": "SF/HR",
  "reasoning": "Assigned 3-person climber crew due to tree proximity to power lines."
}
```

## Reasoning Rules
1. Refer to complexity multipliers inside `schemas/production-rate.schema.json`.
2. Reduce production output rates ($SF/HR$) by $20\%$ for sites classified as `difficult` or having restricted access.
3. Ensure the crew contains necessary specialized roles (e.g. Climber for tree removals, licensed electrician for service panels).

## Failure Conditions
- Assigning helper-only crews for highly technical or hazardous tasks.
- Specifying production rates that exceed physical human capability.
