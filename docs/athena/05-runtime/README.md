---
status: current
owner: platform
last_verified: 2026-08-09
source_of_truth: true
---

# Volume 5 - AI Runtime

## Kernel

The Athena kernel is the runtime coordinator for one assistant request. It owns
the lifecycle from authenticated request through context assembly, routing,
planning, policy evaluation, tool execution, result normalization, memory
operations, event handling, and response rendering.

## Runtime Lifecycle

1. Authenticate request through existing TradeOS auth.
2. Resolve organization membership and permissions outside the LLM.
3. Build immutable AI Context.
4. Route intent and determine candidate capabilities.
5. Plan tool calls and classify risk.
6. Evaluate policy and approval requirements.
7. Execute approved low-risk actions or present confirmation for gated actions.
8. Normalize tool results into the standard envelope.
9. Publish events for important business changes.
10. Write eligible memory with source attribution.
11. Emit telemetry and audit records.
12. Render user-visible response without internal orchestration details.

## Orchestration And Planning

Planning is hidden and non-authoritative. The planner can decompose work,
select candidate tools, ask clarifying questions, and propose risk classes. It
cannot authorize itself, invent business rules, mark approvals complete, or
execute unregistered tools.

## Execution Rules

| Concern | Runtime rule |
| --- | --- |
| Retries | Retry only idempotent operations or operations with an idempotency key |
| Timeouts | Every tool declares a timeout; timeout produces a failed tool result |
| Idempotency | Mutating tools require an idempotency key derived from action ID and target |
| Approval gates | Medium/high-risk policy decisions pause execution until approved |
| Rollback | Tools declare rollback availability; irreversible actions require stronger confirmation |
| Failure recovery | Preserve action state, errors, warnings, partial results, and safe next steps |
| Degraded mode | Continue with partial context only when the missing provider is non-critical |

## Approval States

| State | Meaning |
| --- | --- |
| `not_required` | Low-risk and policy permits automatic execution |
| `required` | Medium/high-risk or policy requires review |
| `granted` | Authorized actor explicitly approved the action |
| `denied` | Actor rejected the action |
| `expired` | Approval window elapsed |
| `revoked` | Approval was invalidated by state change or admin policy |

## Rollback Behavior

Rollback is not assumed. Each tool declares one of:

- `none`: action is irreversible or rollback is external/manual;
- `compensating_action`: a registered inverse or mitigation exists;
- `service_transaction`: application service can atomically abort before commit;
- `draft_only`: no production state changed.

High-risk actions with `none` rollback require explicit confirmation language
that states the irreversible effect.
