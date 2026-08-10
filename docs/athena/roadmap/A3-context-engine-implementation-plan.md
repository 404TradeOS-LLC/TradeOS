---
status: draft
owner: platform
last_verified: 2026-08-10
source_of_truth: true
related_docs:
  - ../README.md
  - ../roadmap.md
  - ../05-runtime/README.md
  - ../06-tool-registry/README.md
  - ../07-context-engine/README.md
  - ../09-security/README.md
  - ../12-testing/README.md
  - ../contracts/README.md
  - ../reviews/A0.5-architecture-review.md
  - ../reviews/A1-parallel-readiness-review.md
  - A1-ai-kernel-implementation-plan.md
  - A2-tool-registry-implementation-plan.md
  - ../../TRADEOS_BIBLE.md
  - ../../ARCHITECTURE.md
  - ../../RBAC_MATRIX.md
---

# A3 Context Engine Implementation Plan

Milestone: A3 - Context Engine
Purpose: convert the corrected C001/C010 contracts into a working, minimal-by-default
context assembly engine with the first two existing-app-backed providers, proving the
provider pattern (activation, budget, sensitivity, freshness, degraded/omitted
behavior) before any high-PII or unresolved-object-scope section is attempted.
Implementation posture: backend-first, standalone-testable, minimal-by-default,
contract-test-gated, not yet wired into the live kernel HTTP path.

## A2 Acceptance Summary

