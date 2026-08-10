---
status: draft
owner: platform
last_verified: 2026-08-09
source_of_truth: true
related_docs:
  - ../README.md
  - ../roadmap.md
  - ../05-runtime/README.md
  - ../06-tool-registry/README.md
  - ../09-security/README.md
  - ../12-testing/README.md
  - ../contracts/README.md
  - ../reviews/A0.5-architecture-review.md
  - ../reviews/A1-parallel-readiness-review.md
  - A1-ai-kernel-implementation-plan.md
  - ../../TRADEOS_BIBLE.md
  - ../../ARCHITECTURE.md
  - ../../RBAC_MATRIX.md
---

# A2 Tool Registry Implementation Plan

Milestone: A2 - Tool Registry
Purpose: convert the A1 kernel foundation into a first-party, no-business-tools
registry that proves tool identity, versioning, the standard result envelope,
and deterministic (non-LLM) permission/risk enforcement, before any real
tool is wired into a live request path.
Implementation posture: backend-first, feature-flagged, non-mutating,
fixture-only, contract-test-gated.

## A1 Acceptance Summary

This plan was written after a post-A1 acceptance review of `eaeed1d` (PR #101,
merged to `main`). Full findings are recorded in the session report; the
verdict is **PASS**. Every exit criterion in
`A1-ai-kernel-implementation-plan.md`'s "Exact A1 Exit Criteria" was verified
against live code and passing tests, not against documentation claims:

- The kernel route is dark by default (`ATHENA_KERNEL_ENABLED`,
  `app/modules/athena-kernel/flags.ts`) and mounted behind the existing
  `requireAuth`/`databaseSession` chain (`app/backend/server.ts:76,108`).
- Execution records and transition history persist through an
  application-service-owned seam (`app/modules/athena-kernel/executionStore.ts`)
  backed by a real, RLS-forced migration
  (`app/prisma/migrations/20260809120000_add_athena_kernel_execution/migration.sql`),
  with live RLS integration coverage in `app/tests/athena-kernel.integration.ts`
  proving actor-level (not just org-level) isolation.
- The kernel-owned `AbortController` is constructed at kernel entry and is
  explicitly independent of `databaseSession.ts`'s response-lifecycle
  listeners, closing HIGH-P1/HIGH-P5 from the parallel readiness review for
  A1's own scope.
- `athena:contracts` and `athena:smoke` exist and are wired into
  `.github/workflows/verify-repository.yml` as required steps, closing
  HIGH-006 (A0.5 review) and MEDIUM-5 (parallel readiness review).
- The clarification/degraded round-trip cycle is capped and tested
  (`ATHENA_DEFAULT_MAX_ROUND_TRIPS`), closing MEDIUM-3.
- The policy adapter normalizes roles itself and never imports
  `requestContext.ts`'s Express-bound helpers, closing MEDIUM-1/MEDIUM-2.
- Telemetry records are runtime-shape-validated (`assertValidTelemetryRecord`)
  against C011 before they can be persisted, closing HIGH-P4.
- No production business tool, memory, plugin, broad context provider, or
  autonomous write path shipped.

Two items are carried forward as named prerequisites rather than corrections,
because A1 does not need to solve them yet:

- **Pre-A2/A6 transaction prerequisite (HIGH-P1):** the ambient per-request
  Prisma transaction (`app/db/requestSession.ts`,
  `app/backend/middleware/databaseSession.ts`) still has a 60s default
  timeout and no connection-pool limit. A1's own execution store deliberately
  reuses it because A1 has no pausable/mutating work
  (`executionStore.ts`'s file comment says so explicitly). This plan carries
  that prerequisite into A2's tool-dispatch design below.
- **Pre-A3/A4 object-scope prerequisite (HIGH-P3):** `invoices`/`proposals`/
  `contracts` RLS policies are org-scoped only, not assignment-scoped like
  `jobs`. Not relevant to A2 (A2 adds no business tools), but must stay
  blocking for any A3 context provider or A4 policy adapter that would expose
  those entities to non-owner/admin/dispatcher roles.

## A2 Scope

A2 builds the smallest registry that proves the tool contract without
exercising it against a real business tool:

- A first-party, code-defined (not database-persisted) tool registry:
  registration, lookup by `id@version`, discovery filtered by permission/org/
  feature flag.
- `AthenaToolDefinition` and `AthenaToolExecutionContext` TypeScript
  contracts, narrowed from C002 the same way A1's `types.ts` narrowed C001.
- A runtime validator for the standard `AthenaToolResult` envelope (C003),
  rejecting undocumented top-level shapes, mirroring the pattern
  `assertValidTelemetryRecord` already established for C011.
- Tool identity, naming, and versioning rules: stable reverse-domain IDs,
  semver-compatible versions, registry keyed by `id@version`, deprecation
  metadata.
- A deterministic dispatch path — `AthenaToolDispatcher` — that: resolves a
  tool by ID/version, fails closed on unknown/invalid/deprecated tools,
  evaluates a permission/risk decision against the actor's role and the
  tool's declared `permissions`/`risk` (never from model/planner output),
  enforces `timeoutMs` and cancellation via a kernel-owned deadline/
  `AbortController` (reusing A1's pattern, not `databaseSession.ts`), and
  validates every returned envelope before it can reach a caller.
- Exactly one to three no-op fixture tools (e.g. an echo/draft-only tool)
  that exist solely to exercise the dispatcher and contract tests. Fixture
  tools call no application service and touch no database table.
- Contract tests proving registration, discovery filtering, versioning
  conflicts, envelope validation, permission denial, and timeout/cancellation
  all work against the fixture tools.

A2 does **not** wire the registry into the live `AthenaKernelService` HTTP
path. `docs/athena/roadmap.md`'s A2 row lists "Registry, metadata loader,
version checks" and "contract tests" as A2's deliverables and tests — it does
not require a new reachable state or HTTP surface. The kernel's `planning`/
`policy_check` states still terminate in A1's no-op/draft response; the
registry is validated standalone until A5 (router/planner) and A6 (action
engine) exist to route real plans through it. This keeps `executing` and
`awaiting_approval` unreachable in production exactly as A1 left them.

## A2 Non-Goals

A2 must not implement:

- Production business tools of any kind (CRM, estimating, dispatch, billing,
  documents, notes). Only no-op fixture tools strictly for registry/contract
  tests are permitted.
- A live kernel path that calls `dispatcher.execute()` from an authenticated
  HTTP request. The registry and dispatcher are exercised only from tests
  until A5/A6 exist to route real plans.
- Memory, plugins, third-party tool loading, or broad context providers.
- Autonomous writes of any kind.
- Object-level (assignment/ownership-scoped) permission checks — that is A4
  work. A2's permission gate is capability/role-level only, matching A1's
  `evaluateAthenaPolicy` precedent.
- A generalized planner, router, or intent classifier — A5 work.
- Real mutating-tool execution, approval pauses, retries, or compensation
  execution — A6 work. A2 only proves the *shape* (idempotency field,
  compensation-policy field, timeout, cancellation check) is enforceable, not
  that a real mutating tool safely uses it.
- Cost/spend enforcement — record-only cost metadata remains sufficient
  through at least A6, per the A1 plan's own non-goal.
- A database-persisted tool catalog. A2's registry is static and code-loaded;
  dynamic/plugin registration is A9/A13 work.

## Required Backend Seams

New module, following the existing `app/modules/<name>/{service,types}.ts`
pattern established by `athena-kernel`:

| Seam | Suggested location | A2 responsibility |
| --- | --- | --- |
| Registry types | `app/modules/athena-tool-registry/types.ts` | `AthenaToolDefinition`, `AthenaToolExecutionContext`, `AthenaToolResult`/`AthenaToolError` contracts narrowed from C002/C003 |
| Registry store | `app/modules/athena-tool-registry/registry.ts` | In-memory `Map<"id@version", AthenaToolDefinition>` built at module load; `register()`, `resolve(id, version)`, `discover(actor)`, duplicate/conflict rejection |
| Result envelope validator | `app/modules/athena-tool-registry/resultEnvelope.ts` | Runtime shape check for `AthenaToolResult`, mirroring `athena-kernel/telemetry.ts`'s `assertValidTelemetryRecord` |
| Permission/risk gate | `app/modules/athena-tool-registry/policy.ts` | Deterministic allow/deny for `(actor, tool)`, built on `hasAnyPermission`/`normalizeRole` from `app/domain`, never on `requestContext.ts`'s Express-bound helpers (same MEDIUM-1/MEDIUM-2 constraint A1 already enforces) |
| Dispatcher | `app/modules/athena-tool-registry/dispatcher.ts` | Resolves tool, runs the permission/risk gate, enforces `timeoutMs` via a dispatcher-owned `AbortController`/deadline, calls `tool.execute()`, validates the returned envelope, never exposes a Prisma client or `getRequestDatabaseClient()` to tool code |
| Errors | `app/modules/athena-tool-registry/errors.ts` | Structured not-found/unauthorized/deprecated/timeout/invalid-envelope errors, reusing `AthenaKernelError`'s category/retryable/safeSummary shape from `athena-kernel/errors.ts` rather than inventing a parallel taxonomy |
| Fixtures (test-only) | `app/modules/athena-tool-registry/fixtures/` | 1-3 no-op tools (e.g. `echoFixtureTool`) that call no application service; excluded from any production registration call site |

Controllers/routes: none required for A2. No new HTTP endpoint is exposed;
the registry is validated through unit/contract tests only, consistent with
the roadmap's A2 deliverables.

## Minimal Tool Registry Contract/Interfaces

```ts
// app/modules/athena-tool-registry/types.ts
export interface AthenaToolDefinition<TInput = unknown, TData = unknown> {
  id: string;                 // stable reverse-domain id, e.g. "tradeos.athena.fixture.echo"
  version: string;            // semver, e.g. "1.0.0"
  owner: string;               // first-party module name; no plugin owners in A2
  description: string;
  permissions: string[];       // TradeOS DomainPermission values required to invoke
  risk: "low" | "medium" | "high";
  confirmationPolicy: "never" | "contextual" | "always";
  timeoutMs: number;
  idempotency: "required" | "optional" | "not_supported";
  compensationPolicy: "none" | "compensating_action" | "service_transaction" | "draft_only";
  inputSchema: unknown;         // zod schema or equivalent runtime-validated shape
  deprecated?: { replacementId?: string; sunsetAt?: string; note: string };
  execute(
    input: TInput,
    aiContext: AthenaAIContext,
    execution: AthenaToolExecutionContext
  ): Promise<AthenaToolResult<TData>>;
}

export interface AthenaToolExecutionContext {
  executionId: string;
  requestId: string;
  traceId: string;
  orgId: string;
  actor: { type: "user" | "system"; id: string };
  role: CanonicalRole;
  deadline: Date;
  cancellationSignal: AbortSignal;
  approvalId?: string;
  featureFlags: string[];
  // Deliberately excludes any Prisma client, request-scoped transaction
  // handle, or getRequestDatabaseClient() reference. Tools reach
  // application services only; see "No Ambient Request Transaction" below.
}

export interface AthenaToolResult<TData = unknown> {
  success: boolean;
  summary: string;
  data: TData | null;
  events: AthenaEventReference[];   // always [] in A2 - no tool publishes real events yet
  warnings: AthenaWarning[];
  followUps: AthenaFollowUp[];
  telemetry: AthenaTelemetryReference;
  error?: AthenaToolError;
}
```

`AthenaToolExecutionContext` is intentionally identical in shape to the
`AthenaExecutionContext` the A1 kernel already builds internally, so a future
A5/A6 wiring step can construct one from the other without a redesign.

## Tool Identity, Naming, And Versioning Rules

- IDs are reverse-domain, lowercase, dot-separated:
  `tradeos.<module>.<capability>`, e.g. `tradeos.athena.fixture.echo`. This
  matches the existing contract example `tradeos.estimate.prepareDraft`.
- Version is a semver string. The registry key is the `id@version` tuple, not
  `id` alone — two versions of the same tool can be registered
  simultaneously during a deprecation window.
- Breaking changes require a new major version, registered as a distinct
  entry; the old major version stays resolvable until explicitly removed.
- Compatible additions (new optional input fields, new optional `data`
  fields) do not require a version bump.
- Removed tools do not disappear silently: `resolve()` returns a structured
  `tool_removed` error rather than `tool_not_found`, so historical action
  records (once A6 exists) can distinguish "never existed" from "existed and
  was retired."
- Duplicate registration of the same `id@version` is a fail-fast startup
  error, not a silent overwrite.
- `owner` must be a first-party module name in A2; there is no plugin owner
  namespace to validate against yet (that validation is A13 work).

## Standard Tool Result Envelope Enforcement

- Every fixture tool's `execute()` return value passes through
  `resultEnvelope.ts`'s `assertValidAthenaToolResult()` before the dispatcher
  returns it to a caller — the same "validate before it can complete a
  business action" posture `telemetry.ts` already established for C011.
- Validation rejects: missing `success`/`summary`/`data`/`events`/`warnings`/
  `followUps`/`telemetry`, any undocumented top-level key, a `data` payload
  when `success` is `false` unless the tool's contract explicitly documents a
  safe partial shape, and an `error` object missing `code`/`category`/
  `retryable`/`safeSummary`/`correlationId` when `success` is `false`.
- The validator is exported for reuse by `athena:contracts` so A2 tests
  exercise the same function production dispatch would use, not a
  test-only duplicate.

## Permission And Risk-Classification Enforcement Outside The LLM

- The dispatcher evaluates permission/risk **before** calling
  `tool.execute()`, using only the tool's registered `permissions`/`risk`
  metadata and the actor's server-derived role/permissions — the same
  inputs `athena-kernel/policy.ts` already uses for A1's coarse
  `draft_response`/`mutate_business_record` decision.
- No planner, plan step, or model output is ever consulted for this
  decision in A2. There is no planner yet; the dispatcher's caller (a test
  in A2) supplies `toolId`/`version`/`actor` directly, exactly as a future
  A5 planner would, so the gate's contract is exercised before anything
  produces plans that could try to bypass it.
- Unauthorized dispatch attempts fail closed with a structured
  `athena_tool_unauthorized` error (category `authorization`, not
  `validation`), and are indistinguishable in behavior from an unknown tool
  ID from the caller's perspective (no oracle for "this tool exists but you
  can't use it" vs. "this tool doesn't exist", to avoid registry
  enumeration by permission probing).
