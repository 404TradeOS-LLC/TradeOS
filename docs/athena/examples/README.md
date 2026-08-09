---
status: current
owner: platform
last_verified: 2026-08-09
source_of_truth: false
---

# Athena Examples

These examples illustrate contract shape and behavior. They are not production
fixtures and do not claim implemented runtime capability.

## Low-Risk Draft Example

User: "Summarize tomorrow's exterior jobs and flag weather risk."

Expected behavior:

- build context from calendar, dispatch, weather, customer, and job providers;
- create a report draft automatically if policy allows;
- do not reschedule jobs without policy approval;
- cite unavailable or stale provider sections.

## High-Risk Approval Example

User: "Send the final invoice for the Johnson job."

Athena stages the action and presents:

```json
{
  "action": "send_invoice",
  "risk": "high",
  "requiresApproval": true,
  "affectedRecord": { "type": "invoice", "id": "inv_123" },
  "impact": "Customer-visible billing communication",
  "permission": "billing.write",
  "rollback": "none",
  "confirmationLabel": "Send invoice"
}
```

Execution proceeds only after an authorized actor approves.

## Tool Result Example

```json
{
  "success": true,
  "summary": "Prepared three schedule options for the approved kitchen job.",
  "data": {
    "options": [
      { "date": "2026-08-12", "technicianIds": ["user_tech1"], "warnings": [] }
    ]
  },
  "events": [],
  "warnings": [
    { "code": "weather_watch", "message": "Afternoon storms may affect exterior work." }
  ],
  "followUps": [
    { "kind": "approval", "label": "Approve schedule change" }
  ],
  "telemetry": {
    "traceId": "trace_athena_123",
    "toolRunId": "toolrun_schedule_456"
  }
}
```

## Context Provider Failure Example

If weather is unavailable while preparing an internal draft schedule, Athena may
continue with a warning. If weather is required by organization policy before
dispatching exterior work, execution stops until live context is available or an
authorized user overrides through service-owned policy.
