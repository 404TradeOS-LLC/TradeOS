---
status: current
owner: platform
last_verified: 2026-08-10
source_of_truth: true
---

# Volume 6 - Tool Registry And Tool SDK

The Tool Registry is Athena's executable capability catalog. A tool is a stable,
versioned adapter that validates inputs, checks policy, calls an application
service, and returns the standard tool result envelope.

## Tool Interface

```ts
export interface AthenaTool<TInput, TData> {
  id: string;
  version: string;
  name: string;
  category: "system" | "estimator" | "dispatcher" | "office" | "field" | "costbook" | "fixture";
  description: string;
  risk: "low" | "medium" | "high";
  permissions: string[];
  confirmationPolicy: "never" | "contextual" | "always";
  timeoutMs: number;
  idempotency: "required" | "optional" | "not_supported";
  compensationPolicy: "none" | "compensating_action" | "service_transaction" | "draft_only";
  inputSchema: unknown;
  outputSchema: "AthenaToolResult";
  execute(
    input: TInput,
    aiContext: AthenaAIContext,
    execution: AthenaToolExecutionContext
  ): Promise<AthenaToolResult<TData>>;
}
```

`AthenaToolExecutionContext` is separate from AI Context. It carries
server-derived actor, organization, role, request ID, execution ID, trace ID,
deadline, cancellation signal, approval state, and feature flags. Mutating tools
must check timeout/cancellation before mutation and before returning success.

## Registration And Discovery

Tools register with metadata, schemas, permission requirements, risk class,
owner, version, deprecation status, and service dependency. Discovery returns
only tools permitted for the authenticated user, organization, feature flags,
and plugin policy.

Newly authored v1 tools should provide `name`, `category`, and `outputSchema`
explicitly. For compatibility with older hand-written definitions, the raw
`AthenaToolDefinition` registration shape may omit those three discovery fields;
the registry validates the raw definition and normalizes them before storage.
Every resolved or discovered `AthenaRegisteredToolDefinition` therefore has a
non-empty `name`, a closed Athena `category`, and `outputSchema: "AthenaToolResult"`.

## Required Metadata

| Field | Required behavior |
| --- | --- |
| `id` | Stable reverse-domain or namespaced ID |
| `version` | Semver-compatible contract version |
| `owner` | First-party module or approved plugin |
| `name` | Human-readable tool/action name; authored v1 tools provide it, legacy registrations are normalized |
| `category` | Closed Athena tool category: system, estimator, dispatcher, office, field, costbook, or fixture; legacy registrations are normalized |
| `permissions` | TradeOS permissions/capabilities required |
| `risk` | Low, medium, or high default risk |
| `confirmationPolicy` | Whether approval is never/contextual/always required |
| `inputSchema` | Runtime-validated shape |
| `outputSchema` | Standard result envelope; defaults to `AthenaToolResult` only for legacy raw registrations |
| `timeoutMs` | Maximum execution time |
| `idempotency` | Required for mutating tools |
| `compensationPolicy` | None, compensating action, service transaction, or draft only |

## Confirmation Policy

Tool risk is the default. The Action Engine may raise the required approval
level based on amount, legal effect, customer visibility, destructive impact,
low confidence, stale context, plugin source, or organization policy. It may not
lower a high-risk tool below explicit approval.

## Version 1 Required Versus Deferred Metadata

Required for newly authored v1 tools: ID, version, owner, name, category,
permissions, risk, confirmation policy, timeout, idempotency policy, input
schema, output schema, standard result envelope, service dependency, and
compensation policy. Legacy raw registrations may omit only `name`, `category`,
and `outputSchema`; the registry supplies those values in the normalized
registered definition.

Optional in v1: feature flag, deprecation notice, model hints, cost estimate,
and first-party helper metadata.

Deferred until the plugin milestone: marketplace metadata, external commercial
terms, third-party distribution, and generalized provider compatibility.

## Versioning And Deprecation

- Breaking changes require a new major version.
- Compatible additions must be optional.
- Deprecated tools declare replacement, sunset date, and migration notes.
- Consumers pin major versions.
- Removed tools remain blocked with a structured error rather than silently
  disappearing from historical action records.

## Third-Party Tool Lifecycle

Third-party tools require manifest review, permission review, sandbox policy,
event and telemetry review, test evidence, install approval, organization-level
grant, ongoing compatibility checks, and revocation support.

## First-Party Tool SDK (A9)