- Risk classification stays tool-declared and static in A2. Confirmation
  policy (`never`/`contextual`/`always`) is stored and validated but not yet
  enforced by an approval flow — that requires A6's action engine. A2 must
  not implement an approval bypass or claim confirmation is enforced.

## Timeout, Idempotency, And Cancellation Behavior

- Every `AthenaToolDefinition.timeoutMs` is enforced by the dispatcher using
  the same pattern `athena-kernel/service.ts` already validated: race
  `tool.execute()` against a dispatcher-owned timer, so a non-cooperative
  fixture tool that ignores its `cancellationSignal` still can't hang the
  dispatcher indefinitely.
- `idempotency` is a required field on every tool definition (`required` |
  `optional` | `not_supported`). A2's fixture tools are `not_supported` —
  they perform no mutation, so there is no idempotency target — but the
  field must be present and validated so no tool can be registered without
  declaring its policy, closing the gap before a real mutating tool arrives
  in A6.
- `AthenaToolExecutionContext.cancellationSignal` is threaded through to
  every fixture tool. Contract tests must prove a fixture tool that checks
  `cancellationSignal.aborted` before "returning success" actually observes
  an abort fired by the dispatcher's deadline — proving the mechanism works
  before any real mutating tool depends on it.
- The dispatcher's `AbortController` is dispatcher-owned, constructed at
  dispatch entry, exactly as the kernel's is — not derived from
  `databaseSession.ts` or the ambient request lifecycle.

