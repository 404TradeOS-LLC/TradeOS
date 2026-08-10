---
status: current
owner: platform
last_verified: 2026-08-09
source_of_truth: true
---

# Volume 13 - Deployment And Operations

Athena ships behind feature flags, capability flags, and approval policy gates.
Deployment must support staged rollout, observability, rollback, provider
fallback, and cost controls before production autonomy expands.

## Environments

| Environment | Purpose | Athena posture |
| --- | --- | --- |
| Local | Development and contract tests | Fake providers allowed; no production data |
| CI | Static, unit, contract, integration checks | No external side effects |
| Preview | Review and smoke tests | Feature flags limited; production-like auth where configured |
| Production beta | Controlled customer/org rollout | Low-risk only unless explicit approval flow is live |
| Production GA | Full governed rollout | All gates, telemetry, and incident playbooks active |

## Configuration And Feature Flags

Feature flags should separate kernel, registry, context providers, planner,
tool execution, memory writes, proactive recommendations, business tool groups,
plugin loading, and voice/mobile channels.

## Staged Rollout And Canary

Roll out by organization, persona, tool group, risk class, and environment.
Canary metrics include error rate, denied actions, approval abandonment, context
latency, tool latency, cost per request, memory write rate, and user feedback.

## Observability

Every request should correlate conversation ID, request ID, context version,
planner version, tool calls, action IDs, approval IDs, event IDs, memory IDs,
model/provider, token/cost metrics, and redacted errors.

Minimal observability starts in A1. A10 matures dashboards, exporters, alerts,
and long-term operational reporting; it does not introduce tracing for the first
time. Any executable Athena path must emit enough C011 telemetry to reconstruct
what was attempted, who initiated it, what policy decided, which model/provider
and tools were used, what it cost, and why it failed without storing private
chain-of-thought.

## Incident Response And Rollback

Incidents can disable individual tools, providers, memory writes, proactive
recommendations, plugins, model providers, or the entire Athena kernel.
Rollback must preserve audit records and pending approvals.

## Model And Provider Fallback

Fallback can switch model/provider only if contracts, safety behavior, latency,
cost, and data-retention policy remain compatible. High-risk confirmation
templates and policy decisions do not depend on model output.

## SLOs And SLIs

| SLI | Example target |
| --- | --- |
| Context assembly latency | p95 under the milestone budget |
| Tool success rate | Tool-specific, excluding policy denials |
| Unauthorized action execution | Zero |
| High-risk approval bypass | Zero |
| Trace completeness | Near-total for action-bearing requests |
| Cost per active org | Budgeted and alerting-backed |

Initial milestone budgets are gates, not permanent product promises. A1 starts
with minimal context and no production business tool fanout. A3 must define max
providers, max context bytes or estimated tokens, cache TTLs, and provider
timeouts before broad context ships. A5/A6 must define max plan steps, max tool
calls, retry count, and model/tool cost attribution before action execution
expands.

## Production Readiness Gates

- `athena:contracts` or equivalent contract validation passes.
- `athena:smoke` or equivalent no-op kernel smoke passes.
- Contracts C001-C012 validated.
- Kernel lifecycle, timeout, cancellation, and approval-payload binding tested.
- High-risk approval flow tested.
- Tenant isolation tests pass.
- Tool result envelope enforced.
- Minimal trace/cost telemetry live; dashboards required before production beta.
- Feature flags and rollback paths tested.
- Prompt-injection and adversarial tests pass.
- Admin memory retention/deletion controls available before memory writes.