`app/modules/athena-tool-sdk` is a first-party-only authoring layer over
everything above. It is not a second tool architecture: `defineTool()`
produces an ordinary `AthenaToolDefinition` (this volume's own interface,
narrowed to A2's concrete Zod-based shape in
`app/modules/athena-tool-registry/types.ts`), consumed by the exact same
registry, permission policy, and Action Engine as a tool written by hand.
Writing a direct `AthenaToolDefinition` object remains fully supported - the
SDK is the recommended path, not a required one. See
`docs/athena/roadmap/A9-tool-sdk-implementation-plan.md` for the full design
record.

### Create your first Athena tool

```ts
import { z } from "zod";
import { defineTool, successResult, failureResult, warning, followUp } from "../athena-tool-sdk";
import type { SomeApplicationService } from "../some-domain/service";

const inputSchema = z.object({ jobId: z.string() });

export function createExampleTool(deps: { someService: Pick<SomeApplicationService, "getSummary"> }) {
  return defineTool({
    id: "tradeos.example.readSomething",
    version: "1.0.0",
    owner: "platform",
    name: "Read Something",
    category: "system",
    description: "Example first-party tool.",
    permissions: ["example.read"],
    risk: "low",
    confirmationPolicy: "never",
    timeoutMs: 5_000,
    idempotency: "not_supported",
    compensationPolicy: "none",
    inputSchema,
    outputSchema: "AthenaToolResult",
    async execute(input, _aiContext, execution) {
      const telemetry = { traceId: execution.traceId, executionId: execution.executionId };
      const summary = await deps.someService.getSummary(execution.orgId, input.jobId);
      if (!summary) {
        return successResult({
          summary: "No summary found yet.",
          data: null,
          telemetry,
          warnings: [warning({ code: "summary_missing", message: "This job has no summary yet." })],
          followUps: [followUp({ kind: "question", label: "Would you like to generate one?" })],
        });
      }
      return successResult({ summary: "Found the job summary.", data: summary, telemetry });
    },
  });
}
```

### First-party production path

As of Friday, August 14, 2026, the concrete first-party authoring flow in the
current repository implementation is:

1. add the tool under `app/modules/athena-tools/**`;
2. author it with `defineTool()` or a direct `AthenaToolDefinition`;
3. inject only application-service dependencies;
4. register it in `createProductionAthenaToolRegistry()` in
   `app/modules/athena-tools/registry.ts`;
5. add focused contract and service-level tests.

Authoring steps: (1) identify the application service the tool calls - never
Prisma/a raw tenant DB client directly; (2) define the input schema with Zod
(`input`'s type inside `execute()` is inferred from it, no hand-written
duplicate `Input` type); (3) declare the required A2 metadata (`permissions`,
`risk`, `confirmationPolicy`, `timeoutMs`, `idempotency`,
`compensationPolicy`) - `risk`/`confirmationPolicy` are metadata, not an
authorization decision, A4 still evaluates every dispatch; (4) inject the
service(s) the tool needs as explicit constructor parameters, never through a
global locator; (5) implement `execute()`, returning `successResult()` or
`failureResult()`; (6) if the called service published a canonical event,
wrap its `{ type, id }` with `eventRef()` inside the result's `events` -
never publish one yourself (A8 event ownership stays service-owned, see
`docs/athena/10-events/README.md`); (7) register the returned definition with
the ordinary A2 registry, exactly like a direct definition; (8) run
`describeAthenaToolContract(tool, { validInput, invalidInputs })` from
`athena-tool-sdk` in a test file so the tool proves baseline registry/
dispatch/permission/result-envelope compliance.

### Prohibited patterns

A first-party tool authored with this SDK (or directly against A2) must not:

- access Prisma or a raw tenant database client directly;
- infer `orgId`, actor identity, or role from tool input - these come only
  from the server-derived `AthenaToolExecutionContext`;
- bypass A4 policy or manually re-invoke A6 action execution recursively;
- construct an arbitrary result envelope or an undocumented top-level result
  field - use `successResult()`/`failureResult()`, which cannot add one;
- publish an arbitrary canonical business event, or fabricate an
  `AthenaEventReference` for an event that was never actually published by a
  service;
- embed hidden LLM reasoning, log secrets/raw prompts, or store secrets in a
  result;
- become a replacement application/business service - business logic and
  persistence stay in the domain service the tool calls;
- rely on a global/hidden service locator for its dependencies.

### A12/A13 relationship

A9 is intentionally sufficient for A12's future first-party business tools
(CRM, estimating, dispatch, billing) to be authored without a new foundational
framework - none of those tools are implemented by A9 itself. A9 is also
strictly first-party: it has no manifest, marketplace, publisher-identity, or
sandbox concept. A13's future third-party Plugin SDK is a distinct, later
milestone that may build on A9's contracts; A9 does not anticipate or
implement any part of it.
