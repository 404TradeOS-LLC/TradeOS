---
status: draft
owner: platform
last_verified: 2026-08-10
source_of_truth: true
related_docs:
  - ../README.md
  - ../roadmap.md
  - ../06-tool-registry/README.md
  - ../10-events/README.md
  - ../11-plugin-sdk/README.md
  - ../12-testing/README.md
  - ../contracts/README.md
  - A2-tool-registry-implementation-plan.md
  - A6-action-engine-implementation-plan.md
  - ../../TRADEOS_BIBLE.md
---

# A9 Tool SDK Implementation Plan

Milestone: A9 - First-party Tool SDK
Purpose: make authoring a conformant first-party `AthenaToolDefinition`
(A2, C002/C003) safe, strongly typed, and hard to misuse, without creating any
new runtime, registry, dispatcher, or authority path. A9 is a compile-time and
authoring-ergonomics layer over the architecture A2 (registry), A4
(permissions), A6 (action engine), and A8 (event ownership) already
established; it produces ordinary A2 tool definitions and nothing else.
Implementation posture: authoring-only, zero runtime behavior change to A2/A6,
direct A2 definitions remain fully supported, contract-test-gated.

## Dependency baseline

A9 depends on A2, A6, and A8 per `docs/athena/roadmap.md`. A1-A7 are merged to
`main`. A8 (event integration) is a parallel, independently-tracked
in-progress workstream at the time this plan is written. A9 does not require
A8's runtime publisher/subscriber infrastructure to exist: the only A8-owned
surface A9 touches is the `AthenaEventReference` shape, which A2 already
defines (`app/modules/athena-tool-registry/types.ts`) as part of C003's tool
result envelope. A9's event helper only ever constructs that reference type;
it has no dependency on how or whether an event was actually published. If
A8's publisher/subscriber code is not yet present when A9 lands, nothing in
this milestone is blocked or degraded - the event-reference helper's contract
is already stable via A2/C008.

## Non-goals (explicit exclusions)

- No new tool registry, dispatcher, or Action Engine. A9 produces values; A2
  registers and dispatches them exactly as it does any direct definition.
- No new event bus or generic `emitEvent()`/`publishDomainEvent()`. A9 may
  only construct `AthenaEventReference` values; canonical business events
  remain application-service-owned per A8/ADR-007.
- No database or Prisma access from SDK-authored tools. The execution context
  A9 exposes is the exact `AthenaToolExecutionContext` A2 already defines -
  no Prisma client, no request-scoped transaction handle.
- No global service locator. Service dependencies are explicit closures over
  `defineTool`, the same pattern `athena-memory/service.ts`'s
  `createAthenaMemoryService(deps)` already establishes for this codebase.
- No new error taxonomy. Failure helpers build the existing `AthenaToolError`
  (`validation | authorization | conflict | timeout | provider | service |
  unknown`) - the same categories `athena-tool-registry/errors.ts`,
  `athena-action-engine/errors.ts`, and `athena-memory/errors.ts` already use.
- No telemetry system, no A10 observability, no A11 security platform, no A12
  business tools, no A13 plugin manifests/marketplace.
- No duplicate registry validation. `assertValidToolDefinition`
  (`athena-tool-registry/registry.ts`) is exported and reused by A9's
  contract-test kit rather than reimplemented.

## Public API surface

Single entrypoint: `app/modules/athena-tool-sdk/index.ts`.

```ts
import { defineTool, successResult, failureResult, eventRef, warning, followUp, describeAthenaToolContract } from "../athena-tool-sdk";
```

- `defineTool(options)` - Zod-schema-typed builder. `options.inputSchema` is a
  real `z.ZodTypeAny`; `execute`'s `input` parameter and the returned
  `AthenaToolResult`'s `data` are both inferred, not hand-declared. The
  returned value's runtime shape is byte-for-byte an `AthenaToolDefinition`
  (no wrapper object, no lazy getter, no extra fields) - `app/modules/
  athena-tool-registry/registry.ts`'s `register()` accepts it with zero
  special-casing, proven by a regression test registering/resolving/
  dispatching both an SDK-defined and a hand-written direct A2 definition
  side by side.
