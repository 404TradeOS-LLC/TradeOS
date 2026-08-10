# Athena A1 Parallel Readiness Review

Status: Draft review for PR
Reviewer: Claude, running as parallel reviewer alongside Codex
Scope: Independent verification of the A0.5-corrected Athena Bible and Codex's
`docs/athena/roadmap/A1-ai-kernel-implementation-plan.md`, checked against
current TradeOS repository implementation evidence rather than against the
Bible's own prose.
Date: 2026-08-09
Base branch at review time: `docs/athena-a0-5-architecture-review`
Method: six parallel read-only subagents, each independently grepping and
reading repo evidence, cross-checked and spot-verified by hand before
inclusion here.

## Executive Readiness Verdict

GO for A1 implementation as scoped by Codex's implementation plan, with two
required pre-merge corrections and one architectural finding that must be
recorded as a named pre-A2/A6 blocker now, before mutating tools exist.

The A0.5 corrections (commit `c9c5bf2`) were substantive, not cosmetic — every
high-risk theme from A0.5 has real prose and contract changes behind it. Codex's
A1 plan independently narrows A1 further in the right direction: it drops
`executing`, `awaiting_approval`, and `partially_succeeded` from A1's reachable
states, keeps the kernel dark by default, and defers business context, memory,
and mutating tools past A1. That narrowing defuses most of what this review
found, because most of the gaps below only bite once real mutation, real
pause states, or real business context arrive — which A1 correctly avoids.

One finding does not wait for A2: the request-scoped Prisma transaction model
that every authenticated TradeOS request currently uses is structurally
incompatible with the kernel's own approval-pause and cancellation model as
documented in the Bible. It doesn't block A1's no-op/draft path, but it will
silently break the first mutating or pausable execution unless it is named now
and designed around before A6.

Finding counts: 0 new blockers to A1 itself, 5 high-risk findings (1
cross-cutting architectural, 4 documentation/enforcement gaps), 7 medium
findings, 2 low findings.

## Blockers

None for A1 as currently scoped by Codex's plan. HIGH-P1 below must be
recorded as a named blocker for A2 tool execution and A6 action engine, not
for A1.

## High-Risk Findings

### HIGH-P1: The per-request Prisma transaction model structurally conflicts with the kernel's pause/cancellation model

Three independent subagents (kernel lifecycle, auth/RLS, tool execution)
converged on this from different angles, which is why it is ranked first.

Repository evidence:

- `app/backend/middleware/databaseSession.ts:13-41` (`waitForResponse`) wraps
  the entire request lifecycle in `runWithDatabaseSession`, resolving/rejecting
  only when the HTTP response finishes, closes, or errors. Its purpose is to
  keep one Prisma transaction open until the response completes — it is not a
  cancellation source.
- `app/db/requestSession.ts:20-42` opens exactly one `client.$transaction(...)`
  per request and sets `app.user_id`/`app.org_id`/`app.role`/
  `app.session_source` inside it via `set_config`.
- `app/db/requestSession.ts:89-93` (`parseTransactionTimeout`) defaults to a
  hard **60,000ms** transaction timeout, configurable only by
  `RLS_TRANSACTION_TIMEOUT_MS`.
- A repository-wide grep of `app/backend/` and `app/db/` for `AbortController`
  or `AbortSignal` returns zero hits. Nothing in the current stack constructs,
  threads, or fires one.

Athena evidence:

- `docs/athena/05-runtime/README.md:59,93-110` requires `awaiting_approval` to
  be a real pause state where "pending approvals remain pending," and requires
  `AthenaToolExecutionContext.cancellationSignal` to be checked "before
  mutation, before external calls, and before returning success."
- `docs/athena/contracts/README.md:164` types `cancellationSignal: AbortSignal`
  with no note on where it originates.
- `docs/athena/roadmap/A1-ai-kernel-implementation-plan.md:258` says "Use
  `AbortController`/`AbortSignal` for provider cancellation" without stating
  whether it is kernel-owned or derived from existing middleware.

Failure mode:

If a future mutating tool (A6) writes inside the same ambient per-request
transaction that started before the kernel began planning, one of two things
happens: an approval pause longer than ~60s forces Postgres to kill the
transaction mid-flight (losing RLS session vars and any uncommitted state,
surfaced to the caller as an unrelated "transaction timeout"), or the tool's
actual write is deferred to a second, later request/transaction that cannot
see the original execution's cancellation signal — making "check cancellation
before mutation" untestable against the transaction that actually commits.
Separately, several concurrent kernel executions each holding an open
transaction for tens of seconds (waiting on model output or human approval)
can exhaust the connection pool well before any timeout fires, since
`app/db/client.ts` sets no explicit `connection_limit`.

