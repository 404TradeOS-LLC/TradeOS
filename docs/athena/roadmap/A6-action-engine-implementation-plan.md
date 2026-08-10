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
  - ../06-tool-registry/README.md
  - ../09-security/README.md
  - ../contracts/README.md
  - A1-ai-kernel-implementation-plan.md
  - A2-tool-registry-implementation-plan.md
  - A4-permission-policy-implementation-plan.md
  - A5-router-planner-implementation-plan.md
  - ../../TRADEOS_BIBLE.md
  - ../../ARCHITECTURE.md
---

# A6 Action Engine Implementation Plan

Milestone: A6 - Action Engine
Purpose: build the infrastructure that executes an already-authorized Athena
tool-call step safely - input validation, approval enforcement, idempotency,
timeout/cancellation, result normalization, and audit - and wire it into the
one place the kernel previously stopped short: A5's `policy_check` tool_call
loop, which classified and authorized every step but deliberately never
executed one ("A6 does not exist" is a literal comment/test-name in A5's own
code).
Implementation posture: infrastructure only, dark by default behind a new
independent flag, no business tools, no new authorization logic, fail-closed
approval enforcement, contract-test-gated.

## A5 Acceptance Summary

A6 starts from a verified-complete A5. `feat(athena): add A5 router and
planner` (PR #110) is merged to `main`. `app/modules/athena-router/` and
`app/modules/athena-planner/` classify intent and build a C004 `AthenaPlan`;
`app/modules/athena-kernel/service.ts`'s `policy_check` stage resolves every
`tool_call` step through the A2 registry and evaluates it through A4
(`evaluateAthenaPermission`), but an `allow` decision fell through unexecuted
and an `approval_required` decision was folded into `denied` with reason code
`athena_approval_required_no_action_engine` - both explicitly because no
Action Engine existed yet.

## A6 Scope

In scope:

- `app/modules/athena-action-engine/`: `executeAthenaAction()`, a single-step
  executor for an already-evaluated tool_call. It never derives a
  permission, risk, or approval decision itself - it consumes the A4
  `AthenaPermissionDecision` the kernel already computed and enforces it
  (deny never executes; `approval_required` executes only with a verified
  approval; `allow` executes directly).
- A dedicated C005 `AthenaAction` record shape (`types.ts`), reused verbatim
  from `docs/athena/contracts/README.md` rather than inventing a parallel
  contract, plus an `AthenaActionResult` envelope wrapping the C003
  `AthenaToolResult` a tool handler returns.
- A self-contained action-level lifecycle state machine (`lifecycle.ts`)
  over C005's own `status` enum (`created`, `pending`, `running`,
  `awaiting_approval`, `partially_succeeded`, `succeeded`, `failed`,
  `denied`, `expired`, `cancelled`) - a different state universe than
  `AthenaKernelState`. See "Two lifecycles, not one" below for why
  `athena-kernel/lifecycle.ts` is never touched by this milestone.
- An injectable, fail-closed-by-default approval verification seam
  (`approval.ts`) and an injectable idempotency store (`idempotency.ts`),
  both with deterministic in-memory implementations for tests and no
  database migration (see "Deferred persistence" below).
- Kernel wiring (`app/modules/athena-kernel/service.ts`): the tool_call step
  loop inside the `routerPlannerEnabled` branch now calls
  `executeAthenaAction()` for any step whose A4 decision is not `deny`,
  behind a new `ATHENA_ACTION_ENGINE_ENABLED` flag (default `false`). A
  `deny` decision is unaffected - still routed to the kernel's existing
  denied path without ever reaching A6, both as the intended A5 behavior and
  as A6's own defense-in-depth (`executeAthenaAction()` independently
  refuses to execute a `deny` decision too, even if a future caller reached
  it directly).

Out of scope (deferred):

- Any real business tool (CRM, dispatch, costbook, billing, and the rest of
  the explicit scope-exclusion list in the A6 task brief). A2 has no
  production tools registered; `plan.steps` is `[]` in production today, so
  this entire milestone is dormant end-to-end in production and only
  exercised by tests with an injected registry/candidate tools - the same
  posture A5 already established for its own per-step authorization loop.
- Persistent action/approval/idempotency storage. See "Deferred persistence".
- Retries, compensation execution, and multi-step/autonomous action
  sequencing. `AthenaAction.attempt` and the `partially_succeeded` state are
  carried for C005 contract fidelity but are not exercised - A6 executes at
  most one tool per action, once.
