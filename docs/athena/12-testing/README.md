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

## Named Athena Gates

These commands are contract names until implemented in CI. A milestone may not
claim production readiness by relying only on generic app/web checks once its
Athena surface exists.

| Gate | Required before | Purpose |
| --- | --- | --- |
| `npm run athena:contracts` | A1 exit | Validate C001-C012 shapes, lifecycle states, tool result envelope, and compatibility rules |
| `npm run athena:smoke` | A1 exit | Exercise feature-flagged no-op kernel path with authenticated org/user context |
| `npm run athena:eval` | A5 exit | Evaluate routing/planning quality, grounding, refusal, ambiguity, and injection resistance |
| `npm run athena:perf` | A3 exit, then A5/A6 | Enforce context, planner, model, and tool fanout budgets |

Until these commands exist, the milestone checklist must list the missing gate
as an explicit blocker or non-production limitation.

## Required Negative Tests

- LLM-proposed database access is rejected.
- Tool absent from registry cannot execute.
- High-risk action without approval cannot execute.
- Cross-organization entity reference is denied.
- Stale context cannot finalize pricing, invoice, contract, deletion, refund, or
  permission changes.
- Untrusted content cannot create memory or override policy.
- Tool result missing standard envelope fails contract validation.
- Timed-out or cancelled tool execution cannot later report success without
  idempotent service proof.
- Context provider cache cannot return data across organizations, actors,
  permission snapshots, selected scopes, or provider versions.
- Field-technician context providers return only assigned job/project data.
- Approval cannot be reused after action payload, target, tool version, or
  expiration changes.

## AI Evaluation

AI evals should cover task success, source attribution, uncertainty handling,
missing information, action risk classification, approval wording, injection
resistance, and refusal of unsafe requests. Evals do not replace deterministic
authorization, tenant, contract, or service tests.