This does not block A1: A1 explicitly excludes `executing`,
`awaiting_approval`, and `partially_succeeded` from its reachable states
(`A1-ai-kernel-implementation-plan.md:156`), so no mutating or long-paused
transaction exists yet. But nothing in the Bible or the A1 plan currently says
this pattern must change before A2/A6 — it is not named as a design
constraint anywhere.

Smallest correction:

1. In A1, state explicitly (in `05-runtime/README.md` or the A1 plan) that the
   kernel's `AbortController`/deadline is **kernel-owned**, constructed at
   kernel entry, and is not derived from Express `res` events or the existing
   `databaseSession` middleware — those exist to hold DB work open, not to
   signal cancellation.
2. Before A2 tool execution or A6 action engine begins, add one sentence to
   `docs/athena/05-runtime/README.md` and `docs/athena/06-tool-registry/README.md`:
   mutating or pausable tool execution must never reuse the ambient
   request-scoped transaction; each attempt must open and close its own short
   transaction (reusing the re-authentication pattern already proven by
   `runWithBackgroundDatabaseSession`, `app/db/requestSession.ts:50-87`), with
   approval waits happening *between* transactions, never inside one.
3. Record this as a named pre-A6 blocker in the roadmap so it isn't
   rediscovered mid-implementation.

### HIGH-P2: No persistence schema exists anywhere for the kernel execution record

Repository evidence:

- `app/prisma/schema.prisma` contains zero Athena-related models (verified by
  grep for `Athena`/`athena_execution`/`AthenaExecution` across the repo — no
  matches, no migration file exists).

Athena evidence:

- `docs/athena/05-runtime/README.md:44` and the A1 readiness checklist in
  `docs/athena/reviews/A0.5-architecture-review.md:443` both require "a
  persisted lifecycle state and timestamp history" / "persisted execution
  IDs... plan/step state, attempts, terminal outcomes," with no concrete
  table or column list anywhere.
- `docs/athena/contracts/README.md:217-257` (C005 Action) is a bare TypeScript
  interface with no store binding.

Codex's plan already surfaces this as a risk (`A1-ai-kernel-implementation-plan.md:377`:
"Persisted execution records may require a new schema and RLS policy. That
migration is not part of this planning PR and must be explicitly reviewed
before implementation") and hedges A1 scope accordingly ("even if the first
implementation uses a narrow storage strategy behind an application-service
seam," line 50). That hedge is the right call for a planning document, but it
means the A1 exit criterion "Lifecycle state transitions are implemented
through a tested helper" (line 437) is currently satisfiable with an in-memory
or ephemeral store that would not survive a process restart — which is fine
for A1's own no-op/draft scope, but should not be allowed to silently become
the permanent answer once A2+ needs real resumability.

Smallest correction: before A1 code review, make one explicit decision (even
if narrow) on where the execution record lives for A1 — in-memory/per-request
only, or a new minimal Prisma table — and say so in the plan rather than
leaving "narrow storage strategy" unresolved. If in-memory, state plainly that
A1 provides no crash-durable execution history, so reviewers don't assume
otherwise.

### HIGH-P3: Object-level RLS scoping exists only for jobs; invoices/proposals/contracts are org-scoped only

Repository evidence:

- `app/prisma/migrations/20260714120000_add_job_scheduling_engine/migration.sql:76-89`
  (`jobs_select_policy`) restricts technician-role reads to jobs where a
  matching `job_assignments` row exists for `current_app_user_id()` — a real,
  enforceable assignment-scoped precedent.
- `app/prisma/migrations/20260624100000_add_proposals_invoices_contracts/migration.sql:79-96`
  (`proposals_select_policy`, `invoices_select_policy`) scope only to
  organization membership via a `projects` join — no assignment or ownership
  check. Verified directly: `exists (select 1 from projects where
  projects.id = invoices.project_id)` with no `user_id`/`assignee` condition.
- `docs/RBAC_MATRIX.md:53` grants technicians `billing.read` org-wide.

Athena evidence:

- `docs/athena/09-security/README.md:35-38` claims "Providers and tools must
  ask service-owned queries for actor-scoped data instead of broad org-scoped
  data," implying such scoping exists or is trivially addable. It is not
  trivially addable for invoices/proposals/contracts today — it does not
  exist at the RLS layer, and no service-layer filter substitutes for it
  (grepped `app/modules/jobs/service.ts` and related controllers; no
  `auth.userId`-based filtering found for these entities).