## No Ambient Request Transaction For Mutating/Pausable Tools

This is the direct implementation of the HIGH-P1 pre-A2/A6 prerequisite
named in the A1 parallel readiness review, applied structurally now so it
cannot be rediscovered mid-A6:

- `AthenaToolExecutionContext` (above) carries no Prisma client, no
  `Prisma.TransactionClient`, and no reference to
  `getRequestDatabaseClient()`. A tool's `execute()` signature has no way to
  reach the ambient request-scoped transaction even if an author tried.
- The dispatcher itself never calls `runInDatabaseTransaction` or reads the
  request's `AsyncLocalStorage`-bound transaction from `app/db/requestSession.ts`.
  A2's fixture tools need no database access at all, so the dispatcher has
  no database seam to misuse yet.
- This plan records, for A6 rather than A2, that any tool with
  `idempotency: "required"` or `risk` above `low` must call its application
  service through a **new, short-lived** scoped session per attempt
  (reusing the re-authentication pattern already proven by
  `runWithBackgroundDatabaseSession`), never the transaction that was open
  when the HTTP request entered the kernel. Approval waits (once
  `awaiting_approval` becomes reachable in A6) happen *between* transactions,
  never inside one still holding `app.user_id`/`app.org_id`/`app.role` from
  the original request.
