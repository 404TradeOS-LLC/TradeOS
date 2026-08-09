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
  - ../07-context-engine/README.md
  - ../09-security/README.md
  - ../12-testing/README.md
  - ../13-deployment/README.md
  - ../contracts/README.md
  - ../reviews/A0.5-architecture-review.md
  - ../reviews/A1-parallel-readiness-review.md
  - ../../TRADEOS_BIBLE.md
  - ../../ARCHITECTURE.md
  - ../../RBAC_MATRIX.md
---

# A1 AI Kernel Implementation Plan

Milestone: A1 - AI Kernel
Purpose: convert the corrected A0.5 Athena Bible into the smallest safe implementation plan for the first executable Athena kernel.
Implementation posture: backend-first, feature-flagged, non-mutating, service-bound, and test-gated.

## Coordination State

Codex owns this file: `docs/athena/roadmap/A1-ai-kernel-implementation-plan.md`.

Claude owns `docs/athena/reviews/A1-parallel-readiness-review.md`. The file exists locally as Claude-owned review input and must not be edited or staged by Codex. This plan incorporates its A1-relevant findings by reference and records future-milestone findings as named prerequisites below.

Current PR context at planning time:

- Branch: `docs/athena-a0-5-architecture-review`
- Base: `docs/athena-platform-bible`
- Active PR: #99, `docs(athena): complete A0.5 architecture readiness review`
- Existing unrelated dirty files were present under `app/package-lock.json` and `packages/knowledge-engine/**`; this plan must not stage, modify, or rely on them.

## Parallel Review Findings Incorporated

`docs/athena/reviews/A1-parallel-readiness-review.md` is treated as read-only evidence. A1 triage status:

| Finding | Plan status | A1 action |
| --- | --- | --- |
| HIGH-P1/HIGH-P5: request-scoped Prisma transaction conflicts with pause/cancellation model | Included for A1 and named as pre-A2/A6 prerequisite | A1 kernel owns its own `AbortController`; mutating/pausable tools later must not reuse the ambient request transaction |
| HIGH-P2: no execution persistence schema exists | Included | A1 exit requires a minimal application-service-owned execution record; in-memory-only state is not exit-complete |
| HIGH-P3: invoices/proposals/contracts lack job-style assignment scoping | Deferred with named pre-A3/A4 prerequisite | No A1 business context; billing/document context cannot ship to non-owner/admin/dispatcher roles until scoped |
| HIGH-P4: C011 telemetry has no typed runtime enforcement | Included | `athena:contracts` must validate every emitted `AthenaTelemetryRecord` shape |
| MEDIUM-1/MEDIUM-2: Express request helpers are not reusable and `canonicalRole` is optional | Included | Athena policy adapter uses portable domain helpers and calls `normalizeRole()` itself |
| MEDIUM-3: clarification/degraded lifecycle loop is uncapped | Included | A1 lifecycle includes a bounded round-trip counter |
| MEDIUM-5: Athena gates are not wired into CI | Included | `athena:contracts` and `athena:smoke` must be wired into `verify-repository.yml` before A1 exit |
| MEDIUM-6: cost telemetry has no enforcement backend | Included as non-goal | A1 records cost only; spend enforcement is deferred |
| MEDIUM-4/MEDIUM-7/LOW-1/LOW-2 | Deferred | Checkpoint shape, idempotency generalization, tenant cache infrastructure, and selected-scope search filtering remain A3/A6 work |

## A1 Scope

A1 builds the smallest executable kernel foundation that proves Athena can run inside TradeOS without bypassing existing security, tenancy, service, or observability boundaries.

In scope:

