---
status: draft
owner: platform
last_verified: 2026-08-10
source_of_truth: true
related_docs:
  - ../README.md
  - ../roadmap.md
  - ../04-system-architecture/README.md
  - ../10-events/README.md
  - ../09-security/README.md
  - ../contracts/README.md
  - ../14-adrs/ADR-007-event-driven-business-lifecycle.md
  - ../14-adrs/ADR-008-business-logic-in-application-services.md
  - A6-action-engine-implementation-plan.md
  - A7-memory-implementation-plan.md
  - ../../TRADEOS_BIBLE.md
  - ../../ARCHITECTURE.md
---

# A8 Event Integration Implementation Plan

Milestone: A8 - Event integration
Purpose: give Athena a canonical, C008-compliant business event pipeline -
publish, durably deliver to subscribers, retry with backoff, dead-letter on
exhaustion, and safely replay - owned by application services rather than by
Athena's own Action Engine, plus one narrowly-scoped existing-service
publisher wired end to end to prove the pipeline against a real business
mutation.
Implementation posture: infrastructure only, dark by default (no subscriber
ships in this milestone; the one wired publish call site fires unconditionally
on an already-existing, already-safe mutation but has no consumer), tenant
isolation enforced at three independent layers (same posture as A7 memory),
contract-test-gated.

## A7 Acceptance Summary

A8 starts from a verified-complete A7. `feat(athena): add A7 memory` is on
this branch: `app/modules/athena-memory/` is the sole memory service
boundary, C006 is implemented and validated, `athena_memories` has forced RLS
proven by live integration coverage, and the memory context provider is
registered but dormant (router does not yet classify a `memory_preferences`
intent). A6's Action Engine (`app/modules/athena-action-engine/`) executes
authorized `tool_call` steps behind `ATHENA_ACTION_ENGINE_ENABLED` (default
`false`); A2 still registers no production tools, so the full kernel pipeline
remains dormant in production today. A8 does not change any of that.

## A8 Scope

In scope:

- `app/modules/athena-events/`: the sole supported Event Service boundary.
  Nothing outside this module opens Prisma for event/delivery/dead-letter
  data, mirroring A7's `athena-memory` boundary decision.
- C008 `AthenaBusinessEvent` implemented in `types.ts` exactly as specified in
  `docs/athena/contracts/README.md` - no added/renamed required fields.
  Canonical event type/version registry (`registry.ts`) seeded with the 16
  event names from `docs/athena/10-events/README.md`'s "Canonical Business
  Events" table at version `1.0.0`, closed by default: publishing an
  unregistered `type`/`version` pair fails validation rather than being
  silently accepted.
- Publication: `publishAthenaEvent()` persists the event row and, in the same
  call, creates one pending delivery row per currently-registered subscriber
  for that event type (subscriber list is static/in-process for A8 - no
  dynamic subscription API). Publication is idempotent on `(orgId,
  idempotencyKey)`: a duplicate publish call returns the original event
  instead of creating a second row or re-fanning-out deliveries.
- Delivery/retry: subscriber dispatch is pull-based (a worker function
  processes due pending/retrying deliveries) rather than a new push
  broker/queue - ADR-007's "revisit event infrastructure details as
  throughput... needs become concrete" and this roadmap entry's rollback
  ("suppress consumers by flag") both assume no new distributed platform yet.
  Bounded retry (fixed max-attempts constant) with exponential backoff
  (`retryPolicy.ts`), computed `nextAttemptAt`. Each delivery row tracks its
  own attempt count and status independently per subscriber, so one
  subscriber's failure/backoff never blocks another subscriber's delivery of
  the same event.