- A2 itself adds no mutating capability, so this section is a structural
  guarantee (tool code has no transaction to reach) plus a named A6
  prerequisite, not a runtime enforcement mechanism that needs its own test
  yet. The absence of a database seam in `AthenaToolExecutionContext` is the
  enforcement.

## Test Requirements

Required test classes, in `app/tests/athena-tool-registry.*.test.ts` files
following the existing `athena-kernel.*.test.ts` naming convention:

- Registration tests: duplicate `id@version` rejected at registration time;
  distinct versions of the same `id` coexist; `owner` presence validated.
- Discovery tests: discovery returns only tools the actor's role/permissions
  satisfy; a tool requiring a permission the actor lacks is excluded, not
  merely marked unauthorized.
- Resolution tests: unknown `id`, unknown `version` of a known `id`, and a
  `deprecated`/removed tool each fail closed with distinct structured error
  codes (`tool_not_found`, `tool_version_not_found`, `tool_removed`).
- Envelope validation tests: a conforming fixture result passes; a result
  missing a required field, carrying an undocumented top-level key, or
  omitting `error` on `success: false` is rejected.
- Permission/risk gate tests: an actor without a tool's required permission
  is denied deterministically, independent of any "plan" or message content
  supplied to the test; the denial response is indistinguishable in shape
  from an unknown-tool response (no existence oracle).
- Timeout/cancellation tests: a fixture tool that ignores its
  `cancellationSignal` is still forced to a timeout result once
  `timeoutMs` elapses; a fixture tool that checks `cancellationSignal`
  observes an abort fired by the dispatcher's own deadline, not an
  externally injected signal.
- Idempotency-field presence tests: registering a tool without an
  `idempotency` value fails at registration time.
- No-database-access tests: a type-level/static check (or a fixture tool
  that attempts to import `app/db/client` and is excluded from the build)
  proving `AthenaToolExecutionContext` cannot resolve a live database
  handle. This does not need a runtime test if the type shape alone makes it
  unreachable — document which one A2 implementation actually chooses.

Out of scope for A2 tests: real business tool integration, planner/router
tests (A5), approval/action-engine tests (A6), object-level scope tests
(A4), event publication tests (A8).

## CI Validation Gates

- Extend the existing `athena:contracts` script
  (`app/package.json`) to also match
  `athena-tool-registry\.contracts\.test\.ts$`, so registry/envelope shape
  validation runs in the same named gate A1 already wired into
  `.github/workflows/verify-repository.yml`. Do not invent a second gate
  name — one `athena:contracts` gate covering both the kernel and the
  registry keeps the CI surface from fragmenting per milestone.
- No new `athena:smoke` scenario is required for A2, since A2 adds no live
  HTTP path. If a maintainer later decides the registry needs a smoke
  check before A5 wires it live, add it as an explicit decision at that
  time rather than defaulting to "more gates."
- `athena:eval` and `athena:perf` remain deferred exactly as the A1 plan
  left them; A2 must not claim coverage under either.

## Migration Requirements

None. A2's registry is a static, code-loaded catalog (`Map` built at module
load from first-party fixture definitions), not a database table. No Prisma
model, no migration, no RLS policy is required for A2. If a future milestone
needs dynamic or admin-editable tool registration, that decision — and its
migration — belongs to A9 (Tool SDK) or A13 (Plugin SDK), not A2.

## Risks And Blockers

- **Scope-creep risk:** the clearest way A2 fails its own non-goals is a
  fixture tool that quietly becomes a real integration (e.g., an "echo" tool
  that starts calling `NotesService` "just for a realistic test"). Any tool
  registered in A2 that calls an application service should be treated as a
  scope violation and rejected in review.
- **Named pre-A6 blocker (carried from A1):** mutating/pausable tool
  execution must never reuse the ambient request-scoped transaction. A2
  enforces this structurally (no transaction reachable from tool code); A6
  must not weaken `AthenaToolExecutionContext`'s shape to add one back in
  as a shortcut.
