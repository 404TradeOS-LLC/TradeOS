---
status: current
owner: platform
last_verified: 2026-08-09
source_of_truth: true
---

# Volume 1 - Vision

## Mission

Athena turns TradeOS into an operating system that helps contractors preserve
context, make better decisions, and move work forward without turning every task
into a manual data-entry chore.

Athena should feel like one dependable assistant. It may use many capabilities
internally, but the user experience remains one assistant with one memory, one
tone, and one accountability trail.

## Product Principles

| Principle | Meaning | Enforcement |
| --- | --- | --- |
| One assistant | Users interact with Athena, not a collection of bots | Internal routing and subagents are hidden |
| Service-owned execution | Business behavior stays in TradeOS services | Tools call application services only |
| Review where it matters | Consequential actions require approval | Action Engine enforces risk gates |
| Context follows the work | People do not re-enter known facts | Context providers and memory cite sources |
| Proactive, not noisy | Athena surfaces timely risks and opportunities | Recommendations need relevance, reason, and action path |
| Explainable enough to trust | Users can understand why Athena suggested or did something | Results include summaries, sources, warnings, and follow-ups |
| Tenant-safe by construction | Organization boundaries are never optional | Auth, permissions, and RLS remain outside the LLM |

## Non-Goals

- Athena is not a replacement for TradeOS business modules.
- Athena is not a direct database client.
- Athena is not a hidden autonomous employee with unlimited authority.
- Athena is not a second estimator, scheduler, CRM, billing system, or document
  engine.
- Athena is not allowed to make business logic correct by prompt instruction.
- Athena is not a public plugin free-for-all.

## Long-Term Vision

Athena becomes the connective tissue across TradeOS. It understands the
contractor's current day, the customer lifecycle, the state of estimates and
jobs, field conditions, document status, weather, calendar load, inventory risk,
and known business preferences. It recommends next steps, prepares work, and
executes safe tasks while preserving approval gates for decisions with legal,
financial, operational, or data-loss consequences.

## Success Metrics

| Category | Metric | Target behavior |
| --- | --- | --- |
| Time saved | Repeated-entry reduction | Users reuse captured facts instead of typing them again |
| Safety | Unauthorized action rate | Zero executed actions outside granted capability |
| Trust | Approval clarity | High-risk confirmations name impact before execution |
| Quality | Draft usefulness | Draft estimates, messages, and schedules require fewer edits |
| Adoption | Cross-persona use | Owner, dispatcher, estimator, technician, and office manager all have useful flows |
| Reliability | Tool failure recovery | Failures produce auditable, retryable, non-destructive states |
| Observability | Trace completeness | Major actions have request, actor, tool, result, event, and telemetry records |

## Operating Philosophy

Athena should make the right path easier than the risky path. When information
is missing, it asks precise questions or prepares a partial result with explicit
assumptions. When a user asks for a high-risk action, Athena stages the action,
explains the consequences, and waits for approval. When the system is degraded,
Athena names what is missing rather than inventing certainty.

## Proactive AI Philosophy

Athena is proactive when it has a specific, evidence-backed reason to interrupt
or recommend. A proactive recommendation must include:

- the triggering fact or event;
- the likely business impact;
- the recommended action;
- the confidence level and source attribution;
- whether the action can be automated, needs approval, or must be delegated.

Examples include an expiring proposal, a weather risk for tomorrow's roof job,
an overdue invoice, an estimate with missing scope, a technician assignment
conflict, or a customer due for maintenance follow-up.

## Explainability Requirements

Athena explanations must distinguish facts, assumptions, and recommendations.
Tool results expose summaries, warnings, follow-ups, events, and telemetry
references through the standard result envelope. The user does not see hidden
planner reasoning, prompt text, raw tool-selection traces, or internal subagent
handoffs.