- Authenticated backend entrypoint behind existing `requireAuth` and `databaseSession` middleware.
- Feature-flagged kernel service that accepts a user-visible message and server-derived request metadata.
- Minimal AI context assembly with request, organization, user, permissions, selected scope, conversation reference, and telemetry metadata only.
- Persistable execution lifecycle model and TypeScript contracts for A1, even if the first implementation uses a narrow storage strategy behind an application-service seam.
- Runtime state machine and legal transition helpers.
- Execution context separate from AI context.
- Cancellation, deadline, timeout, and shutdown semantics.
- Normalized result and error envelope for kernel responses.
- Minimal telemetry, audit, and cost-attribution records sufficient to reconstruct what Athena attempted.
- One provider-adapter seam for model calls, with fake/local provider support in tests.
- No-op or draft-only response behavior. Draft means user-visible text only, not business-record mutation.
- Deterministic permission/session/trace propagation from existing TradeOS auth and request-scoped database session.
- Named validation gates for A1 and placeholders for later Athena-specific scripts.

## A1 Non-Goals

A1 must not implement:

- Production business tools.
- Autonomous writes to customers, estimates, jobs, invoices, documents, permissions, memory, or events.
- Broad context providers for customers, dispatch, calendar, inventory, costbook, Knowledge Runtime, notifications, or telemetry histories.
- Long-term memory persistence.
- Proactive recommendations.
- Plugin loading or third-party tool execution.
- Voice/mobile UX.
- New authentication, tenant, estimator, costbook, knowledge, or RLS systems.
- Direct Prisma/database access from Athena planner, model adapter, tool adapter, or prompt code.
- A separate authorization model that competes with `app/domain/contracts.ts`, `docs/RBAC_MATRIX.md`, existing middleware, or service-owned object checks.
- Reuse of the ambient request-scoped Prisma transaction for mutating or pausable tool execution.
- Cost or token budget enforcement. A1 records cost metadata only.

## Required Backend Seams

A1 should add narrow backend seams in the existing `app/` deployable. File names below are implementation-plan targets, not changes made by this documentation PR.

| Seam | Suggested location | A1 responsibility |
| --- | --- | --- |
| Route/controller | `app/backend/controllers/athena.controller.ts` and `app/backend/routes/athena.routes.ts` | Validate request shape, require auth/session middleware, call kernel service, shape HTTP response |
| Kernel service | `app/modules/athena-kernel/service.ts` | Own lifecycle orchestration for one request |
| Kernel types | `app/modules/athena-kernel/types.ts` | Define A1 TypeScript contracts mapped from C001-C011 |
| Lifecycle helper | `app/modules/athena-kernel/lifecycle.ts` | Validate state transitions and terminal-state immutability |
| Minimal context builder | `app/modules/athena-kernel/context.ts` | Build A1 minimal context from server-derived auth, permissions, selected scope, and request metadata |
| Permission adapter | `app/modules/athena-kernel/policy.ts` | Convert TradeOS role/capability/resource inputs into deterministic allow/deny/approval-required decisions |
| Provider adapter | `app/modules/athena-kernel/provider.ts` | Isolate model/provider calls behind a small interface; allow fake provider in tests |
| Telemetry/audit writer | `app/modules/athena-kernel/telemetry.ts` | Emit C011-shaped metadata with redaction and cost fields |
| Error normalization | `app/modules/athena-kernel/errors.ts` | Map validation, authz, timeout, cancellation, provider, and service failures to user-safe errors |
| Feature flags | Existing feature-flag/config seam, or `app/modules/athena-kernel/flags.ts` if needed | Keep kernel disabled unless explicitly enabled |
| Execution store | `app/modules/athena-kernel/executionStore.ts` plus a minimal Prisma model if approved | Persist execution records and lifecycle transitions behind an application-service-owned seam |

All A1 backend seams must preserve the existing module pattern:

```text
app/modules/<name>/
  service.ts
  types.ts
```

Controllers may own HTTP and Zod validation. Services must take `orgId` or server-derived actor context explicitly and must not depend on Express request objects.

## Existing TradeOS Seams To Reuse

A1 must reuse these current implementation contracts:

- `app/backend/middleware/auth.ts`: verifies bearer tokens and resolves active organization membership into `req.auth` and `req.orgId`.
- `app/backend/middleware/databaseSession.ts`: wraps authenticated requests in `runWithDatabaseSession`.
- `app/db/requestSession.ts`: sets `app.user_id`, `app.org_id`, `app.role`, and `app.session_source` in the request-scoped transaction; background execution must use `runWithBackgroundDatabaseSession`.
- `app/backend/middleware/productionHardening.ts`: assigns `x-request-id` and emits baseline request logs.
- `app/backend/middleware/errorHandler.ts`: provides the HTTP error boundary; A1 should normalize Athena errors before they reach generic 500 handling.
- `app/backend/requestContext.ts`: provides controller-level auth, org, role, and permission helpers.
- `app/domain/contracts.ts`: owns canonical roles, permission keys, lifecycle labels, and compatibility role normalization.

Request-bound helpers from `app/backend/requestContext.ts`, including `requireOrgId`, `requirePermissions`, `requireRoles`, and `requireOrgAccess`, must not be reused inside the Athena policy adapter because Athena execution contexts do not carry an Express `Request`. A1 may reuse only portable domain helpers such as `normalizeRole`, `getRolePermissions`, `hasPermission`, and `hasAnyPermission`, and the Athena policy adapter must call `normalizeRole()` itself rather than trusting optional upstream `AuthContext.canonicalRole`.

## Dependency Direction

All future business execution must follow:

```text
Athena -> Tool -> Application Service -> Domain Logic -> Infrastructure
```

A1 has no production business tools, so it should only prove the beginning of this path:

```text
Authenticated HTTP request
-> Athena controller
-> Athena kernel service
-> minimal context/policy/provider seams
-> no-op or draft response
```

A1 must not call application infrastructure directly except through existing platform seams needed for request/session context, feature flags, telemetry, and any approved execution-record persistence.

The authenticated HTTP request may enter Athena while `databaseSession` holds the current request-scoped transaction open for normal TradeOS API behavior. A1 must not treat that transaction as a durable execution boundary, cancellation source, approval-pause container, or future tool-execution container.

## Execution Lifecycle And State Machine Plan

A1 should implement the corrected runtime state machine from `docs/athena/05-runtime/README.md`.

Required states:

| State | A1 use |
| --- | --- |
| `created` | Execution record initialized with server-derived actor/org/request metadata |
| `context_building` | Minimal context is assembled |
| `routing` | A1 may classify as no-op/draft/unsupported; no broad tool routing |
| `planning` | A1 may create a no-op or draft-only plan; planner cannot execute |
| `policy_check` | Deterministic policy confirms A1 action is draft-only and allowed |
| `needs_clarification` | User input required before response can continue |
| `degraded` | Non-critical provider/model issue produced a safe fallback |
| `succeeded` | Draft/no-op response completed |
| `failed` | Terminal failure with safe error envelope |
| `denied` | Policy denied the request |
| `expired` | Deadline or approval window expired |
| `cancelled` | User, system, timeout, or shutdown cancelled execution |

A1 must not enter `executing`, `awaiting_approval`, or `partially_succeeded` for production business actions. Those states may exist in contracts/tests so A2-A6 can extend the lifecycle without redesign.

Implementation steps:

1. Create execution metadata with `executionId`, `requestId`, `traceId`, `orgId`, actor, canonical role, request source, timestamps, and initial `created` state.
2. Transition through state helpers only; direct status assignment is forbidden outside the lifecycle helper.
3. Persist every transition with timestamp, reason code, and safe metadata through the A1 execution store.
4. Treat terminal states as immutable.
5. Return a standard response envelope for success, denial, timeout, cancellation, and failure.
6. Do not retry provider/model work in A1 unless it is explicitly non-mutating and bounded by the request deadline.

A1 lifecycle cycles are bounded. The implementation must track clarification/degraded round trips per execution and force `failed` or `cancelled` after the configured cap is reached. The initial A1 default should be two round trips unless implementation evidence supports a smaller or larger bound.

