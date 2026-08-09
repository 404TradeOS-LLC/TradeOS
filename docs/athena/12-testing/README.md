---
status: current
owner: platform
last_verified: 2026-08-09
source_of_truth: true
---

# Volume 12 - Testing Strategy

Athena testing proves boundaries, contracts, authorization, failure behavior,
and user-visible outcomes. Passing prompt demos are not enough.

## Test Layers

| Layer | Purpose |
| --- | --- |
| Unit tests | Pure policy, risk classification, schema validation, idempotency keys |
| Contract tests | C001-C012 compatibility and schema behavior |
| Integration tests | Tool to application service to event/telemetry path |
| End-to-end tests | User journeys across conversation, approval, and TradeOS UI/API |
| Authorization tests | Permission and approval denial/allow paths |
| Tenant isolation tests | Cross-org denial and RLS-backed protection |
| Tool tests | Input validation, timeout, retry, result envelope |
| Context provider tests | Freshness, partial context, provider failure |
| Planner tests | Registered-tool selection and unsafe-plan rejection |
| Failure/retry tests | Idempotency, duplicate prevention, DLQ behavior |
| AI evaluation | Helpfulness, grounding, missing-info behavior, refusal quality |
| Regression suites | Known bugs and contract compatibility |
| Prompt injection tests | Untrusted content cannot change authority |
| Adversarial tests | Abuse, data exfiltration, plugin misuse |
| Production smoke tests | Feature flags, health, no-op low-risk path |
| Performance/load tests | Context latency, tool throughput, cost ceilings |

## Required Negative Tests

- LLM-proposed database access is rejected.
- Tool absent from registry cannot execute.
- High-risk action without approval cannot execute.
- Cross-organization entity reference is denied.
- Stale context cannot finalize pricing, invoice, contract, deletion, refund, or
  permission changes.
- Untrusted content cannot create memory or override policy.
- Tool result missing standard envelope fails contract validation.

## AI Evaluation

AI evals should cover task success, source attribution, uncertainty handling,
missing information, action risk classification, approval wording, injection
resistance, and refusal of unsafe requests. Evals do not replace deterministic
authorization, tenant, contract, or service tests.