Failure mode: this does not affect A1, which excludes all business context
providers. It becomes live the moment A3 adds a `costbook`/billing-adjacent
context provider or A4 wires object-level policy for a technician-facing
tool — at that point, a technician's Athena context request for "my
invoices" would, without new work, return every invoice in the organization.

Smallest correction: name `jobs`/`job_assignments` as the only existing
object-scope precedent in `docs/athena/09-security/README.md`, and add an
explicit A3/A4 pre-requisite: invoices, proposals, and contracts need either
assignment-scoped RLS or an equivalent service-layer WHERE clause before any
Athena context provider or tool exposes them to non-owner/admin/dispatcher
roles.

### HIGH-P4: C011 telemetry has no typed schema or durable audit storage anywhere in the repo today

Repository evidence:

- `app/backend/logging.ts` defines `logInfo`/`logWarn`/`logError` over a free-form
  `{[key: string]: unknown}` metadata bag, JSON-stringified to stdout — no
  schema, no required-field validation, nothing resembling
  `AthenaTelemetryRecord`.
- `app/backend/middleware/productionHardening.ts:27-40` only ever logs
  `requestId, method, path, statusCode, durationMs, ip`.
- No APM/log-aggregation backend exists (no winston/pino/Sentry/Datadog in
  `app/package.json`) — everything is raw stdout.

Athena evidence:

- `docs/athena/contracts/README.md:398-422` (C011) requires a typed shape with
  `orgId`, `traceId`, `executionId`, `spanType`, `redaction`, and a typed
  `cost` object.

Codex's plan already requires building this (`app/modules/athena-kernel/telemetry.ts`,
"Emit C011-shaped metadata with redaction and cost fields," line 89, plus a
full "Telemetry, Audit, And Cost Records" section and redaction tests). That
correctly treats this as new A1 work rather than assuming existing logging
suffices — the gap is real but already scoped into the plan. The one thing
still missing: `athena:contracts` (`A1-ai-kernel-implementation-plan.md:339`)
should explicitly include a runtime shape-validation test against the C011
interface, not just "contracts validated" — otherwise two implementers can
both pass a vague gate while emitting incompatible field shapes.

Smallest correction: add one bullet to the A1 plan's testing requirements —
"`athena:contracts` includes a schema/shape check for every emitted
`AthenaTelemetryRecord`, not just presence of a telemetry call."

### HIGH-P5: Cancellation has no real signal source in the current stack — restated plainly for A1's own exit criteria

This is the concrete, A1-scoped restatement of HIGH-P1's root cause, called
out separately because it directly touches an A1 exit criterion rather than a
future one.

`A1-ai-kernel-implementation-plan.md:443` lists "Timeout, cancellation, and
shutdown behavior are tested" as an A1 exit criterion, and line 258 says to
use `AbortController`/`AbortSignal` for provider cancellation. As shown above,
nothing in the existing middleware stack provides one — the kernel must
construct and own its own `AbortController`, fired on deadline or client
disconnect, entirely independent of `databaseSession.ts`'s response-lifecycle
listeners. This is achievable for A1 (A1 has no mutating work to protect), but
the plan should say so explicitly rather than let "use AbortController" read
as if a suitable one might already exist somewhere in the stack.

Smallest correction: same as HIGH-P1 item 1 — one explicit sentence stating
the AbortController is kernel-owned, not middleware-derived.

## Medium Findings

### MEDIUM-1: No reusable permission-adapter seam exists; only `hasAnyPermission`/`normalizeRole` are genuinely portable

`app/backend/requestContext.ts:11,27,35` (`requireOrgId`, `requirePermissions`,
`requireRoles`, `requireOrgAccess`) all take an Express `Request` and read
`req.auth`/`req.orgId` — structurally incompatible with
`AthenaToolExecutionContext` (`contracts/README.md:156-167`), which carries no
`Request`. The only Request-independent, directly reusable pieces are
`hasAnyPermission`/`getRolePermissions`/`normalizeRole` in
`app/domain/contracts.ts:94-104`. Codex's plan already scopes a new
`app/modules/athena-kernel/policy.ts` seam (line 87) rather than assuming
reuse, which is correct — but its Risks section ("Existing RBAC checks are
often controller-owned," line 376) should say plainly that
`requireOrgId`/`requireRoles`/`requireOrgAccess` are not adaptable and must
not be reused even by reference, so an implementer doesn't waste a review
cycle discovering that the hard way.

### MEDIUM-2: `AuthContext.canonicalRole` is optional and not structurally enforced

`app/backend/auth/context.ts:7` declares `canonicalRole?: CanonicalRole` as
optional, even though `app/backend/auth/session.ts:52` always populates it via
`normalizeRole(membership.role)` in the current auth-resolution path. Because
it's optional, downstream TypeScript code can (and in places does, e.g.
`requestContext.ts` reading raw `auth.role`) bypass it and read the raw
`SupportedRole`, which still includes legacy `estimator`/`viewer` values per
`docs/RBAC_MATRIX.md:82`'s own admission that "compatibility values may still
appear in stored memberships." Correction: either make `canonicalRole`
required on `AuthContext`, or require the new Athena permission adapter to
call `normalizeRole()` itself rather than trust an optional upstream field.

