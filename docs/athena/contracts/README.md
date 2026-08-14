---
status: current
owner: platform
last_verified: 2026-08-14
source_of_truth: true
---

# Athena Platform Contracts

All Athena contracts are versioned. Compatible additions are optional fields.
Breaking changes require a new major version and migration notes. Runtime
validation must reject undocumented arbitrary response shapes.

## Standard Tool Result Envelope

All tools return this envelope. No tool may return an undocumented arbitrary
shape.

```ts
export interface AthenaToolResult<TData = unknown> {
  success: boolean;
  summary: string;
  data: TData | null;
  events: AthenaEventReference[];
  warnings: AthenaWarning[];
  followUps: AthenaFollowUp[];
  telemetry: AthenaTelemetryReference;
  error?: AthenaToolError;
}
```

## C001 AI Context v1.0.0

Purpose: immutable request context snapshot. See the runtime types under
`app/modules/athena-context` and `app/modules/athena-kernel` for the complete
provider-section contract.

## C002 Tool v1.0.0

Purpose: registered executable capability.

`AthenaToolDefinition` is the raw registration/authoring contract. Newly authored
v1 tools should provide `name`, `category`, and `outputSchema` explicitly, but
legacy hand-written registrations may omit those three discovery fields for
backward compatibility. The registry validates the raw definition and then
normalizes it into `AthenaRegisteredToolDefinition`, where `name`, `category`,
and `outputSchema` are always present.

```ts
export interface AthenaToolDefinition {
  id: string;
  version: string;
  owner: string;
  name?: string;
  category?: "system" | "estimator" | "dispatcher" | "office" | "field" | "costbook" | "fixture";
  description: string;
  permissions: string[];
  risk: "low" | "medium" | "high";
  confirmationPolicy: "never" | "contextual" | "always";
  timeoutMs: number;
  idempotency: "required" | "optional" | "not_supported";
  compensationPolicy: "none" | "compensating_action" | "service_transaction" | "draft_only";
  inputSchema: Record<string, unknown>;
  outputSchema?: "AthenaToolResult";
}

export interface AthenaRegisteredToolDefinition extends AthenaToolDefinition {
  name: string;
  category: "system" | "estimator" | "dispatcher" | "office" | "field" | "costbook" | "fixture";
  outputSchema: "AthenaToolResult";
}
```

Required on the raw registration contract: `id`, `version`, `owner`,
`permissions`, `risk`, `confirmationPolicy`, `timeoutMs`, `idempotency`,
`inputSchema`, and `compensationPolicy`. Newly authored v1 tools also provide
`name`, `category`, and `outputSchema`; only legacy compatibility paths may omit
those fields and rely on normalization. Resolved/discovered registered tools
always expose the normalized required metadata.

## C003 Tool Result v1.0.0

Purpose: standard tool output envelope. Required top-level fields are `success`,
`summary`, `data`, `events`, `warnings`, `followUps`, and `telemetry`; optional
tool-specific fields belong only inside documented `data`.

## C004 Planner v1.0.0

Purpose: hidden plan shape produced before execution. Planners may reference
registered tool versions and approvals, but they do not execute actions.

## C005 Action v1.0.0

Purpose: approved executable unit.

```ts
export interface AthenaAction {
  id: string;
  version: "1.0.0";
  orgId: string;
  actorUserId: string;
  name: string;
  toolId: string;
  toolVersion: string;
  input: unknown;
  risk: "low" | "medium" | "high";
  approvalRequirement: "not_required" | "required";
  approvalId?: string;
  idempotencyKey: string;
  status: "created" | "pending" | "running" | "awaiting_approval" | "partially_succeeded" | "succeeded" | "failed" | "denied" | "expired" | "cancelled";
  attempt: number;
  executor: {
    kind: "tool";
    name: string;
    category: "system" | "estimator" | "dispatcher" | "office" | "field" | "costbook" | "fixture";
    toolId: string;
    toolVersion: string;
  };
  checkpoint?: Record<string, unknown>;
  compensationPolicy: "none" | "compensating_action" | "service_transaction" | "draft_only";
  lastError?: AthenaToolError;
}
```

Required: action ID, org, actor, action name, tool, risk, approval requirement,
idempotency key, status, attempt, executor, and compensation policy. Optional:
approval ID, checkpoint, and last error. An approval-required action may omit an
approval ID only before execution (for example while `awaiting_approval`); an
action whose approval requirement is `not_required` must not carry approval
evidence.

## C006-C011

The remaining numbered contracts retain their existing versioned semantics and
source ownership. Their runtime definitions remain authoritative in the Athena
module types and validators referenced throughout this documentation set.