- Dead-letter: a delivery that exhausts its retry budget moves to
  `dead_letter` status and gets a corresponding `AthenaEventDeadLetter` row
  holding a safe (already-validated-against-C008, no secret-shaped content
  beyond what the event payload itself carried) payload snapshot and a
  failure reason. Dead-lettering does not roll back the original business
  mutation (10-events/README.md: "Failed subscribers do not roll back
  already-committed business state").
- Replay: `replayAthenaDeadLetter()` re-creates a fresh pending delivery for a
  dead-lettered event/subscriber pair, stamped with replay metadata
  (`replayedAt`, `replayedFromDeliveryId`) and the event's original
  `occurredAt` preserved unchanged (10-events/README.md: "Replays preserve
  original occurred time and mark replay metadata"). Replay is explicitly not
  authorization: `dispatchAthenaEventDelivery()` re-derives the subscriber's
  scoped session and re-checks entity ownership/permission immediately before
  every dispatch - replayed or first-attempt - rather than trusting the
  stored event's `orgId` alone.
- Prisma-backed persistence (`store.ts`, the only file in this module allowed
  to import Prisma) behind `AthenaEventRepository`, plus an in-memory test
  fixture (`fixtures/inMemoryRepository.ts`) - the same seam pattern as
  `athena-memory/store.ts` and A6's `AthenaIdempotencyStore`.
- Three new tables (`prisma/migrations/<ts>_add_athena_events/`):
  `athena_events`, `athena_event_deliveries`, `athena_event_dead_letters`,
  with forced RLS mirroring `athena_memories`' pattern, plus live integration
  coverage (`athena-events.rls.integration.ts`) per AGENTS.md's "new
  RLS-protected tables need live integration coverage" rule.
- Tenant-scoped subscriber execution: `dispatchAthenaEventDelivery()` never
  treats the event's stored `orgId` as sufficient authorization by itself. It
  opens a service-owned scoped session (organization, actor/service
  principal, role/capability context) before any subscriber handler reads or
  writes tenant data, and re-validates that the referenced entity still
  belongs to that organization - the same invariant 09-security/README.md
  states for tool execution, applied to subscriber dispatch.
- Exactly one narrowly-scoped existing-service integration:
  `ProposalsService.send()` (`app/modules/proposals/service.ts`) publishes a
  canonical `ProposalSent` event immediately after its existing
  `prisma.proposal.update({ status: "sent", ... })` mutation succeeds, using
  the proposal id as entity reference and a stable idempotency key
  (`proposal:<id>:sent:v1`). No other service is touched. No subscriber
  consumes `ProposalSent` in this milestone - the wire is real but the
  pipeline has zero registered subscribers by default, so this call site
  only ever creates an event row with no deliveries fanned out (an empty
  subscriber list for that type is valid, not an error).

Out of scope (deferred):

- Any subscriber business logic (recommendations, notifications, memory
  updates) for the 15 other canonical events. A9+ tool SDK, A10
  observability dashboards/exporters, A11 abuse controls.
- A dynamic/admin-managed subscriber registry or third-party event
  consumers (A13 plugin ecosystem territory).
- A distributed broker, message queue, or multi-instance delivery worker
  scheduler. The pull-based dispatch function this milestone ships is
  intentionally invocable by a future cron/worker process; A8 does not wire
  that scheduler itself, matching A6's own "no autonomous production
  activation" posture.
- Any other existing-service publisher beyond `ProposalsService.send()`.
  CRM, estimating, dispatch, and billing publishers are explicitly deferred
  to a future, correctly-scoped milestone per this session's own
  instructions ("Do not broaden CRM, estimating, dispatch, billing, or other
  domain behavior").

## Event Model And Isolation

`AthenaBusinessEvent` (C008) carries `orgId` on every row. Isolation is
enforced at three independent layers, the same structure A7 established for
memory:

1. **Application layer** (`service.ts`): every read/write requires
   `actor.orgId === orgId`. Reads (`getById`, `listBySubscriber`,
   `listDeadLetters`) return `null`/`[]` on an ownership mismatch instead of
   throwing - the same anti-enumeration posture as A7. Writes
   (`publish`, `recordDeliveryOutcome`, `replay`) throw
   `AthenaEventError("authorization_denied")`.
2. **Dispatch layer**: `dispatchAthenaEventDelivery()` derives its scoped
   session from the delivery row's own `orgId` (never from caller input) and
   re-checks the referenced entity's current organization ownership before
   invoking a subscriber handler - covers both first attempts and replays.
3. **Database floor** (forced RLS): all three new tables get org-scoped
   forced RLS policies mirroring `athena_memories`. Verified against a real
   Postgres instance in `athena-events.rls.integration.ts`, not a mocked
   client.

## Versioning, Retries, Deduplication, Replay

Matches `docs/athena/10-events/README.md`'s table exactly:

| Concern | A8 implementation |
| --- | --- |
| Versioning | `registry.ts` keys are `type@version`; only additive optional payload fields are allowed within a major version - enforced by the contract test, not by runtime schema diffing in this milestone |
| Retries | Fixed bounded max-attempts constant, exponential backoff with jitter-free deterministic delay (`retryPolicy.ts`), computed and persisted `nextAttemptAt` |
| Deduplication | Publication dedupes by `(orgId, idempotencyKey)`; dispatch dedupes by `(eventId, subscriberId)` - a delivery row is claimed exactly once per attempt cycle |
| Replay | `replayAthenaDeadLetter()` preserves original `occurredAt`, stamps replay metadata, re-authorizes before dispatch |
| Ordering | Not guaranteed across aggregates or even within one in this milestone - no ordering claim is made or tested; a future milestone that needs per-aggregate ordering must add it explicitly |
| Dead letter | `athena_event_dead_letters` row with safe payload snapshot and failure reason on retry exhaustion |

## Publisher And Subscriber Rules (ADR-008 compliance)

- `app/modules/athena-events/publisher.ts` is called by application services
  after a successful business mutation, never by the Action Engine and never
  by a controller/route handler directly. The Action Engine
  (`app/modules/athena-action-engine/`) is not modified by this milestone and
  gains no event-publication capability - it remains domain-unaware, per
  ADR-008 and this session's subagent safety rails ("must not make the
  Action Engine the canonical publisher").
- A tool result's `events` field (C003) is documented as a reference to a
  service-published event, not a payload Athena tools construct themselves;
  A8 does not add tool-to-event wiring since A2 has no production tools
  registered yet.

## Feature Flags

None new, matching A7's "stronger than a flag" reasoning: the one wired
publish call site (`ProposalsService.send()`) always fires (proposal-send is
already a real, already-authorized mutation with no new risk from also
writing an audit-shaped event row), but there are zero registered
subscribers by default anywhere in this module, so no side effect beyond
persisting the event/delivery rows themselves can occur in production. The
pull-based dispatch worker function is not invoked by any cron/route in this
milestone - it exists for tests and a future scheduler to call.

## Required Tests

- `athena-events.contracts.test.ts`: C008 `AthenaBusinessEvent`, valid and
  malformed; registry closed-by-default rejection of unregistered
  type/version pairs; backs `athena:contracts`.
- `athena-events.registry.test.ts`: seeded canonical event list matches
  10-events/README.md; version compatibility rules.
- `athena-events.publisher.test.ts`: publish creates event + fan-out
  deliveries; duplicate idempotency key returns original event without a
  second row or re-fan-out; zero-subscriber publish is valid.
- `athena-events.retryPolicy.test.ts`: backoff schedule, max-attempts bound,
  dead-letter transition at exhaustion.
- `athena-events.dispatch.test.ts`: successful dispatch marks delivery
  succeeded; failed dispatch increments attempt and reschedules or
  dead-letters; one subscriber's failure does not affect another
  subscriber's delivery of the same event.
- `athena-events.replay.test.ts`: replay preserves `occurredAt`, stamps
  replay metadata, re-authorizes before dispatch, and refuses replay when the
  referenced entity no longer belongs to the event's organization.
- `athena-events.tenant-security.test.ts`: cross-org read/write denial,
  cross-org dispatch denial, replay authorization re-check, org A / actor B
  cannot read org A / actor A's dead letters unless role-permitted.
- `athena-events.import-boundary.test.ts`: only `store.ts` imports
  Prisma/`db/client`.
- `athena-events.migration.test.ts`: tables, indexes, and forced RLS policies
  present in the migration SQL.
- `athena-events.rls.integration.ts`: live Postgres proof of tenant
  isolation across all three tables.
- `proposals.athena-events-integration.test.ts`: `ProposalsService.send()`
  publishes exactly one `ProposalSent` event with the correct entity/org/
  idempotency key; a second `send()` call (already blocked by the existing
  status guard) never double-publishes; publisher failure does not roll back
  or block the proposal-send mutation itself.

## Exit Criteria

Major changes emit versioned events (`docs/athena/roadmap.md`'s A8 exit
criterion) - proven end to end by the `ProposalsService.send()` wire, not
merely by unit tests against the module in isolation. C008 is preserved
exactly. Type/version validation fails closed on anything unregistered.
Event references remain forward-compatible with C003's `events` field
(unused by any tool in this milestone, since A2 has no production tools).
Subscribers (none ship in this milestone, but the dispatch path they will use
is fully tested) are idempotent by construction (`(eventId, subscriberId)`
claim). Retries are bounded. Dead-letter is real, persisted, and tested.
Replay is real and re-authorizes rather than trusting stored `orgId`. Tenant
isolation is proven at the application layer, the dispatch layer, and the
database RLS floor independently, matching A7's isolation posture. No A9+
work (tool SDK, observability, business tool rollout) is present. Rollback:
do not invoke the dispatch worker function from any scheduler/route (already
true everywhere - none exists) and do not register any subscriber, which
keeps the entire delivery/retry/DLQ machinery inert while `publish()` keeps
recording a durable, replayable audit trail.