A3 planning starts from a verified-complete A2. `feat(athena): add A2 tool registry`
(PR #105) and its two review-fix follow-ups (`fix(athena): address A2 registry
review findings`, `fix(athena): bind dispatch telemetry to request context and
validate error field types`, `fix(athena): normalize tool-returned
error.correlationId to the dispatch trace`) are merged to `main`. Verdict: **PASS**.

- `app/modules/athena-tool-registry/**` implements a code-defined registry,
  a deterministic non-LLM permission/risk dispatcher, C003 envelope
  enforcement, and two no-op fixture tools - no business tool, no live
  kernel wiring, no database access from tool code (enforced by a static
  import-boundary test).
- All four bot-flagged review findings were fixed and their threads
  resolved: version-enumeration hiding, already-cancelled client signal
  still starting execution, missing telemetry-reference validation, and
  non-semver version acceptance. A follow-up founder-flagged finding (tool
  ID format) and two later findings (dispatch-context telemetry binding,
  error.correlationId normalization) were also fixed.
- `athena:contracts` now covers both the kernel and the registry; CI is
  green across lint, build, unit tests, integration tests, and CodeQL.
- Final registry test count: 73 tests across 4 files, all passing.

Two prerequisites named during A1/A2 remain open and are directly relevant
to A3's scope decisions below:

- **Pre-A3/A4 object-scope prerequisite (HIGH-P3):** `invoices`, `proposals`,
  and `contracts` RLS policies (`app/prisma/migrations/20260624100000_add_proposals_invoices_contracts/migration.sql`)
  remain org-scoped only - no assignment/ownership check, unlike
  `jobs`/`job_assignments`. Confirmed still true as of this plan (no newer
  migration touches these policies). This blocks any billing/document
  context provider from reaching non-owner/admin/dispatcher roles.
- **Pre-A2/A6 transaction prerequisite (HIGH-P1):** still relevant only to
  mutating/pausable work. Context providers are read-only, so they may run
  inside whatever properly-scoped database session is active (the ambient
  request-scoped transaction once wired into a live request, or a
  dedicated scoped session in standalone/test use) - HIGH-P1's concern
  about approval pauses and mutation does not apply to reads.

## A3 Scope

A3 builds the smallest context engine that proves the C001/C010 contract
pattern end to end, using only data the app already serves through
RLS-protected services - no new external integrations, no unresolved
object-scope entities, no live kernel wiring yet.

In scope:

- Extend `AthenaAIContext` (`app/modules/athena-kernel/types.ts`) with the
  optional provider-section fields C001 already defines
  (`knowledgeEngine`, `dispatch`, and the rest of the section names as
  typed-but-unpopulated placeholders), plus the shared
  `AthenaProviderSection<TData>` and `AthenaFreshnessEvidence` shapes. This
  is additive only: no existing A1/A2 code path sets these fields, so every
  existing test (including the A1 assertions that the minimal context
  `not.toHaveProperty("customers")` etc.) keeps passing unchanged.
- A new `app/modules/athena-context-engine/` module implementing:
  - `AthenaContextProviderDefinition` (C010) contracts, narrowed the same
    way A1/A2 narrowed C001-C003.
  - A code-defined, non-persisted provider registry (`register`/`resolve`/
    `discover`), structurally parallel to but independent from
    `athena-tool-registry`'s registry - not a shared generic abstraction,
    per the same over-engineering caution the A0.5 review already applied
    to multi-provider abstraction ("limited to a small provider adapter
    boundary until a second provider is actively needed").
  - A context assembler that activates providers by mode
    (`eager_minimal`/`lazy_intent`/`explicit_only`), enforces per-provider
    and total budget (`maxItems`, `maxBytes`, `maxProviderCount`), enforces
    provider timeout via a dispatcher-owned deadline (reusing the A2
    dispatcher's `raceWithTimeout` pattern), computes freshness evidence,
    and degrades or omits per each provider's declared `failureBehavior`
    without ever fabricating a fact or silently widening scope to find
    substitute data.
  - A tenant-qualified cache helper enforcing C010's mandatory
    `tenant_actor_permission_input`-keyed cache policy for any provider
    that declares caching, closing the LOW-1 gap named in the A1 parallel
    readiness review before any tenant-scoped provider can reuse
    `knowledge-runtime/cache.ts`'s un-keyed pattern.
- Exactly two first-party providers, both backed by data the app already
  serves through existing RLS-protected services:
  1. **`knowledgeEngine` provider** - wraps `KnowledgeRuntimeService`
     (`app/modules/knowledge-runtime/service.ts`). Non-tenant reference
     data (costbook/assembly/trade knowledge), `sensitivity: "public"`,
     `activation: "eager_minimal"` or `"lazy_intent"` (decided during
     implementation based on measured size), no RLS involved.
  2. **`dispatch` provider** - actor-scoped job list, reusing the existing
     `jobs_select_policy` RLS (`app/prisma/migrations/20260714120000_add_job_scheduling_engine/migration.sql`)
     that already restricts technician-role reads to jobs with a matching
     `job_assignments` row for `current_app_user_id()`. Calls
     `JobsService.list()` inside a properly-scoped database session so RLS
     narrows the result set by role without the provider adding its own
     duplicate actor filter. `sensitivity: "internal"`, `activation:
     "lazy_intent"`, `freshness.status` computed from the read (`live` or
     `fresh`, never fabricated).
- Freshness evidence (`fetchedAt`, `expiresAt`, `ttlMs`, `cacheHit`,
  `sourceVersion` or `sourceHash`, `revalidatedAt`) for both providers,
  including a documented decision for `knowledgeEngine`'s `sourceVersion`
  (the existing loader has no content hash or version today - LOW-1 in the
  A1 parallel readiness review flagged this gap; A3 must either add a
  content hash to `knowledge-runtime/loader.ts` or record
  `sourceVersion: "unknown"` explicitly rather than fabricate one).
- Selected-scope handling: `AthenaSelectedScope` (already defined in A1's
  types) is read as a narrowing input by the `dispatch` provider, never
  treated as proof of access by itself.
- Degraded/partial context behavior: a non-critical provider failure
  produces a `status: "degraded"` or `"unavailable"` section plus a
  warning, never a stopped assembly; a critical provider failure (none of
  A3's two providers are marked critical) would stop dependent planning,
  exercised by a test even though A3 has no real critical provider yet.

Out of scope for wiring, in scope for infrastructure: the assembler is
built and independently tested but is **not** called from
`AthenaKernelService.handleRequest()` in A3. See "No Live Kernel Wiring"
below.

## A3 Non-Goals

A3 must not implement:

- Any provider for `customers`, `costbook`, `inventory`, `notifications`,
  `weather`, `calendar`, `workspace`, `dashboard`, or `conversation`. See
  "Deferred Sections" below for the specific reason each is held back.
- Any provider touching `invoices`, `proposals`, or `contracts` data. This
  is a hard block, not a scheduling choice: HIGH-P3 is unresolved.
- Wiring the assembler into `AthenaKernelService.handleRequest()` or any
  other live HTTP-reachable path.
- A model-driven or heuristic intent router that decides which providers to
  activate. A3's `lazy_intent`/`explicit_only` activation modes are typed
  and enforced by the assembler, but nothing yet calls them with a real
  intent signal - that is A5 Router/Planner's job.
- Memory, plugins, autonomous writes, or approval-paused execution -
  unchanged from A1/A2's standing non-goals.
- A generic provider/tool abstraction shared between
  `athena-context-engine` and `athena-tool-registry`. Structural
  similarity is fine; a shared base class or generic dispatcher is not,
  until a third consumer actually needs one.
- Performance/perf-budget enforcement (`athena:perf`). Roadmap.md lists it
  as "when available" for A3; A3 may record provider timing in tests but
  must not claim perf-gate coverage it doesn't have.
- A database-persisted provider catalog or cache. Both remain code-defined/
  in-memory, matching A2's registry precedent and the roadmap's actual A3
  deliverable list ("Provider contracts, selected scope, sensitivity,
  freshness metadata, degraded context" - no persistence requirement).

## No Live Kernel Wiring

A1's kernel exit criteria required "bounded minimal context containing
request, organization, user, permissions, conversation reference, and
telemetry metadata" with no broad business provider sections, and A1's
tests assert the minimal context never carries a `customers`/`costbook`/
`knowledgeEngine` key. A3 must not weaken that: `AthenaKernelService`,
`athena.controller.ts`, and `athena.routes.ts` are not touched by this
plan. The context engine is built and proven standalone so that A5's router/
planner has a working, tested provider system to call once it can decide
*which* providers a given intent actually needs - calling it eagerly from
every A1 draft-response request today would both violate A1's own
minimal-context exit criterion and waste a live database read on every
request regardless of whether anything downstream uses it.

## Required Backend Seams

New module, following the existing `app/modules/<name>/` pattern:

| Seam | Suggested location | A3 responsibility |
| --- | --- | --- |
| Context engine types | `app/modules/athena-context-engine/types.ts` | `AthenaContextProviderDefinition`, provider execution context, assembly result/budget types narrowed from C010 |
| Provider registry | `app/modules/athena-context-engine/registry.ts` | `register()`/`resolve()`/`discover()` for context providers, id/version validated the same way A2's tool registry validates `AthenaToolDefinition` |
| Assembler | `app/modules/athena-context-engine/assembler.ts` | Activates providers by mode, enforces per-provider/total budget, enforces timeout via a dispatcher-owned deadline, computes freshness, applies failure behavior, never fabricates or widens scope |
| Cache | `app/modules/athena-context-engine/cache.ts` | Tenant-qualified (`tenant_actor_permission_input`) cache key builder and a simple in-memory TTL cache, distinct from `knowledge-runtime/cache.ts`'s un-keyed pattern |
| Redaction | `app/modules/athena-context-engine/redaction.ts` | Applies `deniedFields`/sensitivity-based omission before a section is attached to the assembled context |
| Errors | `app/modules/athena-context-engine/errors.ts` | Structured provider-failure taxonomy reusing `AthenaToolError`'s shape (imported type-only from `athena-kernel/types.ts`), matching A2's precedent of not inventing a parallel error shape |
| `knowledgeEngine` provider | `app/modules/athena-context-engine/providers/knowledgeEngineProvider.ts` | Wraps `KnowledgeRuntimeService`; no database access |
| `dispatch` provider | `app/modules/athena-context-engine/providers/dispatchProvider.ts` | Wraps `JobsService.list()` inside a properly-scoped database session; no direct Prisma import |
| Extended context type | `app/modules/athena-kernel/types.ts` (edited, not replaced) | Add optional `AthenaProviderSection<TData>`/`AthenaFreshnessEvidence` types and the corresponding optional fields on `AthenaAIContext` |

Controllers/routes: none required for A3, matching A2's precedent - no new
HTTP endpoint is exposed; the engine is validated through unit/contract/
integration tests only.

## Minimal Context Provider Contract/Interfaces

```ts
// app/modules/athena-context-engine/types.ts
export type AthenaContextActivationMode = "eager_minimal" | "lazy_intent" | "explicit_only";
export type AthenaContextSensitivity = "public" | "internal" | "confidential" | "restricted";
export type AthenaContextCriticality = "critical" | "important" | "optional";
export type AthenaContextFailureBehavior = "stop" | "degrade" | "omit";
export type AthenaContextCacheKeyPolicy = "none" | "tenant_actor_permission_input";

export interface AthenaContextProviderDefinition<TData = unknown> {
  id: string;                 // stable reverse-domain id, e.g. "tradeos.athena.context.dispatch"
  version: string;            // semver, validated the same way A2 validates tool versions
  owner: string;
  section: string;            // C001 section name this provider contributes, e.g. "dispatch"
  permissions: string[];
  activation: AthenaContextActivationMode;
  allowedIntents: string[];   // empty until A5 has real intents to gate on
  freshnessTtlMs: number;
  timeoutMs: number;
  maxItems: number;
  maxBytes: number;
  sensitivity: AthenaContextSensitivity;
  cacheKeyPolicy: AthenaContextCacheKeyPolicy;
  criticality: AthenaContextCriticality;
  failureBehavior: AthenaContextFailureBehavior;
  fetch(input: AthenaContextProviderInput): Promise<AthenaContextProviderFetchResult<TData>>;
}

export interface AthenaContextProviderInput {
  orgId: string;
  actor: { userId: string; role: CanonicalRole };
  selectedScope: AthenaSelectedScope;
  deadline: Date;
  cancellationSignal: AbortSignal;
  // No Prisma client, request-scoped transaction handle, or
  // getRequestDatabaseClient() reference - providers reach application
  // services only, same import-boundary posture as A2's tool registry.
}

export interface AthenaContextProviderFetchResult<TData> {
  data: TData;
  omittedFields: string[];
  sourceVersion?: string;
  sourceHash?: string;
}
```

`AthenaAIContext`'s extension in `athena-kernel/types.ts`:

```ts
export interface AthenaFreshnessEvidence {
  status: "live" | "fresh" | "stale" | "unavailable";
  fetchedAt: string;
  expiresAt?: string;
  ttlMs?: number;
  cacheHit: boolean;
  sourceVersion?: string;
  sourceHash?: string;
  revalidatedAt?: string;
}

export interface AthenaProviderSection<TData = unknown> {
  status: "available" | "degraded" | "omitted" | "unavailable" | "denied";
  freshness: AthenaFreshnessEvidence;
  sensitivity: "public" | "internal" | "confidential" | "restricted";
  source: { providerId: string; providerVersion: string };
  data: TData;
  omittedFields: string[];
  maxItems: number;
  maxBytes: number;
  estimatedTokens?: number;
  truncationReason?: string;
}

// Added to AthenaAIContext (all optional, all unset by every A1/A2 code path):
//   knowledgeEngine?: AthenaProviderSection;
//   dispatch?: AthenaProviderSection;
//   weather?: AthenaProviderSection;
//   calendar?: AthenaProviderSection;
//   customers?: AthenaProviderSection;
//   costbook?: AthenaProviderSection;
//   inventory?: AthenaProviderSection;
//   notifications?: AthenaProviderSection;
```

The unused section fields (`weather`, `calendar`, `customers`, `costbook`,
`inventory`, `notifications`) are typed now, matching C001, but no A3
provider populates them - this mirrors how A1 typed the full 15-state
lifecycle while only reaching a narrow subset of states.

## Provider Identity, Naming, And Versioning Rules

Reuses A2's rules exactly, applied to providers instead of tools:

- IDs are reverse-domain, lowercase, dot-separated:
  `tradeos.athena.context.<section>`, e.g.
  `tradeos.athena.context.knowledge-engine`,
  `tradeos.athena.context.dispatch`.
- Version is semver (`MAJOR.MINOR.PATCH`, optional pre-release/build
  metadata); the registry key is `id@version`.
- Duplicate `id@version` registration is a fail-fast startup error.
- A section (e.g. `"dispatch"`) may have at most one *active* provider
  registered at a time in A3 - multiple competing providers for the same
  section is deferred until there's a real reason for one (e.g. a plugin
  provider in A13).

## Context Minimization, Sensitivity, And Redaction

- Every provider declares `sensitivity` and the assembler must reject any
  provider output that lacks `status`, `freshness`, `source`, and size
  metadata - mirrors A2's `assertValidAthenaToolResult` posture for C003,
  applied to C001 provider sections instead.
- `maxItems`/`maxBytes` are enforced by the assembler, not trusted from the
  provider - a provider that returns more than its declared budget gets
  truncated with `truncationReason` set, not silently passed through
  oversized.
- `activation: "explicit_only"` providers are not implemented by any A3
  provider (both `knowledgeEngine` and `dispatch` use `eager_minimal`/
  `lazy_intent`), but the assembler must still enforce the mode - a test
  proves an `explicit_only` provider is never activated without an
  explicit flag, using a fixture provider, so the mode is proven before a
  high-PII provider ever needs it.
- `deniedFields` filtering happens before a section is attached to the
  context - A3's two providers have no field-level PII to redact
  (knowledge content and job scheduling metadata are not personal data),
  but the redaction seam is built and tested now with a fixture provider
  that declares denied fields, so a future customer/notification provider
  doesn't have to build this mechanism under deadline pressure.

## Freshness And Caching

- Every provider section includes `fetchedAt`, `cacheHit`, and
  `status` at minimum; `sourceVersion`/`sourceHash` when the provider can
  supply one, `expiresAt`/`ttlMs`/`revalidatedAt` when caching applies.
- `dispatch` never uses cache in A3 (`cacheKeyPolicy: "none"`) - job
  scheduling state changes too quickly for a first-pass TTL cache to be
  worth the complexity, and every read goes through RLS live.
- `knowledgeEngine` may use `cacheKeyPolicy: "tenant_actor_permission_input"`
  even though its underlying data is non-tenant, to prove the cache-key
  builder works correctly before a real tenant-scoped provider needs it -
  or `"none"` if the implementation decides the extra key complexity isn't
  worth it for non-tenant data. Either choice is acceptable; the plan
  requires the cache-key builder to exist and be tested with a two-org
  isolation test regardless of which provider first uses it, per MEDIUM-010
  in the A0.5 review.
- The cache-key builder must include organization, actor, permission
  snapshot, provider version, and scoped input - a cache entry built under
  one org/actor/permission combination must never be returned for another,
  proven by a dedicated test.

## Selected Scope And Object-Level Access

- `AthenaSelectedScope` (already defined) is the only scope-narrowing input
  a provider receives. Providers must not treat it as authorization - the
  `dispatch` provider's actor-scoping comes entirely from RLS
  (`jobs_select_policy`), not from trusting `selectedScope.jobId`.
- `jobs`/`job_assignments` remains the only entity with real object-level
  (assignment-scoped) RLS. This plan names that explicitly so a future
  contributor adding a `customers` or `costbook` provider does not assume
  the same protection exists there by default - it does not.

## Degraded And Partial Context

- Non-critical provider failure (`failureBehavior: "degrade"` or
  `"omit"`) produces a `status: "degraded"` or `"unavailable"` section and
  a warning; assembly continues with the rest of the context.
- Critical provider failure (`failureBehavior: "stop"`) stops assembly for
  the whole context, matching the runtime doctrine ("Critical provider
  failure stops planning for dependent actions"). Neither A3 provider is
  marked critical, so this path is exercised only by a fixture provider in
  tests.
- No provider failure may ever cause the assembler to fabricate a fact,
  return stale data as if fresh, or fall back to a broader/less-scoped
  query to "find something" - a timeout or denial always produces
  `status: "unavailable"` or `"denied"`, never invented data.

## Test Requirements

Required test classes, in `app/tests/athena-context-engine.*.test.ts` files
following the `athena-tool-registry.*.test.ts` naming convention:

- Registry tests: registration (id/version format, duplicate rejection),
  resolution, discovery filtered by permission and activation mode.
- Assembler tests: budget enforcement (`maxItems`/`maxBytes` truncation),
  timeout enforcement via a dispatcher-owned deadline, degrade-vs-stop
  behavior per `failureBehavior` using fixture providers, `explicit_only`
  activation gating, never-fabricate-on-failure assertions.
- Redaction tests: a fixture provider with `deniedFields` proves denied
  fields never reach the assembled context.
- Cache tests: cache-key builder includes org/actor/permission/version/
  input; a two-organization isolation test proves one org's cached
  provider output is never returned to another org's request.
- `knowledgeEngine` provider tests: wraps `KnowledgeRuntimeService`
  correctly, includes freshness evidence, no database import (covered by
  the same static import-boundary pattern A2 established).
- `dispatch` provider tests (unit, mocked service layer): actor-scoped
  input handling, freshness evidence, degrade behavior on service error.
- `dispatch` provider live-RLS integration test
  (`app/tests/athena-context-engine.dispatch-rls.integration.ts`, run
  under `test:integration`): a technician actor sees only their assigned
  jobs through the provider; an owner/admin/dispatcher actor sees the
  broader set the existing `jobs_select_policy` already grants them -
  proves the provider inherits RLS rather than trusting `selectedScope`.
- Contract tests (`athena-context-engine.contracts.test.ts`, added to the
  `athena:contracts` gate): C001 provider-section shape validation and
  C010 provider-definition shape validation.
- Import-boundary test: `app/modules/athena-context-engine/**` (excluding
  the two providers' calls into `KnowledgeRuntimeService`/`JobsService`,
  which are application services, not database/Prisma imports) never
  imports `app/db/client`, `app/db/requestSession`, or `@prisma/client`
  directly.

Out of scope for A3 tests: any provider for a deferred section (see
below), planner/router intent-gating tests (A5), object-level policy
adapter tests beyond the existing `jobs` RLS precedent (A4), live kernel
wiring tests (not built in A3).

## CI Validation Gates

- Extend the existing `athena:contracts` script
  (`app/package.json`) to also match
  `athena-context-engine\.contracts\.test\.ts$`, keeping one gate across
  kernel, tool registry, and context engine rather than fragmenting per
  milestone - same reasoning A2 already applied.
- `athena:smoke` is unchanged - A3 adds no live HTTP path.
- `athena:perf` remains deferred; A3 must not claim perf coverage.
- `cd app && npm run test:integration` is required for this PR because A3
  adds a live-RLS-dependent test (`dispatch` provider), matching the same
  rule the A1 plan already established for database-backed/RLS-protected
  work.

## Migration Requirements

None. The provider registry and cache are code-defined/in-memory, matching
A2's registry precedent. The `dispatch` provider reads existing `jobs`/
`job_assignments` tables through the existing `JobsService`/RLS policies -
no new Prisma model, no new migration, no new RLS policy.

## Deferred Sections

Every C001 section not listed as in-scope above is deferred, with a
specific reason rather than a blanket "later":

| Section | Reason deferred |
| --- | --- |
| `customers` | RBAC already grants technicians org-wide `crm.read`, so this isn't an object-scope gap the way billing is - but broadening that into an always-on AI context surface is a product/security decision this plan does not make unilaterally. Revisit as a named A3-follow-up or A4 decision, not a silent inclusion. |
| `costbook` | Tenant-scoped (unlike `knowledgeEngine`'s non-tenant reference data) via `cost-database`/`assemblies-database`/`supplier-database` modules; object-scope and RLS behavior for these tables have not been verified for Athena-context purposes in this plan. |
| `inventory` | No app-backed inventory module was verified as production-ready in this session; matches MEDIUM-015's "defer external/unverified integrations" guidance. |
| `notifications` | Overlaps with `NotificationCenterService`, which is actor-scoped by user already, but pulling it into Athena context needs its own PII/retention review given notification content can reference other entities (jobs, customers, invoices) whose own object-scope may not be resolved. |
| `weather`, `calendar` | External integrations, explicitly named as deferred in MEDIUM-015 and the roadmap's own A3 guidance ("existing app-backed providers first"). |
| `invoices`/`proposals`/`contracts`-backed sections (billing/document context) | Hard-blocked by HIGH-P3 until assignment-scoped RLS or an equivalent service-layer filter exists. |
| `workspace`, `dashboard` | UI/session-state-derived, not backed by a stable existing service contract in this codebase yet - worth building once a concrete consumer (A5 planner) needs them. |
| `conversation` (full C001 section, beyond A1's `conversationId` reference) | Requires a conversation/session persistence system not built in A1/A2; premature to design its context-provider shape before that exists. |

## Risks And Blockers

- **PII exposure risk (structural, not incidental):** A0.5's HIGH-003 named
  this as the primary A3 risk. This plan's mitigation is scope
  minimization (two low-risk providers only) plus building the redaction/
  budget/sensitivity machinery generically enough that the next provider
  doesn't get to skip it under time pressure.
- **`knowledgeEngine` freshness gap:** `knowledge-runtime/loader.ts` has no
  content hash or version today (LOW-1, A1 parallel readiness review). A3
  must make an explicit choice - add a hash, or record `"unknown"` - and
  must not fabricate a plausible-looking version string either way.
- **Cache-key infrastructure is new, not reused:** `knowledge-runtime/cache.ts`
  cannot be reused for tenant-scoped caching (LOW-1). A3 builds a
  separate, tenant-qualified cache rather than extending the existing
  un-keyed one, to avoid retrofitting tenant-safety onto a module that
  currently correctly assumes non-tenant data.
- **Scope-creep risk:** the clearest way A3 fails its own non-goals is
  someone adding a `customers` or `costbook` provider "since the pattern
  already exists." Any new provider beyond `knowledgeEngine`/`dispatch`
  should be treated as a new planning decision, not a natural extension of
  this PR.
- **Named pre-A4 blocker (carried forward):** HIGH-P3 (invoices/proposals/
  contracts object scope) remains a blocker for those specific sections,
  now doubly relevant since A3 is exactly where the temptation to add a
  billing context provider would first appear.

## Exact A3 Exit Criteria

A3 is complete only when all criteria below are met:

- `AthenaAIContext` carries the optional C001 provider-section fields;
  every existing A1/A2 test still passes unchanged, including the
  assertions that the minimal context omits business sections.
- A code-defined context provider registry exists with `register()`/
  `resolve()`/`discover()`, matching `AthenaContextProviderDefinition`
  narrowed from C010.
- The assembler enforces activation mode, per-provider and total budget,
  timeout via a dispatcher-owned deadline, freshness evidence, and
  `failureBehavior`-driven degrade/stop/omit - with tests proving each.
- No provider failure path fabricates data or silently widens scope.
- A tenant-qualified cache-key builder exists and passes a two-organization
  isolation test.
- `knowledgeEngine` and `dispatch` providers are implemented, tested, and
  documented; `dispatch` has a live-RLS integration test proving
  technician actor-scoping is inherited from `jobs_select_policy`, not
  reimplemented.
- No provider for `customers`, `costbook`, `inventory`, `notifications`,
  `weather`, `calendar`, `workspace`, `dashboard`, `conversation`, or any
  billing/document entity ships in A3.
- No new HTTP endpoint, kernel-reachable state, or live dispatch path is
  added; `AthenaKernelService` is unmodified.
- `athena:contracts` is extended to cover context-engine shape validation
  and remains wired into `.github/workflows/verify-repository.yml`
  (already true via the existing script name).
- `test:integration` passes with the new RLS-dependent test included.
- Required docs, app tests, lint, build, and diff checks pass, or
  documented blockers are accepted.
- HIGH-P3 and the pre-A2/A6 transaction prerequisite remain recorded and
  unweakened.

## A3 Go/No-Go Recommendation

**GO** for A3 implementation as scoped above. The two chosen providers
(`knowledgeEngine`, `dispatch`) are the only sections with either zero
tenant risk or an already-proven object-scope precedent, which is exactly
what MEDIUM-015 in the A0.5 review asked A3 to start with. Implementation
should stop and treat it as a new planning decision - not a natural
extension of this PR - if pressure emerges to add a `customers`,
`costbook`, or billing/document provider before HIGH-P3 is resolved, or to
wire the assembler into the live kernel path before A5's planner exists to
decide which providers a given intent actually needs.
