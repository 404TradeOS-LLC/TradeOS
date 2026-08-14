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

## A1 Kernel Contract

A1 implements the runtime shell only. It must not execute production business
tools, persist long-term memory, hydrate broad business context, or mutate
TradeOS records. The A1 kernel is ready only when it can create an execution
record, carry server-derived actor/org context, apply timeouts and
cancellation, emit minimal telemetry, and return a safe no-op or draft response.

Every kernel execution has:

- `executionId`, `requestId`, `traceId`, `orgId`, actor, role, and request
  source derived from authenticated server context;
- a persisted lifecycle state and timestamp history;
- normalized user-safe error output;
- bounded minimal context containing request, organization, user, permissions,
  conversation reference, and telemetry metadata;
- no authority to approve, authorize, or mutate based on model output.

## Current Runtime Posture

As of Friday, August 14, 2026, the runtime on `main` has moved past the
original A1-only posture. The kernel route is live behind flags, the router and
planner path is wired, the action engine can execute approved tool steps, and
the production registry/context-provider seams are real. The conservative
operating boundary remains the same: approvals stay fail-closed by default, and
feature flags still control reachability of the newer surfaces.

## Lifecycle State Machine

| State | Meaning | Allowed next states |
| --- | --- | --- |
| `created` | Execution record exists but no model/provider work has started | `context_building`, `cancelled`, `failed` |
| `context_building` | Minimal or provider-backed context is being assembled | `routing`, `degraded`, `failed`, `cancelled` |
| `routing` | Intent and candidate capability routing is in progress | `planning`, `needs_clarification`, `failed`, `cancelled` |
| `planning` | Planner is producing a hidden plan, not executing it | `policy_check`, `needs_clarification`, `failed`, `cancelled` |
| `policy_check` | Server policy evaluates permissions, risk, and approvals | `awaiting_approval`, `executing`, `denied`, `failed`, `cancelled` |
| `awaiting_approval` | Execution is paused until a valid approval arrives | `executing`, `expired`, `denied`, `cancelled` |
| `executing` | Approved tool/action steps are running | `succeeded`, `partially_succeeded`, `failed`, `cancelled` |
| `degraded` | Non-critical context/provider failure was tolerated | `routing`, `planning`, `failed`, `cancelled` |
| `needs_clarification` | User input is required before planning can continue | `context_building`, `cancelled` |
| `partially_succeeded` | Some steps completed and at least one step failed or paused | `awaiting_approval`, `failed`, `succeeded`, `cancelled` |
| `succeeded` | Execution reached a terminal successful outcome | none |
| `failed` | Execution reached a terminal failed outcome | none |
| `denied` | Policy or user denied the requested action | none |
| `expired` | Approval or execution window expired | none |
| `cancelled` | User, system, timeout, or shutdown cancelled the execution | none |

Terminal states are immutable. Resuming an execution from a non-terminal state
requires a persisted checkpoint, the same `orgId`, a valid actor or service
principal, and a fresh policy check before any mutation.

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
| Compensation | Tools declare rollback/compensation availability; irreversible actions require stronger confirmation |
| Failure recovery | Preserve action state, errors, warnings, partial results, and safe next steps |
| Degraded mode | Continue with partial context only when the missing provider is non-critical |

## Execution Context, Timeout, And Cancellation

Tool execution receives an execution context separate from AI Context. It must
include `executionId`, `requestId`, `traceId`, `deadline`, cancellation signal,
actor, organization, role, approval state, feature flags, and telemetry sink.

Timeouts fail closed for mutating actions. A timed-out action cannot later
return success unless the application service proves the same idempotency key
already committed the intended business outcome. Tools must check cancellation
before mutation, before external calls, and before returning success.

Shutdown behavior is conservative:

- non-mutating draft work may be abandoned with a safe retry message;
- pending approvals remain pending or expire according to policy;
- running mutating actions finish only through an idempotent application service
  path or enter `failed` with manual-repair metadata;
- no shutdown handler may bypass authorization, RLS, or audit writes.

## Approval States

| State | Meaning |
| --- | --- |
| `not_required` | Low-risk and policy permits automatic execution |
| `required` | Medium/high-risk or policy requires review |
| `granted` | Authorized actor explicitly approved the action |
| `denied` | Actor rejected the action |
| `expired` | Approval window elapsed |
| `revoked` | Approval was invalidated by state change or admin policy |

## Compensation Behavior

Rollback is not assumed. Each tool declares one compensation policy:

- `none`: action is irreversible or rollback is external/manual;
- `compensating_action`: a registered inverse or mitigation exists;
- `service_transaction`: application service can atomically abort before commit;
- `draft_only`: no production state changed.

High-risk actions with `none` rollback require explicit confirmation language
that states the irreversible effect.