- A caller-facing approval submission/review surface (an endpoint where a
  human actually grants an approval). `AthenaKernelHandleInput.approvalId`/
  `idempotencyKey`/`approvalVerifier`/`idempotencyStore` are DI seams for
  tests today, mirroring the `provider`/`contextRegistry`/`toolRegistry`
  pattern A1/A5 already established.
- Feeding a succeeded action's `toolResult` into the kernel's user-visible
  response. The kernel still always falls through to the unchanged
  `produceDraftResponse()` stage after a successful tool_call step, exactly
  as A5 already did for its own (never-executed) steps - wiring an action's
  actual result into the response is a future kernel/response-assembly
  concern, not part of proving the execution pipeline itself runs safely.

## Two Lifecycles, Not One

`athena-kernel/lifecycle.ts`'s `ATHENA_A1_LIFECYCLE_TRANSITIONS` table
reserves `executing`/`awaiting_approval`/`partially_succeeded` as
`AthenaKernelState` values "for A2-A6 forward compatibility," but
`athena-kernel.lifecycle.test.ts` asserts, as a structural invariant with no
flag gate, that no `AthenaKernelState` transition may ever reach those three
states. A6 satisfies "A2-A6 re-introduce executing" at the **action** level
(this module's own `AthenaActionState`/`lifecycle.ts`), not by loosening that
kernel invariant. `athena-kernel/lifecycle.ts` has zero changes in this PR.

The kernel instead maps every A6 outcome onto its own, already-legal
`policy_check` edges:

| A6 `AthenaActionResult.state` | Kernel `AthenaKernelState` | Edge already legal via |
| --- | --- | --- |
| `succeeded` | (no denial - loop continues to the next step, then to `succeeded` as before) | `policy_check -> succeeded` (A1 forward edge) |
| `denied` / `awaiting_approval` | `denied` | `policy_check -> denied` (A1 forward edge) |
| `failed` | `failed` | escape state (legal from every non-terminal state) |
| `expired` | `expired` | escape state |
| `cancelled` | `cancelled` | escape state |

No lifecycle table anywhere needed a new edge for this milestone.

## Contracts

`AthenaAction` (C005) is implemented verbatim in
`app/modules/athena-action-engine/types.ts` and validated at runtime by
`assertValidAthenaAction()` (`resultValidation.ts`), following the same
"reject undocumented top-level key" convention as the C003/C004/C007
validators in the sibling modules. `AthenaActionResult` wraps the C003
`AthenaToolResult` a tool handler returns (validated by reusing
`athena-tool-registry/resultEnvelope.ts`'s `assertValidAthenaToolResult`, not
a duplicate) with action-level correlation (`actionId`, `planId`, `stepId`,
`state`) and audit fields (`toolId`, `toolVersion`, `idempotencyKey`,
`compensationPolicy`). `AthenaActionExecutionRequest` and
`AthenaActionAudit`/`AthenaActionOutcome` are A6-internal plumbing, mirroring
`athena-tool-registry/dispatcher.ts`'s `AthenaToolDispatchRequest`/
`AthenaToolDispatchAudit`/`AthenaToolDispatchOutcome` split - not numbered
C0xx contracts, not part of `athena:contracts`.

## Approval Enforcement

The security-critical rule, enforced in `engine.ts`:

```text
A4 decision = deny                              -> never execute
A4 decision = approval_required + no/invalid approval -> never execute (awaiting_approval)
A4 decision = approval_required + valid approval  -> eligible for execution
A4 decision = allow                              -> eligible for execution
```

A6 never manufactures an approval, never treats `approval_required` as
`allow`, and never re-derives permissions, resource scope, or risk - those
remain exclusively A4's job
(`app/modules/athena-permissions/policy.ts`'s `evaluateAthenaPermission()`).
No `AthenaApproval` record contract exists anywhere in this repository or in
`docs/athena/contracts/README.md` (C005 only carries an optional
`approvalId` string on the action itself); `approval.ts` defines the
smallest injectable verification seam consistent with what
`docs/athena/09-security/README.md`'s "High-Risk Action Policy" section
already documents a real approval must eventually bind to - **not** a
parallel numbered contract. Production default
(`createFailClosedAthenaApprovalVerifier()`) verifies nothing and reports
every approval invalid; tests inject `createInMemoryAthenaApprovalStore()`
to exercise the valid-approval path deterministically.

### Decision Identity Binding

A6 is itself an execution boundary, not merely a downstream consumer of A4's
decision: a supplied `AthenaPermissionDecision` is never trusted merely
because a caller attached it to this request. Before resolving the tool or
even inspecting `decision.decision`, `engine.ts` verifies the decision was
actually issued for this exact action:

```ts
decision.orgId === request.orgId
decision.userId === request.actor.id
decision.role === request.role
decision.capability === request.toolId  // re-verified against the resolved tool's own id too
```

Any mismatch fails closed exactly like an explicit `deny`
(`athena_action_permission_denied`, reason code
`permission_decision_mismatch` internally) - a decision for a different org,
actor, role, or tool can never authorize this action, regardless of what its
own `decision` field says. This closes cross-org, cross-actor, cross-role,
and cross-tool decision reuse.

### Authoritative Risk

`AthenaActionExecutionRequest` carries no caller-supplied `risk` field at
all. Once the tool resolves, `tool.risk` (the registered
`AthenaToolDefinition`'s own declared value - `app/modules/athena-tool-registry/`,
C002) is the sole source of truth for the action's risk classification, used
for both the materialized `AthenaAction.risk` and for approval binding
below. A caller cannot downgrade a high-risk tool's audited risk because
there is nothing in the request contract that could do so.

### Exact-Payload Approval Binding

Approval verification (`approval.ts`) binds to every field
`docs/athena/09-security/README.md`'s "High-Risk Action Policy" documents an
approval must eventually bind to:

- `approvalId`, `orgId`
- `actorUserId` - the actor *executing* this action, distinct from a future
  approval record's own "approval actor" (the person who granted it); an
  approval bound to one requesting actor can never authorize a different
  one's action
- `toolId`, `toolVersion`
- `risk` - the tool's own authoritative risk, never a caller-supplied value
- `idempotencyKey` - identifies "this one action"
- a canonical hash of the **validated** tool input (see below) - the
  exact-payload binding 09-security requires; a caller cannot reuse a valid
  approval/idempotency-key pair against a different input
- `planId`/`stepId`, when the approval record itself was scoped to one

`AthenaApprovalRecord` (the in-memory test/dev store) also carries
`approvedAt`/`expiresAt` timestamps. Verification compares the current time
(an injectable clock, `AthenaApprovalStoreOptions.now`, defaulting to the
real system clock) against `expiresAt` independently of the record's
`status` field - a record whose `status` still says `granted` is still
rejected once past its own expiry, never accepted merely because nothing
ever flipped its status.

### Canonical Input Hashing

`inputHash.ts`'s `computeCanonicalInputHash()` hashes the already-validated
tool input (`tool.inputSchema.safeParse(...)`'s parsed output), never raw
unvalidated `request.input` - approval binding happens after input
validation for exactly this reason. It recursively sorts plain-object keys
before hashing (array order is left untouched - order is semantically
significant there) so two structurally-equivalent objects with different
property insertion order still hash identically; plain `JSON.stringify()`
does not guarantee this. SHA-256 via Node's built-in `crypto` module - no
new dependency.

## Idempotency

Honors the A2 tool definition's declared policy:

- `required`: an idempotency key must be present or the action fails
  (`idempotency_key_required`) before the handler ever runs.
- `optional`: deduped only when a key is actually supplied; executes
  normally (nothing to key on) otherwise.
- `not_supported`: never deduped even if a key happens to be present -
  callers cannot depend on suppression that was never promised.

Deduplication is scoped by `orgId::toolId::toolVersion::idempotencyKey`
(`idempotency.ts`'s `buildAthenaIdempotencyScopeKey()`), so two different
orgs or two different tools can never collide on the same literal key
string. A duplicate request returns the original attempt's own
`AthenaActionResult` (including its original `actionId`) without invoking
the handler a second time.

## Timeout And Cancellation

`executeAthenaAction()` races `tool.execute()` against the registered tool's
own `timeoutMs` and against an external `clientSignal` (the kernel's own
request-deadline `AbortController`), structurally mirroring
`athena-tool-registry/dispatcher.ts`'s `raceWithTimeout()` - duplicated
rather than imported, since that helper is module-private there and this is
the only reuse site. A timeout resolves to the action's own `expired` state
(distinct from an ordinary `failed`); a cancellation resolves to `cancelled`
(never `succeeded`). Neither can be overwritten by a late-resolving,
non-cooperative tool - the dispatcher-owned `AbortController` still fires the
tool's own `cancellationSignal`, and the terminal state is already recorded
before that tool promise can settle.

## Deferred Persistence

No production Action/Approval/Idempotency table exists yet, and this
milestone does not add one - the A6 roadmap entry's own deliverables
("Action records and approval gate") do not mandate persistence, and the
task brief for this milestone explicitly defers a migration unless an
existing document requires one. `approval.ts` and `idempotency.ts` each
define the store interface a future durable implementation must satisfy
(the same "application-service-owned persistence seam" posture as
`athena-kernel/executionStore.ts`), and ship only process-local, in-memory
default implementations. This means today's production default only dedupes
idempotency keys and only ever verifies approvals within a single process
lifetime - cross-instance/cross-restart durability is explicitly out of
scope and must be added before A6 handles a real multi-instance deployment
with real approvals.

## Feature Flags

`ATHENA_ACTION_ENGINE_ENABLED` (default `false`), independent of
`ATHENA_KERNEL_ENABLED` and `ATHENA_ROUTER_PLANNER_ENABLED`. Enabling it does
not enable either of the other two. `getAthenaFlags()` re-reads
`process.env` per call with no module-level caching, matching every existing
Athena flag.

- `ATHENA_KERNEL_ENABLED=false` still disables Athena entirely.
- `ATHENA_ROUTER_PLANNER_ENABLED=false` still preserves the A1 fallback path
  (the tool_call loop A6 wires into is unreachable at all in that case).
- `ATHENA_ACTION_ENGINE_ENABLED=false` preserves A5's exact behavior: a
  `deny` decision denies (unchanged), an `approval_required` decision denies
  with `athena_approval_required_no_action_engine` (unchanged), and an
  `allow` decision falls through unexecuted (unchanged) - byte-identical to
  the flag not existing.

## Required Tests

- `athena-action-engine.engine.test.ts`: successful execution (exact
  registered tool/version, exactly once, validated input reaches the
  handler); deny never executes; approval_required with no/invalid/
  mismatched-scope/expired approval never executes and never downgrades to
  allow; a valid, correctly-bound approval executes; invalid input never
  reaches the handler; unknown/removed/wrong-version tool fails closed;
  a thrown exception is normalized with no leaked internal detail; timeout
  produces a distinct `expired` state; cancellation produces `cancelled`,
  never success; a malformed tool result is converted to a safe failure;
  idempotency `required`/`optional`/`not_supported` semantics, including
  the "duplicate key does not execute twice" and
  "not_supported does not dedupe" cases.
  - `describe("permission decision binding")`: a decision naming a
    different tool/actor/org/role than the one being executed fails closed
    and never calls the handler, for each of the four fields independently.
  - A dedicated test proves the materialized action's `risk` always equals
    the resolved tool's own `risk`, even when a caller attaches an
    unsanctioned `risk` property to the request object (bypassing the type
    system) - the engine never reads it.
  - `describe("approval binding")`: cross-actor approval reuse; a risk
    mismatch between the approval and the tool's current authoritative
    risk; an expired approval (both via a naturally-past `expiresAt` and via
    an injected clock, proving determinism without a real sleep); an
    approval bound to a different plan/step than the one being executed,
    and that an unscoped approval (no planId/stepId on the record) is
    accepted for any plan/step; changed-input replay of the same
    approval/idempotency key; and that a structurally-identical input with
    different object-key insertion order still verifies (a custom
    record-typed fixture tool, since the shared echo fixture's schema has
    only one field).
- `athena-action-engine.lifecycle.test.ts`: the full pairwise transition
  matrix, terminal-state immutability, and specific illegal transitions
  (`created -> running`, `created -> succeeded`, `pending -> denied`).
- `athena-action-engine.contracts.test.ts`: C005 `AthenaAction` and the
  `AthenaActionResult` envelope, valid and malformed, backing
  `athena:contracts`.
- `athena-action-engine.import-boundary.test.ts`: no direct
  `db/client`/`db/requestSession`/`@prisma/client`/application-service
  imports - A6 reaches application services only through the injected A2
  registry.
- `athena-kernel.service.test.ts`'s new "A6 action engine orchestration"
  block: end-to-end successful execution through the kernel; flag-off parity
  with A5; missing-permission denial through the kernel; approval-required
  denial with no approval through the kernel; approval-required success
  with a valid approval through the kernel; a kernel-level duplicate
  idempotency-key submission.

## Exit Criteria

Duplicate execution is safe: a repeated request with the same idempotency
key never invokes a tool handler twice, proven at both the engine level and
through the kernel. No security boundary A4/A2 already established is
weakened: every execution still resolves the registered `AthenaToolDefinition`
through A2, every permission/risk/approval decision still originates from
A4, and a `deny` decision is provably unreachable by `executeAthenaAction()`
even as defense-in-depth. Rollback: `ATHENA_ACTION_ENGINE_ENABLED=false`
restores A5's exact tool_call-step behavior with no other change required.