## A1 Execution Persistence Decision

A1 exit requires a real execution record behind an Athena application-service seam. In-memory or per-request execution state is allowed only for unit tests, local prototypes, and fake-provider development; it is not A1 exit-complete and must be reported as a blocker if no durable store exists.

Required A1 persistence behavior:

- Store `executionId`, `requestId`, `traceId`, `orgId`, actor, canonical role, request source, final state, timestamps, safe summary, safe error code, and redaction mode.
- Store lifecycle transitions or an equivalent timestamp history sufficient to reconstruct state movement for A1.
- Persist through an application service/store seam, not through model, planner, prompt, provider, or tool code.
- Enforce tenant scoping through the same RLS/request-session posture as the rest of TradeOS.
- Include live RLS integration coverage if a Prisma table or migration is added.

If A1 implementation chooses to split persistence into a prerequisite PR, the kernel implementation PR remains blocked from A1 exit until that storage slice lands.

## Minimal TypeScript Contract Plan

A1 should define TypeScript contracts that correspond to the Bible contracts without implementing the entire platform.

Required A1 interfaces:

```ts
export type AthenaKernelState =
  | "created"
  | "context_building"
  | "routing"
  | "planning"
  | "policy_check"
  | "needs_clarification"
  | "degraded"
  | "succeeded"
  | "failed"
  | "denied"
  | "expired"
  | "cancelled";

export interface AthenaKernelRequest {
  message: string;
  conversationId?: string;
  selectedScope?: AthenaSelectedScope;
  requestSource: "http" | "job" | "test";
}

export interface AthenaActorContext {
  userId: string;
  orgId: string;
  role: "owner" | "admin" | "dispatcher" | "technician";
  permissions: string[];
}

export interface AthenaExecutionContext {
  executionId: string;
  requestId: string;
  traceId: string;
  orgId: string;
  actor: { type: "user" | "system"; id: string };
  role: "owner" | "admin" | "dispatcher" | "technician";
  deadline: Date;
  signal: AbortSignal;
  featureFlags: string[];
}

export interface AthenaKernelResult {
  success: boolean;
  executionId: string;
  traceId: string;
  state: AthenaKernelState;
  summary: string;
  message: string | null;
  warnings: AthenaWarning[];
  followUps: AthenaFollowUp[];
  telemetry: AthenaTelemetryReference;
  error?: AthenaToolError;
}
```

A1 should not expose hidden plans, prompt internals, chain-of-thought, raw model prompts, or broad provider data through public API responses.

## Permission, Session, And Trace Propagation Plan

A1 propagation rules:

- Actor, organization, role, and permissions come from `req.auth`, `req.orgId`, and `app/domain/contracts.ts`, never request-controlled tenant fields.
- The Athena permission adapter normalizes roles with `normalizeRole()` and derives permissions from portable domain helpers; it does not trust optional `AuthContext.canonicalRole` or adapt Express `Request` helpers.
- `requestId` comes from `res.locals.requestId` when available; otherwise the controller creates one through the existing request-ID middleware path.
- `traceId` is generated at kernel entry and included in every kernel, provider, telemetry, and error record.
- Any future background continuation must use `runWithBackgroundDatabaseSession` with tenant-qualified job names and active membership validation.
- A1 selected scope is narrowing metadata only. It is not proof of access.
- A1 policy allows only no-op/draft responses. Any request that asks Athena to mutate state returns a safe refusal or follow-up indicating the capability is not available yet.
- Compatibility roles must be normalized to canonical roles before entering Athena contracts.

## Timeout, Cancellation, And Shutdown Behavior

A1 should define one request-level deadline and one provider-call deadline.

Required behavior:

- If the request deadline expires before model/provider work begins, return `expired`.
- If the provider deadline expires, abort the provider call and return `degraded` only if a safe non-model fallback response is available; otherwise return `failed`.
- If the HTTP client disconnects, propagate cancellation and stop non-mutating work.
- If shutdown begins, abandon non-mutating draft work with a safe retry message.
- No timed-out or cancelled A1 execution may later return success.
- No mutation is allowed in A1, so no compensating action is needed.

