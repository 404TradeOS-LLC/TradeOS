---
status: ready
owner: platform
last_verified: 2026-08-27
source_of_truth: true
related_docs:
  - docs/TRADEOS_BIBLE.md
  - docs/SPRINT_BACKLOG.md
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
  - docs/athena/10-events/README.md
related_code:
  - app/modules/athena-events/dispatch.ts
  - app/modules/athena-events/retryPolicy.ts
  - app/modules/athena-events/store.ts
  - app/db/requestSession.ts
  - app/modules/supplier-integration/worker.ts
  - app/scripts/run-athena-observability-alerts.ts
  - app/scripts/run-athena-observability-export.ts
  - app/scripts/run-athena-observability-retention.ts
---

# S038 — Background and Retry Semantics

## Readiness decision

S038 is ready for implementation. S037 and all other prerequisites for the
bounded contract are complete. The repository already provides durable Athena
event deliveries, idempotency keys, bounded retry/dead-letter state, replay
records, tenant-scoped background sessions, and several scheduler-facing job
entrypoints. The implementation lane should standardize and verify those
existing seams rather than introduce a second queue or worker architecture.

## Objective

Make asynchronous work retry-safe, idempotent, tenant-scoped, and observable
when a delivery or background job is retried after a timeout, process restart,
or transient dependency failure.

## Bounded implementation scope

1. Define one explicit retry outcome contract for existing asynchronous seams:
   success, retryable failure with a bounded next attempt, and terminal failure
   recorded for operator review.
2. Reuse the existing Athena delivery rows and retry policy for event delivery;
   preserve its organization/idempotency constraints, safe failure reasons,
   dead-letter snapshots, and replay authorization checks.
3. Apply the same contract to existing scheduler-facing supplier and
   observability job entrypoints where the current code can safely classify
   retryability and prevent duplicate side effects.
4. Require every background attempt to re-enter the existing
   `runWithBackgroundDatabaseSession` boundary and carry organization, worker
   identity, job name, correlation, attempt, and safe failure metadata.
5. Add focused tests for duplicate-attempt behavior, retry exhaustion,
   retryable versus terminal failures, tenant isolation, safe failure
   recording, and recovery after an interrupted attempt.
6. Document the operator-facing contract and the exact production scheduler
   handoff without claiming that a scheduler has been deployed or exercised.

## Required invariants

- A retry must not repeat a committed business side effect unless the existing
  operation's idempotency contract proves the repeat safe.
- Idempotency keys are scoped to the organization and semantic operation; a
  request ID alone is not a business idempotency key.
- Retry state is bounded and deterministic. Exhausted work remains queryable
  through an existing safe failure/dead-letter surface and is never silently
  dropped.
- Background work derives authorization context from the active organization
  membership of the worker identity; it never trusts organization or role data
  from an untrusted job payload.
- Failure records contain safe reason codes and correlation metadata, never
  raw secrets, tokens, prompts, customer payloads, or stack traces.
- One subscriber or job failure cannot prevent independent due work from being
  attempted and recorded.
- Existing business transactions, forced RLS, application permissions, event
  contracts, and public route shapes remain unchanged.

## Allowed implementation paths

- Existing `app/modules/athena-events/**` delivery/retry/replay seams.
- Existing background-session helper and scheduler-facing job entrypoints.
- Existing supplier-integration and Athena observability maintenance seams.
- Focused tests, fixtures, operator documentation, and required current-state
  or sprint evidence.

## Explicit non-goals

- No new queue provider, worker platform, scheduler product, event bus, or
  external telemetry provider.
- No new schema or migration unless a later reviewed contract proves it is
  indispensable; such a change is a protected PR-only boundary under
  repository governance.
- No automatic invoice/payment behavior, billing policy, pricing change,
  customer messaging, or supplier auto-application.
- No authentication/RBAC/RLS redesign, destructive data operation, S027
  Costbook browser evidence, S036 index work, S043 security-event scope, or
  production credential/deployment changes.

## Verification contract

- Focused Athena event retry, dead-letter, replay, and repository tests.
- Focused supplier and observability background-job tests.
- Same-organization/cross-organization and inactive-worker denial evidence.
- Safe-redaction and correlation assertions for every persisted failure shape.
- `git diff --check`; `npm run pr:preflight -- --base origin/main`;
  `npm run pr:test`; `npm run docs:test`; `npm run docs:check -- --base origin/main`;
  applicable app typecheck, unit, build, migration, and PostgreSQL/RLS checks.

## Founder and external-dependency boundary

Founder decision: NO for this bounded, existing-architecture contract. A new
retry policy that changes customer-visible semantics, introduces durable data
retention, or requires a new provider must stop for review. Production
scheduler configuration and live failure rehearsal are external evidence
follow-ups; implementation must not fabricate them.

## Completion evidence

Record the final retry/idempotency matrix, changed failure states, tenant and
redaction evidence, exact-head CI/review results, and any scheduler or live
environment limitations in `docs/architecture/S038_COMPLETION_EVIDENCE.md`.
