---
status: complete
owner: platform
last_verified: 2026-08-27
source_of_truth: true
related_docs:
  - docs/architecture/S038_BACKGROUND_RETRY_SEMANTICS_PLAN.md
  - docs/architecture/S038_BACKGROUND_RETRY_SEMANTICS.md
  - docs/SPRINT_BACKLOG.md
related_code:
  - app/modules/background/retry.ts
  - app/modules/athena-events/dispatch.ts
  - app/modules/supplier-integration/service.ts
  - app/modules/supplier-integration/scheduler.ts
  - app/modules/athena-observability/exporters.ts
---

# S038 — Completion evidence

## Shipped objective

S038 standardizes bounded background-attempt outcomes over the existing Athena
event, supplier price-sync, and Athena observability seams. Retries preserve
tenant scope and business idempotency boundaries; failure surfaces expose safe
codes and correlation metadata; no new queue, provider, scheduler product,
schema, migration, or customer-facing behavior was introduced.

## Implementation evidence

- Shared `executeBackgroundAttempt` / `classifyBackgroundFailure` contract
  returns success, retryable failure, or terminal failure with attempt,
  correlation ID, safe code, and deterministic next-attempt time.
- Athena subscriber handlers receive the event correlation ID, a stable
  `event:<event-id>:subscriber:<subscriber-id>` idempotency key, and one-based
  attempt number. Existing durable delivery retry/dead-letter state remains
  authoritative.
- Supplier feed proposal reconciliation takes a tenant/supplier-scoped
  PostgreSQL advisory transaction lock before checking pending proposals,
  preventing overlapping scheduler ticks from racing duplicate proposals.
- Supplier scheduler and observability exporter/operator surfaces no longer
  emit raw exception text on the modified failure paths.
- Existing background sessions still derive authorization from active
  organization membership, with forced RLS and review-first supplier pricing
  unchanged.

## Verification evidence

- Implementation PR: [#393](https://github.com/404TradeOS-LLC/TradeOS/pull/393)
- Merge commit: `a09a4b2e2b4bacd6b5750507e4caf06e7450640a`
- Exact-head hosted required checks passed: App lint/unit/build, App
  integration tests, Web lint/build summary, Athena contracts/smoke, Docs
  consistency, Dependency review, Sprint governance, branch currency, and
  live documentation reconciliation.
- Local focused S038 tests: 6 suites, 43 tests passed.
- Local full app suite: 221 suites, 1,933 tests passed.
- Local app TypeScript lint and production build passed.
- Local `docs:test`, `docs:check -- --base origin/main`, `pr:test`,
  `pr:preflight -- --base origin/main`, and `git diff --check` passed.
- Hosted disposable PostgreSQL/RLS integration passed.

## Security and non-goals

No auth/RBAC/RLS policy change, production credential change, billing/payment
behavior, supplier auto-application, customer messaging, production scheduler
configuration, or live scheduler failure rehearsal is claimed. The latter
remain deployment/environment evidence follow-ups.