### MEDIUM-3: Kernel lifecycle has no cap on the clarification/degraded round-trip cycle

Walking the state table in `docs/athena/05-runtime/README.md:50-68`:
`routing` → `needs_clarification` → `context_building` → `degraded` →
`routing` forms a live cycle with no attempt counter anywhere in the state
table (`attempt` in C005, `contracts/README.md:244`, scopes only to
`executing`, which A1 never reaches). Nothing prevents a request from bouncing
between these states indefinitely, burning provider calls, until an external
timeout intervenes. Correction: add a max round-trip counter to the state
machine that forces `failed`/`cancelled` after N clarification/degraded
cycles — cheap to add now, before any implementation encodes the unbounded
version.

### MEDIUM-4: Checkpoint shape is undefined

`contracts/README.md:245` types `checkpoint?: Record<string, unknown>` with no
subfields. `05-runtime/README.md:71` requires resume to have "a persisted
checkpoint" but never says what one contains. Low urgency for A1 itself, since
A1 excludes all resumable states, but should be defined (e.g.
`{lastCompletedStepId, committedIdempotencyKeys[], planVersion,
contextSnapshotRef, resumeAttempt}`) before A6 needs it, not discovered then.

### MEDIUM-5: Named testing gates exist in docs but are not wired into CI, and nothing blocks a merge that skips them

Confirmed by repo-wide grep: `athena:contracts`/`athena:smoke`/`athena:eval`/
`athena:perf` exist only as text inside `docs/athena/**` — zero hits in any
`.json`/`.yml`/`.yaml`. `.github/workflows/verify-repository.yml:16-95` runs
exactly three jobs (`app`, `app-integration`, `web`), none Athena-aware.
`scripts/docs-check.mjs` enforces only generic front-matter/link rules, not
gate presence. Codex's plan correctly requires the scripts to exist or be
explicitly recorded as blockers before A1 exit (line 339, line 447), which
closes the "silently skip it" loophole HIGH-006 originally flagged — but
nothing requires the scripts, once they exist, to actually run as a required
CI check. A script that exists but isn't wired into
`verify-repository.yml` blocks nothing. Smallest correction: add to the A1
plan's Named Validation Gates section that `athena:contracts` and
`athena:smoke`, once added to `app/package.json`, must also be added as a job
(or job step) in `.github/workflows/verify-repository.yml` before A1 is
considered exit-complete — not just present as an npm script.

### MEDIUM-6: Cost telemetry has no budget-enforcement mechanism to attach to

The only rate-limiting infrastructure found (`app/backend/middleware/authRateLimit.ts`,
`aiEstimateRateLimit.ts`, `platformProvisioningRateLimit.ts`, all built on
`express-rate-limit`) is per-IP request-count throttling with no token/cost
awareness. No `quota`/`spendLimit`/`costCeiling` code exists anywhere in
`app/`. This matches the original review's MEDIUM-017 and is fine for A1,
where cost tracking is explicitly record-only (Codex's plan, line 301: cost
tracking flag is "Records token/cost metadata," not enforces it) — but the A1
plan should say in one sentence that cost *enforcement* (stopping spend) is
out of scope through at least A6, so "cost tracking enabled" is never
mistaken for "spend is capped."

### MEDIUM-7: ai-estimate-assist's idempotency pattern is bespoke and does not generalize cleanly to C005's single `idempotencyKey`

`docs/modules/ai-estimate-assist.md` describes signed review tokens bound to
estimate/org/line/target/engine-version/issue-time, plus server-built source
keys and per-estimate write serialization — a multi-part mechanism, not a
single string. C005's `idempotencyKey` (`contracts/README.md:232`, described
as "action ID + target" in `05-runtime/README.md:87`) is one field. Not
relevant to A1 (no mutating tools), but real generalization work — a shared
"target reconciliation" service hook, not just a key field — is needed before
A6 can treat this as solved. Correction: note in the A6 pre-requisites that
`idempotencyKey` is necessary but not sufficient, and that a generalized
reconciliation hook is separate work.

