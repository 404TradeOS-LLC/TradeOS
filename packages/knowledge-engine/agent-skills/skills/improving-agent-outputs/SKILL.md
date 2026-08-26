---
name: improving-agent-outputs
description: Analyzes rejected items and error reasons from validation passes to refine generation rules and update prompt constraints. Use to establish a self-healing feedback loop that continuously improves data quality.
---
# Improving Agent Outputs

## When to use this skill
- A generation batch resulted in a high volume of `rejectedItems` during validation or sanity checks.
- The user requests an analysis of recent failures to learn from mistakes.
- You are tasked with optimizing system guidelines for future generation passes.

## Workflow
- [ ] Receive inputs: Arrays of `rejectedItems` and their mapped `errorReasons`.
- [ ] Analyze the error data to identify patterns and root causes. (e.g., Are items failing because standard units like 'SF' were incorrectly formatted as 'SqFt'?)
- [ ] Synthesize the failure patterns into `refined generation rules`.
- [ ] Formulate strict `updated prompt constraints` that can be fed into future iterations of `generating-costbook-items`.
- [ ] Output the findings so the system or user can enforce the new constraints.

## Instructions
This skill powers the "self-healing" aspect of the automation framework. If the generator makes a mistake and the validator catches it, this skill ensures the mistake is never repeated.

### Feedback Loop Logic
1. **Identify Root Causes**: Look beyond the literal error. If an error states "Total cost is zero", the root cause might be an inability to estimate 'Site Prep' costs.
2. **Abstract the Rule**: Do not write fixes for specific line items; write global constraints that prevent the *class* of error.
   - *Weak Fix*: "Make sure tape measures have a price."
   - *Strong Rule*: "All items in the 'Tools' category must have a `materialCost` > 0.0 and `laborCost` equal to 0.0."
3. **Actionable Outputs**: Create directives that a language model can strictly obey in a master prompt context.

### Output Structure
Provide the synthesized directives in a structured format:
```json
{
  "analysis": "45% of failed items were rejected because the 'unit' field contained unmapped values like 'SqFt'. The generator did not aggressively conform to the allowed unit abbreviations.",
  "refinedGenerationRules": [
    "Rule 1: The 'unit' field is strictly limited to exact matches of allowed variables (e.g., 'SF', 'LF', 'EA'). Do not invent abbreviations."
  ],
  "updatedPromptConstraints": [
    "CONSTRAINT UPDATE: Before finalizing a JSON line item, cross-reference its 'unit' value against the master list in the schema. Reject output if it is not found."
  ]
}
```

## Resources
- Ensure derived rules do not natively contradict the baseline schemas dictated in `gemini.md`.
