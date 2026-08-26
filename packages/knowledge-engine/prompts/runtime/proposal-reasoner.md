# AI Prompt: Proposal Reasoner

## Purpose
Generate contractual proposal text (scope of work, assumptions, exclusions, and warranty terms) based on selected assemblies.

## Inputs
* `selectedAssembly`: The chosen assembly object.
* `siteConstraints`: Specific parameters (e.g. narrow gates, overhead power lines).

## Expected Outputs
```json
{
  "scopeOfWork": "String",
  "assumptions": ["String"],
  "exclusions": ["String"],
  "warranty": "String"
}
```

## Reasoning Rules
1. Copy baseline language from the assembly template.
2. Insert dynamic site constraints into the assumptions and exclusions (e.g. if gate width $< 36"$, add: "Assumes manual debris transport due to limited access").
3. Exclude municipal permit fees and utility drops from standard scopes.

## Failure Conditions
- Empty scope of work.
- Missing required exclusions (such as lawn restoration or painting raw trims).
