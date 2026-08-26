# S037 Completion Evidence — Application Observability Baseline

## Objective

S037 establishes a bounded application observability safety baseline: critical
request flows remain correlated and operationally diagnosable without emitting
credentials, tokens, request payloads, or sensitive URL values through the
shared structured logging boundary.

## Shipped behavior

- Added recursive structured-log metadata sanitization in
  `app/backend/logging.ts`.
- Redacts authorization, cookies, passwords, secrets, tokens, API keys,
  database URLs, body fields, bearer values, and sensitive query parameters.
- Fails closed for cyclic metadata and excessive nesting.
- Preserves request IDs, event names, health/readiness behavior, error response
  contracts, authorization, organization scoping, and forced RLS.
- Added focused regression coverage in `app/tests/logging.test.ts`.

## Merge evidence

- Readiness PR: #385
- Readiness merge commit: `a762ba715e9bc889922a7b94288c59720940c3ee`
- Implementation PR: #386
- Implementation head: `d97c12071cf17e389b4ae20b4739befd735c7744`
- Implementation merge commit: `7edca075b425809ba6a872490d8568bd6a8e0605`
- Completion-evidence PR: this document and canonical status reconciliation
- Main after implementation merge: `7edca075b425809ba6a872490d8568bd6a8e0605`

## Verification

- Focused observability/security tests: 26 passed.
- Full app suite: 220 suites, 1,928 tests passed.
- App typecheck: passed.
- App build: passed.
- GitHub Verify repository run for implementation head: passed, including app
  unit tests, typecheck, build/dependency audit, integration/migration
  rehearsal, and Athena contracts/smoke.
- GitHub Docs consistency, Dependency review, and PR branch currency checks:
  passed on the final PR head.

## Security and tenant/RLS validation

This change is logging-only. It introduces no route, authorization, role,
permission, tenant-scoping, Prisma, schema, migration, or RLS policy change.
Existing request correlation, health/readiness, error handling, and
request-scoped authorization/RLS paths remain unchanged. Tests verify that
sensitive metadata is not emitted while safe correlation metadata remains
available.

## Review disposition

- Initial Docs consistency failure was a deterministic PR-template validation
  issue; the PR body was repaired with all required governance sections.
- Final Docs consistency passed.
- No actionable inline review threads remained.
- Copilot review was unavailable because the requesting user had reached the
  review quota; this was recorded by GitHub and did not replace required CI.

## Non-goals and deferred work

No tracing vendor, metrics backend, alerting product, durable telemetry store,
retention system, queue, audit-event persistence, provider integration,
schema/migration, auth/RBAC/RLS redesign, S027 browser evidence, S036 index
work, or S038 retry semantics shipped. Future sinks must continue to use the
sanitization boundary.

## External evidence

No production or authenticated browser evidence is claimed. S027 remains
independently blocked on authenticated rendered Costbook browser evidence.

## Repository truth after implementation merge

S037 implementation is merged and its completion evidence is being reconciled
through the governed documentation PR. No authoritative S037 implementation
branch remains necessary after completion evidence merges. No next numbered
sprint is currently eligible: S036 remains planned and blocked by S027.
