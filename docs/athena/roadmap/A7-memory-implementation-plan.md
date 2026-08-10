---
status: draft
owner: platform
last_verified: 2026-08-10
source_of_truth: true
related_docs:
  - ../README.md
  - ../roadmap.md
  - ../04-system-architecture/README.md
  - ../07-context-engine/README.md
  - ../08-memory/README.md
  - ../09-security/README.md
  - ../contracts/README.md
  - ../14-adrs/ADR-005-long-term-memory-model.md
  - ../reviews/A0.5-architecture-review.md
  - A3-context-engine-implementation-plan.md
  - A4-permission-policy-implementation-plan.md
  - A6-action-engine-implementation-plan.md
  - ../../TRADEOS_BIBLE.md
  - ../../ARCHITECTURE.md
---

# A7 Memory Implementation Plan

Milestone: A7 - Memory
Purpose: give Athena a production-quality, tenant-safe persistent memory
subsystem - remember, retrieve, correct, and forget durable user/organization
context - that plugs into the existing A3 Context Engine and reuses the
existing A4 permission adapter, rather than a parallel storage or
authorization path.
Implementation posture: infrastructure only, dark by default (no production
call site supplies the kernel's memory hook), deterministic write policy (no
AI extractor), fail-closed on ownership/authorization, contract-test-gated.

## A6 Acceptance Summary

A7 starts from a verified-complete A6. `feat(athena): add A6 action engine`
plus its two follow-up fixes (mandatory approval plan/step binding, full
approval time-window enforcement) are on this branch. `app/modules/athena-action-engine/`
executes an already-authorized `tool_call` step; the kernel's `policy_check`
tool loop calls `executeAthenaAction()` behind `ATHENA_ACTION_ENGINE_ENABLED`
(default `false`). A2 still has no production tools registered, so this
entire pipeline - and therefore A7's own kernel hook, which only fires after
a *succeeded* action - remains dormant in production today.

## A7 Scope

In scope:

- `app/modules/athena-memory/`: the sole supported Memory Service boundary
  (`service.ts`'s `createAthenaMemoryService()`), per the accepted correction
  in `docs/athena/reviews/A0.5-architecture-review.md` (MEDIUM-013: "Define
  `AthenaMemoryService` as the service boundary for memory reads/writes").
  Nothing outside this module opens Prisma for memory data.
- C006 `AthenaMemoryRecord` implemented in `types.ts`, validated at runtime
  by `assertValidAthenaMemoryRecord()` (`resultValidation.ts`), plus the
  `AthenaSourceReference`/`AthenaRetentionPolicy` shapes 08-memory/README.md
  referenced but never spelled out anywhere in the contract catalog before
  this milestone (now added to C006 in `docs/athena/contracts/README.md`).
- A deterministic, non-LLM `evaluateAthenaMemoryWritePolicy()`
  (`writePolicy.ts`): rejects untrusted-source writes and secret-shaped
  content via an extensible list of small named detectors (not one regular
  expression), ranks sources for conflict resolution, and distinguishes
  store / update / ignore.
- Prisma-backed persistence (`store.ts`, the only file in this module
  allowed to import Prisma) behind an `AthenaMemoryRepository` interface,
  plus an in-memory test fixture (`fixtures/inMemoryRepository.ts`) - the
  same "narrow persistence seam + injectable interface" posture as
  `athena-kernel/executionStore.ts` and A6's `AthenaIdempotencyStore`.
- A new `athena_memories` table and forced RLS policies
  (`prisma/migrations/20260810130000_add_athena_memory/`), with live
  integration coverage (`athena-memory.rls.integration.ts`) per AGENTS.md's
  "new RLS-protected tables need live integration coverage" rule.
- A Memory Context Provider (`athena-context-engine/providers/memoryProvider.ts`),
  registered in `athena-kernel/contextRegistry.ts`'s
  `createLiveAthenaContextRegistry()` alongside the dispatch/knowledgeEngine
  providers, and a new optional `memory` section on C001 `AthenaAIContext`
  (`docs/athena/contracts/README.md`, `athena-kernel/types.ts`,
  `athena-context-engine/types.ts`'s `ATHENA_CONTEXT_SECTIONS`) - purely
  additive, same posture A1 already established for the other provider
  sections.
- A minimal, decoupled kernel extension point
  (`AthenaMemoryCandidateExtractor`, `athena-kernel/service.ts`) so a future
  capability can turn a succeeded action into memory candidates without A7
  or A6 containing any extraction logic themselves.
- A new `AthenaNonToolCapabilityKind` value, `"memory_write"`
  (`athena-permissions/types.ts`), so memory mutations are authorized
  through the existing A4 `evaluateAthenaPermission()` adapter rather than a
  second authorization system.

Out of scope (deferred):

- Any business-specific memory behavior: what a completed action *should*
  remember, natural-language "forget that I prefer X" handling, semantic
  memory retrieval/embeddings, or admin-facing memory management UI. All
  explicitly excluded by the task brief and left to a correctly-scoped
  future capability.
- A8 events, A9 observability, A10 plugin SDK, A11 business tools.
- Per-job/per-project actor-level object scoping for `"project"`/`"job"`
  scope memory. `athena-permissions/types.ts`'s `AthenaResourceRequest` is
  deliberately closed to `entityType: "job"` today (the unresolved HIGH-P3
  object-scope prerequisite named in the A1 review); A7 does not widen it.
  Project/job-scope memory reads are org-scoped only, and writes require the
  same admin capability as organization-scope memory - a documented,
  conservative default, not an approximation of real per-record scoping.

## Memory Model And Isolation

`AthenaMemoryRecord` (C006) carries `scope: "user" | "organization" |
"project" | "job" | "conversation"` and `subjectId`. Isolation is enforced
at three independent layers:

1. **Application layer** (`service.ts`): every operation requires
   `actor.orgId === orgId`. For `"user"`/`"conversation"` scope,
   `subjectId` must equal `actor.userId` on every operation - no admin
   bypass, stricter than `athena_executions`' own audit-visibility RLS
   posture, per this milestone's explicit isolation requirement ("org A /
   user A must never be retrievable... by org A / user B"). Read operations
   (`recall`/`getById`/`search`/`list`) return `null`/`[]` on an ownership
   mismatch rather than throwing, so a caller can never distinguish "does
   not exist" from "exists but is not yours" - the same anti-enumeration
   posture A2/A6 already apply to their own not-found/denied errors.
   Write/delete operations throw `AthenaMemoryError("authorization_denied")`
   instead, since a rejected mutation has nothing to leak.
2. **Authorization layer** (A4 reuse): every write/delete calls
   `evaluateAthenaPermission()` with capability kind `"memory_write"`.
   User/conversation-scope writes require no permission (ownership is the
   only gate); organization/project/job-scope writes require
   `settings.manage` - the same permission, and the same
   owner/admin/dispatcher role set as the database's own
   `current_app_can_administer()`, already used elsewhere in this codebase
   for organization-level configuration.
3. **Database floor** (forced RLS): `athena_memories`' policies mirror the
   application-layer rule independently - `subject_id =
   current_app_user_id()` with no admin bypass for user/conversation scope,
   `current_app_can_administer()` for organization/project/job-scope
   mutations. `athena-memory.rls.integration.ts` proves this against a real
   Postgres instance, not a mocked client.

## Stable Keys, Deduplication, And Correction

C006 defines no separate "stable key" field. A7 treats the existing
`(orgId, scope, subjectId, kind)` tuple as that stable key - e.g. `kind:
"preference.response_style"` - rather than inventing an undocumented field.
A partial unique index enforces at most one **active** row per stable key at
the database layer:

```sql
create unique index idx_athena_memories_active_stable_key
  on athena_memories (org_id, scope, subject_id, kind)
  where status = 'active';
```

`evaluateAthenaMemoryWritePolicy()` distinguishes:

- no existing active record -> `store`
- existing record with an identical value -> `ignore` (duplicate)
- existing record with a different value, from an equal-or-higher-ranked
  source -> `update`
- existing record with a different value, from a strictly lower-ranked
  source (e.g. a conversation-derived guess trying to overwrite an
  `admin_policy` record) -> `ignore` (08-memory/README.md's conflict
  resolution: "ranks admin policy and application records above
  conversation-derived preference")

An `"update"` decision **corrects** rather than mutates in place:
`AthenaMemoryRepository.correct()` flips the previous row's `status` to
`"corrected"` and inserts a new `"active"` row with `supersedes` pointing at
it, atomically (via `runInDatabaseTransaction`, reusing the caller's already
-open request-scoped transaction rather than nesting a second one - a real
bug this milestone's own live RLS test caught before merge). This preserves
full audit history and gives real meaning to C006's `status: "corrected"`
value, rather than silently discarding prior values on every edit.

## Write Policy: What A7 Refuses To Store

`writePolicy.ts` never stores/updates a candidate when:

- `source.trusted` is `false` (09-security/README.md: "block external
  content from creating memory without trusted confirmation" -
  `12-testing/README.md`'s named test, "Untrusted content cannot create
  memory or override policy", is covered by both
  `athena-memory.writePolicy.test.ts` and an end-to-end
  `athena-memory.service.test.ts` case).
- the candidate's value or metadata contains secret-shaped content, detected
  by an extensible list of small, independently testable, named detectors
  (a sensitive-field-name walker plus a set of specific string-pattern
  matchers - JWTs, bearer headers, AWS access key IDs, PEM private key
  blocks, common prefixed API key shapes) - deliberately not one large
  regular expression, so a future category can be added without touching an
  existing rule.

## Forgetting

`AthenaMemoryService` exposes `forget` (by id), `forgetByKey` (by stable
key), and `forgetAllForSubject` (bulk, where the caller's role/ownership
permits). All three are soft deletes: `status` becomes `"deleted"` and
`value`/`metadata` are cleared at the same time, so a "forgotten" memory
both stops being used in planning/context assembly (08-memory/README.md) and
genuinely no longer carries the forgotten content - while `id`/`kind`/
timestamps remain for audit ("Suspicious memory changes are auditable and
revocable"). Every forget query is scoped by `(orgId, scope, subjectId)` in
addition to its target predicate, so a memory outside the caller's ownership
structurally cannot match - deleting a foreign id/key affects zero rows
rather than needing a separate authorization check to fail closed.

## Retrieval

`recall` (single record by stable key), `getById`, `search` (filtered,
paginated), and `list` (all active memories for a subject) all exclude
expired (`retention.expiresAt` in the past) and non-active records, and
return results in deterministic order (`createdAt` descending, `id` as a
stable tiebreak). No embeddings, vector store, or semantic ranking - a
future milestone can add semantic retrieval behind the same
`AthenaMemoryService` interface without changing any caller.

## Context Engine Integration

`athena-context-engine/providers/memoryProvider.ts` implements C010
(`AthenaContextProviderDefinition`) and wraps `AthenaMemoryService.list()` -
it never queries `athena-memory/store.ts` directly. It is `lazy_intent`
(`allowedIntents: ["memory_preferences"]`), `sensitivity: "confidential"`
(07-context-engine/README.md: "memory-backed preferences are lazy and
intent-gated by default"), `cacheKeyPolicy: "tenant_actor_permission_input"`,
and `failureBehavior: "degrade"`, `criticality: "optional"` - memory absence
never blocks a request. It is scoped to the requesting actor's own
`"user"`-scope memory only; organization-wide memory in context is left to a
future, explicit capability decision. Registered in
`createLiveAthenaContextRegistry()`; dormant in production today because A5's
router does not yet classify a `"memory_preferences"` intent, the same
posture the dispatch/knowledgeEngine providers already have.

## Kernel Extension Point (Not An Extraction Engine)

`AthenaKernelHandleInput` gains two optional, undefined-by-default DI seams:
`memoryCandidateExtractor` (`AthenaMemoryCandidateExtractor`, defined in
`athena-memory/types.ts` without any dependency on `athena-action-engine`'s
own types, so the two modules stay decoupled) and `memoryService`. The
kernel calls both, if and only if both are supplied, immediately after a
`tool_call` step's action succeeds - the exact point A6's own action-outcome
data (`actionOutcome`) is already in scope. A7 ships no extractor anywhere
in production code; this hook is a no-op in every existing call site, proven
by `athena-kernel.service.test.ts`'s "20. a succeeded action creates no
memory when no extractor/memoryService is supplied" test. A failing
extractor or a failing `remember()` call is swallowed exactly like
`emitSpan`'s telemetry failures - it can never flip a real business result.

## Feature Flags

None new. A7 introduces no independent enable/disable flag of its own -
every write path already requires an explicit caller (the kernel hook is
DI-only and unused in production; the Context Engine provider only activates
for an intent the router does not yet produce). This is a stronger "dark by
default" than a flag would provide: there is no flag to accidentally flip on
that would activate anything, matching ADR-005's "revisit before enabling
production memory writes" condition - production memory writes require a
future capability to actually wire the hook, not an environment variable.

## Required Tests

- `athena-memory.contracts.test.ts`: C006 `AthenaMemoryRecord`, valid and
  malformed, backing `athena:contracts`.
- `athena-memory.writePolicy.test.ts`: store/update/ignore decisions,
  untrusted-source rejection, prohibited-content detectors (field-name and
  string-pattern), source-rank conflict resolution.
- `athena-memory.service.test.ts`: storing, retrieving, keyed upsert,
  duplicate prevention, updating (with `supersedes` verification), forgetting
  by id/key/all, listing, expired-memory exclusion, deterministic ordering,
  wrong-user isolation, wrong-org isolation, prohibited-secret rejection
  end-to-end, invalid input, repository/storage-error normalization,
  malformed metadata, and role-gated organization-scope writes.
- `athena-memory.import-boundary.test.ts`: only `store.ts` imports
  Prisma/`db/client`.
- `athena-memory.migration.test.ts`: table, partial unique index, and forced
  RLS policies present in the migration SQL.
- `athena-memory.rls.integration.ts`: live Postgres proof of tenant/actor
  isolation and admin-gated organization-scope mutation - this test caught
  a real nested-transaction bug in `store.ts`'s correction path before
  merge.
- `athena-context-engine.memory-provider.test.ts`: valid C010 definition,
  actor-scoped fetch, cross-user non-leakage, and Context Engine assembly
  proving an irrelevant intent never activates the section while a matching
  one does.
- `athena-kernel.service.test.ts`'s new "A7 memory candidate hook" block:
  dormancy by default, successful candidate persistence when both DI seams
  are supplied, and hook-failure isolation from the real business result.

## Exit Criteria

Memory is source-attributed (every record carries `source`), scoped,
retained by policy, correctable (via `supersedes`), deletable (soft delete
that clears content), and auditable (status/timestamps survive deletion) -
ADR-005's decision, and this roadmap entry's own exit bar ("Memory is
source-attributed and deletable"). Tenant/actor isolation is proven at the
application layer, the authorization layer, and the database RLS floor
independently. No A1-A6 security boundary is weakened: memory writes reuse
A4's existing permission adapter rather than a parallel one, and the kernel
hook never bypasses `AthenaMemoryService.remember()`'s own authorization and
write-policy checks. Rollback: do not supply `memoryCandidateExtractor`/
`memoryService` to any kernel call site (already true everywhere in
production) to keep memory writes fully disabled while reads remain
available for direct `AthenaMemoryService` callers.
