---
status: draft
owner: platform
last_verified: 2026-08-10
source_of_truth: true
related_docs:
  - ../README.md
  - ../roadmap.md
  - ../04-system-architecture/README.md
  - ../05-runtime/README.md
  - ../07-context-engine/README.md
  - ../09-security/README.md
  - ../contracts/README.md
  - A1-ai-kernel-implementation-plan.md
  - A2-tool-registry-implementation-plan.md
  - A3-context-engine-implementation-plan.md
  - A4-permission-policy-implementation-plan.md
  - ../../TRADEOS_BIBLE.md
  - ../../ARCHITECTURE.md
---

# A5 Router and Planner Implementation Plan

Milestone: A5 - Router and Planner
Purpose: replace A1's crude routing/planning stand-ins (a two-value keyword
classifier and a no-op "planning" transition) with a real deterministic
intent router and a C004-conformant planner, and wire both into the live
kernel path behind a new independent flag - closing two named forward
references left open by A3 and A4.
Implementation posture: backend-only, dark by default, no new autonomous
execution (A6's action engine does not exist yet), zero regression to the
existing flag-off kernel path, contract-test-gated.

## A4 Acceptance Summary

A5 planning starts from a verified-complete A4. `feat(athena): add A4
permission policy foundation` (PR #109, plus a follow-up review-fix commit
requiring risk classification on tool capability requests) is merged to
`main`. `app/modules/athena-permissions/` implements the C007 permission
adapter (RBAC via `app/domain/contracts.ts`, job object-scope via
`JobsService`, risk-based approval classification) and closed the A2 gap
where a tool's risk was computed but never used to gate dispatch.

Two prior-phase docs explicitly named A5 as the phase that closes their own
remaining gaps:

- A3's plan, Non-Goals: a real intent router "is A5 Router/Planner's job."
- A4's plan, Out of scope: rewiring the kernel's `policy_check` stage
  "is A5 (planner) work."

Two additional forward-references exist directly in code comments:
`athena-context-engine/types.ts`'s `requestedIntents` field ("Empty until
A5's planner supplies real intents") and
`athena-context-engine/providers/knowledgeEngineProvider.ts` ("A query-driven
knowledgeEngine.search() activation is future A5+ work").

## A5 Scope

Unlike A2 (dispatcher never wired into a live path) and A3 (assembler never
wired into a live path), A5 wires router + planner into the live kernel path
this phase, behind a new independent flag,
`ATHENA_ROUTER_PLANNER_ENABLED` (default `false`). The roadmap's own
language for this milestone - "hidden orchestration," rollback "route to
human-readable fallback" - only makes sense if something real is running in
the pipeline; leaving router/planner standalone-only like A2/A3 would strand
the four forward-references above with no future phase owning them (A6 is
action-execution, not router/planner wiring).

In scope:

- `app/modules/athena-router/`: deterministic, non-LLM intent classification
  (`classifyAthenaIntent(message): AthenaRouterResult`) over a deliberately
  small, closed vocabulary - `draft_response`, `dispatch_overview`,
  `knowledge_lookup`, `mutate_business_record`. The middle two are exactly
  the two `allowedIntents` values A3's two `lazy_intent` providers
  (`dispatchProvider.ts`, `knowledgeEngineProvider.ts`) already declared
  while waiting for A5. No speculative business-domain intents (customers,
  costbook, billing) - nothing backs them yet. No "needs clarification"
  intent - `AthenaKernelService.handleRequest()` already gates
  `message.length < 3` before the `routing` transition begins, so a
  router-level clarification branch would be unreachable.
- `app/modules/athena-planner/`: `buildAthenaPlan()` produces a C004
  `AthenaPlan`. `AthenaPlanStep` (absent from the C004 contract prose in
  `docs/athena/contracts/README.md` - only the `steps: AthenaPlanStep[]`
  reference exists there) is defined here as a discriminated union
  (`tool_call` | `clarifying_question`), directly satisfying C004's own
  validation rule: "every step must reference a registered tool/version or a
  user question." Every candidate tool is verified via
  `AthenaToolRegistry.resolve()` before a step can reference it - an
  unregistered or removed tool throws `AthenaPlannerError` rather than
  silently building an invalid plan.
- Kernel wiring (`app/modules/athena-kernel/service.ts`): the `routing`
  → `planning` → `policy_check` block is now an
  `if (!flags.routerPlannerEnabled) { ...A1 original... } else { ...A5... }`
  split, both converging before the untouched `produceDraftResponse()` call.
  The A5 branch: classify intent, build a plan, evaluate
  `mutate_business_record` through the **existing, unmodified**
  `evaluateAthenaPolicy()` call (byte-identical external behavior to the
  flag-off path - the concrete instance of "route to human-readable
  fallback"), evaluate any `tool_call` step through `athena-permissions`
  (dormant in production - A2 has no registered tools yet, so
  `plan.steps` is always `[]` today), and, when the router requested a
  context intent, run a live `assembleAthenaContext()` call
  (`app/modules/athena-kernel/contextRegistry.ts`'s
  `createLiveAthenaContextRegistry()`, the first live registration of A3's
  providers anywhere) to populate `context.dispatch`/`context.knowledgeEngine`.

Out of scope (deferred):

- Feeding the enriched context into `produceDraftResponse()`'s LLM prompt -
  that provider/prompt-assembly integration is untouched this phase; A5 only
  proves the assembly pipeline runs end-to-end and is recorded in telemetry.
- Real approval execution/routing for `approval_required` plan steps - A6
  (action engine) work. Today `approval_required` and `deny` both map to the
  kernel's `denied` state.
- Any new lifecycle state or transition edge - `policy_check -> denied` was
  already a legal A1 edge (`lifecycle.ts`'s `a1ForwardEdges`); no change to
  `lifecycle.ts` was needed.
- Object-scope resolution beyond `Job` - still blocked on the HIGH-P3
  prerequisite carried forward from A1-A4.

## Contracts

`AthenaPlan`/`AthenaPlanStep` (C004) are implemented in
`app/modules/athena-planner/types.ts` and validated at runtime by
`assertValidAthenaPlan()` (`resultValidation.ts`), following the same
"reject undocumented top-level key" convention as the C003/C007/C010
validators in the sibling modules. `AthenaRouterResult`
(`app/modules/athena-router/types.ts`) is new A5-internal plumbing, not a
numbered C0xx contract - it has no runtime validator and is not part of the
`athena:contracts` gate.

## Required Backend Seams

- `app/modules/athena-router/classifier.ts` - pure function, no I/O, no
  model call.
- `app/modules/athena-planner/planner.ts` - pure function except for
  `AthenaToolRegistry.resolve()`, which never executes a tool.
- `app/modules/athena-kernel/contextRegistry.ts` - the only new module that
  reaches real application services (`JobsService` via `dispatchProvider`,
  `KnowledgeRuntimeService` via `knowledgeEngineProvider`), consistent with
  the kernel's role as top-level orchestrator over A3's already-sanctioned
  provider/service seam.
- `AthenaKernelHandleInput` gained an injectable `contextRegistry?:
  AthenaContextRegistry` field, mirroring the existing `provider?:
  AthenaProviderAdapter` DI pattern, so tests can inject fixture-backed
  providers instead of hitting a real database session.

## Test Requirements

- Router: mutation/dispatch/knowledge classification, phrase-vs-verb
  ordering (a bare mutation keyword like "dispatch" or "schedule" inside a
  more specific noun phrase like "dispatch board" or "schedule overview"
  must not misclassify as `mutate_business_record`), word-boundary
  false-positive guards carried forward from A1.
- Planner: `mutate_business_record` → `needs_clarification` with one
  `clarifying_question` step; empty candidate set → `ready` with zero steps
  (the only real case today); non-empty candidate set → `draft` status,
  every step verified via `resolve()`; unregistered/removed tool → throws.
- C004 contract validator: conforming plans (with and without steps) accepted;
  missing/undocumented keys, unknown status/risk values, and malformed steps
  rejected.
- Kernel: a new flag-on `describe` block in `athena-kernel.service.test.ts`
  proves draft_response and mutation-denial parity with the flag-off path,
  plus dispatch/knowledge-lookup requests populating their respective
  context sections through the real A3 assembler and providers (fixture
  `JobsService`, real `KnowledgeRuntimeService`). Every existing flag-off
  test in that file is unmodified and still passes.
- Static import-boundary tests for both new modules (no direct
  `db/client`/`db/requestSession`/`@prisma/client`).

## Feature Flags

`ATHENA_ROUTER_PLANNER_ENABLED` (default `false`), independent of
`ATHENA_KERNEL_ENABLED`. `getAthenaFlags()` re-reads `process.env` per call
with no module-level caching, so no existing test needed to change to keep
exercising the flag-off path.

## Exit Criteria

Plans reference only registered tools: `buildAthenaPlan()` never produces a
`tool_call` step for a tool `AthenaToolRegistry.resolve()` does not confirm
as `"found"` - proven by `AthenaPlannerError` in the unregistered/removed
cases. Rollback: `ATHENA_ROUTER_PLANNER_ENABLED=false` restores the exact A1
routing/planning behavior with no other change required; within the flag-on
path itself, any capability the planner cannot resolve into a ready plan
(`mutate_business_record`, or a future `approval_required` step) already
degrades to the kernel's existing human-readable `denied` response rather
than a novel unhandled state.