- **Named pre-A3/A4 blocker (carried from A1):** invoices/proposals/contracts
  remain org-scoped-only at the RLS layer. Not an A2 risk directly, but A2's
  permission gate must not be mistaken for object-level scoping when A3/A4
  reuse this module's policy pattern — A2's gate is capability/role-level
  only.
- **Registry-enumeration risk:** if unauthorized-tool and unknown-tool errors
  ever diverge in timing or shape, an actor could probe for which tools
  exist in an org they don't have access to. The identical-shape requirement
  above is the mitigation; a regression here should be treated as a security
  finding, not a UX nit.
- **Fixture drift risk:** because A2's fixtures are the only tools that
  exist, there is no pressure to keep the dispatcher's database-access
  boundary honest under real load until A6. Reviewers should treat "does a
  real tool need something `AthenaToolExecutionContext` doesn't provide" as
  a signal to revisit this plan, not to quietly widen the context in A6
  without documentation.

## Deferred Fields And Features

Deferred to A3:
- Any tool that reads from a context provider section (all A2 fixtures use
  only their own `input`, never `AthenaAIContext` provider sections, since
  those sections don't exist until A3).

Deferred to A4:
- Object-level (assignment/ownership) permission scope inside the tool
  policy gate.
- `resourceScope`/`deniedFields` enforcement from C007.

Deferred to A5:
- Any planner/router call site that resolves tools via this registry.
- Plan-to-tool-call translation.

Deferred to A6:
- Real mutating tool execution.
- `awaiting_approval`/`executing`/`partially_succeeded` becoming reachable
  in production.
- Idempotency-key generalization beyond a required/optional/not_supported
  field (a real reconciliation hook, per the A1 plan's own MEDIUM-7
  deferral).
- Checkpoint shape and resume semantics.
- Short-transaction-per-attempt execution for mutating tools.

Deferred to A9/A13:
- Dynamic or database-persisted tool registration.
- Plugin/third-party tool manifests, sandboxing, and marketplace metadata.
- `costEstimate`, `modelHints`, and other v1-optional C002 fields — types may
  reserve the fields, but A2 does not need to populate or test them.

## Exact A2 Exit Criteria

A2 is complete only when all criteria below are met:

- A code-defined tool registry exists with `register()`, `resolve(id,
  version)`, and `discover(actor)`, matching the `AthenaToolDefinition`
  contract narrowed from C002.
- Discovery returns only tools permitted for the actor's role/permissions,
  org context, and any relevant feature flag.
- Unknown tool IDs, unknown versions, and deprecated/removed tools each fail
  closed with distinct, structured, non-500 errors.
- Every tool result is validated against the standard `AthenaToolResult`
  envelope before it can be treated as complete; malformed envelopes are
  rejected, not silently passed through.
- Permission and risk decisions are made deterministically from
  actor role/permissions and tool metadata only — never from model, plan, or
  message content — and denial responses are indistinguishable in shape from
  unknown-tool responses.
- Every registered tool declares `timeoutMs`, `idempotency`, and
  `compensationPolicy`; registration without these fields fails.
- The dispatcher enforces `timeoutMs` via its own deadline/`AbortController`,
  independent of `databaseSession.ts`, and cancellation is observable by a
  cooperative fixture tool.
- `AthenaToolExecutionContext` provides no path to the ambient
  request-scoped Prisma transaction or any direct database handle.
- Only no-op fixture tools are registered; no application service is called
  by any A2 tool.
- No new HTTP endpoint, kernel-reachable state, or live dispatch path is
  added; the registry is exercised through tests only.
- `athena:contracts` is extended to cover registry/envelope shape validation
  and remains wired into `.github/workflows/verify-repository.yml`.
- Required docs, app tests, lint, build, and diff checks pass, or documented
  blockers are accepted.
- The pre-A6 transaction prerequisite and pre-A3/A4 object-scope
  prerequisite remain recorded and unweakened.

## A2 Go/No-Go Recommendation

**GO** for A2 implementation as scoped above, with no required corrections —
A1 exit-complete evidence and the two carried-forward prerequisites (HIGH-P1,
HIGH-P3) give A2 a clean structural foundation to build on. Implementation
should stop and split into a separate, explicitly reviewed milestone if
pressure emerges to: register a tool that calls a real application service,
wire the registry into the live kernel HTTP path, add object-level scope
checks, or persist the registry to a database table. Any of those belong to
A3-A6, A4, or A9/A13 respectively, not A2.