- `successResult(input)` / `failureResult(input)` - typed `AthenaToolResult`
  builders. Both preserve the caller's `TData` type parameter, default
  `events`/`warnings`/`followUps` to `[]` when omitted, and require the
  caller to pass `telemetry` explicitly (sourced from the tool's own
  `AthenaToolExecutionContext.traceId`/`executionId`) rather than fabricating
  one - the dispatcher/action engine already overwrite `telemetry` and
  `error.correlationId` with the active dispatch context regardless (see
  `dispatcher.ts`'s "Never trust a tool's own telemetry" comment), so this
  keeps the SDK honest about that instead of hiding it.
- `eventRef(type, id)` - constructs `AthenaEventReference` only. No publish
  side effect exists on this helper; it cannot call any event bus because A9
  ships none.
- `warning(input)` / `followUp(input)` - thin typed constructors for the
  existing `AthenaWarning`/`AthenaFollowUp` shapes. No new fields.
- `describeAthenaToolContract(tool, options)` - Jest `describe` wrapper around
  reusable assertion functions that register the tool into a real
  `createAthenaToolRegistry()`, resolve it, and dispatch it through the real
  `dispatchAthenaTool()` - the actual A2 runtime boundary, not a mock.

## Service dependency model

Explicit closures, not a builder/factory macro. A tool author who needs an
application service writes:

```ts
export function createRecallPreferenceTool(deps: { memoryService: AthenaMemoryService }) {
  return defineTool({
    /* ... */
    async execute(input, aiContext, execution) {
      const record = await deps.memoryService.recall({ ... });
      /* ... */
    },
  });
}
```

This is the smallest pattern consistent with the repository: it is exactly
`athena-memory/service.ts`'s own `createAthenaMemoryService(deps)` shape, just
applied one level up at the tool-authoring layer. A9 deliberately does not add
a `createToolFactory()` wrapper around this - a plain closure already gives
explicit, reason-about-able, test-injectable dependencies without adding a new
DI concept to the codebase.

## Contract-test kit

`describeAthenaToolContract` is a thin Jest layer over exported assertion
functions (`assertToolDefinitionShape`, `assertToolRegistersAndDispatches`,
...) so the underlying checks are independently callable - this is what lets
A9's own test suite prove a deliberately malformed fixture *fails* the kit
(`expect(() => assertX(malformed)).toThrow()`) without nesting a Jest suite
that fails CI on purpose. Metadata-shape assertions delegate to A2's own
exported `assertValidToolDefinition` and result-envelope assertions delegate
to A2's own exported `assertValidAthenaToolResult` - the kit does not carry a
second copy of either validator.

## Reference/fixture tool

`app/modules/athena-tool-sdk/fixtures/recallPreferenceTool.ts` -
`tradeos.athena.tools.recall-preference`, a read-only, low-risk tool that
recalls a user-scoped preference through the real, already-merged
`AthenaMemoryService` (A7). It is Athena infrastructure, not a business
domain tool (no CRM/estimating/dispatch/billing surface), matching this plan's
"prefer infrastructure fixture over business tool" requirement. It
demonstrates schema inference, explicit service DI, execution-context use
(`orgId`, `actor`), a `successResult` with `data: null` plus a `warning()`
when no preference is recorded, and passes `describeAthenaToolContract`. It
does not construct an `AthenaEventReference` - recalling a preference is a
read with no business event to reference, and fabricating one would violate
A8 ownership, so the SDK does not force one.

## Test plan

See the task brief's full enumerated list (55 items across definition/typing,
registry compatibility, inputs, results, events, execution context, services,
permission/action behavior, contract suite, and regression). Concretely:

- `athena-tool-sdk.defineTool.test.ts` - typing/definition + direct-A2
  compatibility regression.
- `athena-tool-sdk.results.test.ts` - success/failure/warning/followUp/eventRef
  envelope correctness.
- `athena-tool-sdk.contracts.test.ts` - the `athena:contracts`-gated suite:
  reference tool passes `describeAthenaToolContract`; a deliberately malformed
  fixture fails the underlying assertions; direct A2 fixtures also pass.
- `athena-tool-sdk.import-boundary.test.ts` - mirrors A2's own import-boundary
  test: no Prisma/db/service imports from SDK core modules.
- `athena-tool-sdk.types.test.ts` - compile-time-only `@ts-expect-error`
  assertions for inferred input typing and invalid metadata literals.

## Independent adversarial review

An independent review pass (separate from the implementing session) checked
the ten architecture-invariant questions this plan is graded against (second
tool-definition model, duplicated A2 validation, DB access, A4 bypass, A6
bypass, A8 event fabrication, direct-A2 compatibility, ease-of-correct-use,
A12 readiness, A10/A11/A12/A13 scope leak) plus swallowed-error, leaked-secret,
and strawman-fixture checks. No critical or high findings. Two medium
findings, both fixed in this branch:

- `assertToolExecutesValidInput`'s default contract role ("owner", which
  holds every permission) could make an incorrect `permissions` declaration
  look correct, since the default always satisfies any declared list.
  Fixed: added `assertToolDeniedWithoutRequiredPermissions`, wired into
  `describeAthenaToolContract` whenever a tool declares at least one
  permission - it finds a canonical role that does not hold every declared
  permission and asserts A4 actually denies it.
- Both execution-path assertions auto-grant a tool's own
  `requiredFeatureFlags` into the request for convenience, which never
  exercised the "flag missing" path. Fixed: added
  `assertToolDeniedWithoutRequiredFeatureFlags`, wired in whenever a tool
  declares at least one required flag - it dispatches with an empty
  `featureFlags` array and asserts the tool is blocked.

Both fixes are covered by `athena-tool-sdk.contracts.test.ts`'s medium-risk
test tool, which declares a real permission (`team.manage`) and a real
required flag specifically to exercise this new coverage.

## Exit criteria

A freshly-authored (not copy-pasted-unchanged) reference tool built with
`defineTool` registers in the ordinary A2 registry, resolves normally,
dispatches through the ordinary A2 dispatcher, and passes
`describeAthenaToolContract`. A directly-defined A2 tool continues to
register/resolve/dispatch unchanged. `npm run athena:contracts` covers this
module alongside kernel/tool-registry/context-engine/permissions/planner/
action-engine/memory.