Recommended initial implementation targets:

- Keep defaults conservative and environment-configurable.
- Construct a kernel-owned `AbortController` at kernel entry and use its `AbortSignal` for provider cancellation.
- Record cancellation reason as `user_cancelled`, `client_closed`, `deadline_exceeded`, `provider_timeout`, or `shutdown`.
- Include request ID and trace ID in all timeout/cancellation errors.

The kernel-owned `AbortController` is not derived from `databaseSession.ts`, `waitForResponse`, Express response `finish`/`close` listeners, or Prisma transaction timeout behavior. The kernel may listen to HTTP client disconnects and fire its own controller, but database-session response listeners are not the source of truth for Athena cancellation.

## Telemetry, Audit, And Cost Records

A1 must start minimal observability now; A10 later matures dashboards and exporters.

Required A1 records:

| Record | Required fields |
| --- | --- |
| Kernel span | `orgId`, `requestId`, `traceId`, `executionId`, state, duration, status, redaction mode |
| Context span | minimal context sections included/omitted, budget, duration, redaction mode |
| Policy span | decision, reason code, capability, risk, denied fields, no raw prompt |
| Provider/model span | provider, model, duration, timeout/cancel status, token counts when available, estimated cost when available |
| Audit summary | actor, org, request, execution, final state, user-visible summary, safe error code |

Redaction rules:

- Do not store private chain-of-thought.
- Do not store raw prompts by default.
- Do not log service credentials, API keys, database URLs, raw payment data, private storage URLs, or unnecessary PII.
- Restricted payloads use `payload_omitted`.
- Prompt/content samples, if added later, require explicit redaction policy and feature flag.

Cost attribution:

- A1 records model/provider token counts and estimated cost when a provider returns them.
- Missing provider usage data should be recorded as `unknown`, not estimated from prompt text unless a later budget policy defines that behavior.
- A1 does not enforce token or spend limits. Cost enforcement requires separate budget/quota infrastructure and is deferred until at least A6.

## Feature Flags

A1 must ship dark by default.

Required flags:

| Flag | Default | Purpose |
| --- | --- | --- |
| `ATHENA_KERNEL_ENABLED` | `false` | Enables the kernel route/service |
| `ATHENA_PROVIDER_MODE` | `fake` in tests/local, unset or disabled in production until configured | Chooses fake/local/provider adapter |
| `ATHENA_DRAFT_RESPONSES_ENABLED` | `false` | Allows model-backed draft-only responses |
| `ATHENA_TELEMETRY_ENABLED` | `true` for metadata-only records | Emits minimal C011 records |
| `ATHENA_COST_TRACKING_ENABLED` | `true` when provider usage exists | Records token/cost metadata |

Do not add flags for registry, broad context, memory writes, plugin loading, or production business tools in A1 except as explicit disabled placeholders if required by configuration validation.

## Testing Requirements

A1 implementation must include tests before it exits.

Required test classes:

- Lifecycle unit tests for every allowed and forbidden state transition.
- Terminal-state immutability tests.
- Contract tests for A1 request, execution context, minimal AI context, kernel result, and error envelope.
- Auth/session propagation tests proving actor/org/role/permissions are server-derived.
- Permission denial tests for mutation requests and unsupported capabilities.
- Timeout tests for request deadline and provider deadline.
- Cancellation tests for aborted request/provider work.
- Error normalization tests for validation, authorization, timeout, cancellation, provider, service, and unknown failures.
- Telemetry redaction tests proving no raw prompt, secrets, or unnecessary PII is logged by default.
- `athena:contracts` shape-validation tests for every emitted `AthenaTelemetryRecord`, including required C011 fields and redaction mode.
- Cost metadata tests for present and absent provider usage.
- Feature flag tests proving the kernel is disabled by default.
- Smoke test for authenticated no-op/draft path.