## Low Findings

### LOW-1: Context engine's mandatory tenant-scoped cache-key policy has zero supporting infrastructure today

`app/modules/knowledge-runtime/cache.ts` is a single module-level variable
(`cachedSnapshot`) with no key parameter at all — not org, not actor, not
input (grepped the whole module for `orgId`: zero matches). This is currently
correct because the cached data is non-tenant reference material (costbook/
assembly content), not business state — but C010's mandatory
`cacheKeyPolicy: "tenant_actor_permission_input"` (`contracts/README.md:383,393`)
has no adaptable mechanism here; any future tenant-scoped provider that
copies this caching pattern would violate C010 by construction, silently
serving one org's data to another. Correctly deferred to A3 by Codex's plan
("Context caching" is an A3 deferral) — flagging now only so A3 isn't assumed
to be a light lift on top of existing infrastructure.

### LOW-2: Global search fan-out has no selected-scope or object-level narrowing

`app/modules/intelligence/service.ts`'s global search (fanning out across
customer/project/estimate/invoice/document sources when no `entityTypes` is
given) takes only `orgId` and a query string — no actor, assignment, or
selected-scope parameter anywhere in the search source signatures. Existing
item-count budgeting (`clampLimit`, 20/source, 50 total) is a real precedent
for C001's `maxItems`, but there is no byte/token budget and no freshness
hash/version anywhere in this module or knowledge-runtime. Also correctly
deferred to A3 — flagged for the same reason as LOW-1.

## What Codex Should Incorporate Into The A1 Implementation Plan

1. State explicitly that the kernel's `AbortController`/deadline is
   kernel-owned and independent of `databaseSession.ts`'s response-lifecycle
   listeners (HIGH-P1, HIGH-P5).
2. Make one explicit storage decision for the A1 execution record (in-memory
   vs. a new minimal table) rather than leaving "narrow storage strategy"
   open, and state plainly if A1 provides no crash-durable history (HIGH-P2).
3. Add a C011 shape-validation check to `athena:contracts`, not just presence
   of a telemetry call (HIGH-P4).
4. Require `athena:contracts`/`athena:smoke`, once they exist as scripts, to
   also be wired as a required job/step in
   `.github/workflows/verify-repository.yml` before A1 counts as exit-complete
   (MEDIUM-5).
5. State that `requireOrgId`/`requireRoles`/`requireOrgAccess` in
   `requestContext.ts` are not reusable for the Athena permission adapter —
   only `hasAnyPermission`/`normalizeRole` are (MEDIUM-1).
6. Require the new permission adapter to call `normalizeRole()` itself rather
   than trust `AuthContext.canonicalRole`, since that field is optional
   (MEDIUM-2).
7. Add a round-trip cap to the `needs_clarification`/`degraded` cycle in the
   state machine (MEDIUM-3).
8. Record HIGH-P1's transaction-per-request-vs-pause-model conflict and
   HIGH-P3's invoices/proposals/contracts object-scope gap as named
   pre-requisites for A2/A6 and A3/A4 respectively, so they are designed
   around rather than rediscovered mid-implementation.

## What Should Remain Deferred

- Checkpoint schema definition (MEDIUM-4) — genuinely not needed until A6.
- Idempotency-key generalization beyond ai-estimate-assist's bespoke pattern
  (MEDIUM-7) — A6.
- Cost budget/spend enforcement (MEDIUM-6) — no earlier than A6, likely later.
- Tenant-scoped cache-key infrastructure and object-level context filtering
  for search/knowledge-runtime (LOW-1, LOW-2) — correctly A3, not A1.
- Object-level RLS for invoices/proposals/contracts (HIGH-P3) — needed before
  A3/A4 exposes these to non-owner/admin/dispatcher roles, not before A1.

## Final Assessment

The A0.5 corrections and Codex's A1 plan are both directionally sound and
already narrow enough that none of these findings block A1's no-op/draft
kernel from shipping. The one finding worth elevating above "documentation
nit" status is HIGH-P1: three independent read-only reviews, approaching the
codebase from lifecycle, auth, and tool-execution angles respectively, landed
on the same structural fact — TradeOS's one-transaction-per-request RLS
pattern was built for short HTTP request/response cycles, and the Athena
kernel's approval-pause and cancellation model was designed without reference
to that constraint. Naming it now, before A2 tool execution begins, is
strictly cheaper than discovering it when the first mutating tool's approval
pause outlives a 60-second Postgres transaction.