Out of scope for A1 tests:

- Tool registry contract tests beyond disabled/no-tool behavior.
- Business tool integration tests.
- Long-term memory tests.
- Event publisher/subscriber tests.
- Plugin sandbox tests.
- Full AI planner evaluation.

## Named Validation Gates

A1 must introduce or explicitly block on these named gates:

| Gate | A1 expectation |
| --- | --- |
| `npm run athena:contracts` | Must exist before A1 exit or be recorded as an A1 blocker |
| `npm run athena:smoke` | Must exist before A1 exit or be recorded as an A1 blocker |
| `npm run athena:eval` | May remain deferred until A5; A1 must not claim eval coverage |
| `npm run athena:perf` | May remain deferred until A3/A5/A6; A1 must not claim perf coverage |

Once `athena:contracts` and `athena:smoke` exist as scripts, they must also be wired into `.github/workflows/verify-repository.yml` as a job or required step before A1 counts as exit-complete. A script that exists only in `package.json` is not sufficient.

Required repository checks before an A1 PR is ready:

```bash
npm run docs:check
npm run docs:test
git diff --check
cd app && npm test
cd app && npm run lint
cd app && npm run build
```

Run `cd app && npm run test:integration` when A1 adds or touches database-backed execution records, request-session behavior, RLS-protected state, or background-session behavior. If A1 remains persistence-interface-only with no database migration, document why integration tests are not required.

## Implementation Sequence

1. Add A1 contracts and lifecycle helpers.
2. Add feature-flag parsing and disabled-by-default route/controller shell.
3. Add minimal context builder from authenticated server context.
4. Add deterministic policy adapter for A1 no-op/draft-only behavior.
5. Add provider adapter interface and fake provider for tests.
6. Add kernel service orchestration through lifecycle states.
7. Add timeout/cancellation handling.
8. Add telemetry/audit/cost metadata writer behind a redacted interface.
9. Add execution-store persistence or explicitly block A1 exit until the storage slice lands.
10. Add named `athena:contracts` and `athena:smoke` scripts and wire them into `verify-repository.yml`, or record explicit blockers before A1 exit.
11. Add focused tests, then run the validation ladder.

Keep each implementation PR narrow. If persistence requires a migration, split the migration and RLS tests into a clearly reviewed slice before adding provider/model behavior.

## Risks And Blockers

Current A1 risks:

- Existing RBAC checks are often controller-owned. A1 must not assume service methods enforce every permission internally.
- Request-bound auth helpers are not reusable inside Athena policy code; the new policy seam must use portable domain helpers and normalize roles itself.
- Persisted execution records require an explicit storage decision and likely a new schema and RLS policy. That migration is not part of this planning PR and must be explicitly reviewed before implementation.
- Minimal observability is required before meaningful provider/tool work, but the current app only has request-level logging.
- Dirty unrelated files in this worktree must be resolved or ignored carefully before any A1 implementation staging.
- Claude's parallel A1 readiness review is present locally and has been triaged into this plan, but the file remains Claude-owned and must not be staged by Codex.

Block A1 implementation if:

- The implementation plan expands to business tools, memory writes, broad context providers, or plugins.
- The kernel cannot run behind existing auth and request-scoped RLS.
- The implementation would require direct Athena database access from the LLM, planner, model adapter, or tool adapter.
- A1 cannot define `athena:contracts` and `athena:smoke` gates or explicitly mark them as blockers.
- `athena:contracts` and `athena:smoke` exist only as package scripts and are not wired into CI before A1 exit.
- A1 uses in-memory execution state as if it were crash-durable persistence.
- Telemetry cannot correlate request ID, trace ID, execution ID, org ID, actor, final state, and safe error code.

## Named Pre-Requisites For Later Milestones

Pre-A2/A6 transaction prerequisite:

- Mutating or pausable tool execution must never reuse the ambient request-scoped transaction created by `databaseSession`.
- Each mutating attempt must open and close its own short transaction through an application service.
- Approval waits happen between transactions, never inside one.
- Re-entry should use the `runWithBackgroundDatabaseSession` re-authentication pattern or an equivalent service-owned scoped session that proves active membership and sets RLS variables before reading or writing tenant data.

Pre-A3/A4 object-scope prerequisite:

- Jobs and job assignments are the current object-scope precedent.
- Invoices, proposals, and contracts must have assignment-scoped RLS or equivalent service-layer actor-scoped filters before Athena exposes those records to non-owner/admin/dispatcher roles.
- Billing/document context providers must fail closed for technicians until that scoping exists and is tested.

Pre-A6 idempotency/checkpoint prerequisite:

- C005 `idempotencyKey` is necessary but not sufficient for real mutating tools.
- A6 must define checkpoint shape and a generalized target-reconciliation hook before retry/resume behavior ships.

## Deferred Work

Deferred to A2:

- First-party tool registry implementation.
- Tool schema discovery and registry filtering.
- Tool result envelope enforcement for real tools.

Deferred to A3:

- Business context providers.
- Context caching.
- Provider freshness TTLs for real business data.
- PII redaction across broad provider sections.

Deferred to A4:

- Full action risk policy and approval classification.
- Object-level policy adapters for business tools.
- Invoice/proposal/contract assignment scoping before billing/document context reaches technician roles.

Deferred to A5:

- Model-assisted intent routing and planner evaluation.
- Ambiguity handling beyond simple clarification/fallback.

Deferred to A6:

- Mutating action execution.
- Idempotent retries.
- Approval pause/resume.
- Compensation policies for irreversible business actions.
- Short transaction-per-attempt execution for mutating or pausable tools.
- Checkpoint shape and target reconciliation beyond a single idempotency key.

Deferred to A7+:

- Long-term memory.
- Event integration.
- First-party tool SDK.
- Third-party plugins.
- Voice/mobile readiness.

## Exact A1 Exit Criteria

A1 is complete only when all criteria below are met:

- Kernel route/service is disabled by default and guarded by `ATHENA_KERNEL_ENABLED`.
- Authenticated request path uses existing `requireAuth` and `databaseSession`.
- Actor, org, canonical role, permissions, request ID, trace ID, execution ID, and request source propagate through the kernel.
- Lifecycle state transitions are implemented through a tested helper.
- Lifecycle clarification/degraded round trips are capped and tested.
- Terminal states are immutable.
- Execution records and transition history persist behind an application-service-owned store; in-memory-only state is not exit-complete.
- A1 can return a safe no-op or draft-only response.
- Mutation requests are denied or safely refused.
- Minimal AI context is bounded and contains no broad business provider sections.
- Provider adapter supports fake/local test mode and deadline/cancellation.
- Timeout, cancellation, and shutdown behavior are tested with a kernel-owned `AbortController`.
- Kernel results and failures use a normalized envelope with safe summaries.
- Minimal C011-style telemetry/audit/cost metadata is emitted with redaction.
- No raw prompts, private chain-of-thought, secrets, raw payment data, or unnecessary PII are logged by default.
- `npm run athena:contracts` and `npm run athena:smoke` exist or the A1 PR explicitly remains blocked from completion.
- `athena:contracts` and `athena:smoke` are wired into `.github/workflows/verify-repository.yml` before A1 is exit-complete.
- Required docs, app tests, lint, build, and diff checks pass or documented blockers are accepted.
- No production business tool, persistent memory, plugin, broad context provider, or autonomous write path ships in A1.

## A1 Go/No-Go Recommendation

Go for A1 planning completion after this document is reviewed.

Go for A1 implementation only if it remains the narrow kernel foundation described above. If implementation pressure pulls A1 toward business tools, memory, broad context, or autonomous writes, stop and split that work into the later milestone that owns the missing safety gate.
