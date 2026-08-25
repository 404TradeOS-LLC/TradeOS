# S037 Application Observability Baseline

## Readiness decision

S037 is READY for one bounded implementation lane. The repository already has request IDs, structured JSON log helpers, request-completion logging, centralized error handling, and separate `/health` and `/ready` endpoints. The implementation will make that existing foundation safe and consistently useful on critical HTTP paths without introducing a new telemetry product or persistence model.

## Objective

Make critical API requests traceable from response to structured server logs and, when an error reaches the API boundary, from the safe error response back to the same request record. Preserve the existing liveness/readiness split and ensure operator telemetry and frontend error surfaces do not disclose credentials, query secrets, stack traces, or arbitrary exception messages.

## In scope

- Harden the existing request-correlation middleware and structured logger.
- Emit completion and failure records with stable request ID, method, pathname, status, and bounded duration fields.
- Redact query strings, authorization/cookie headers, request bodies, stack traces, and arbitrary exception details from operator logs and client-facing error UI.
- Preserve `x-request-id` response continuity and the existing error-response `requestId` field.
- Preserve `/health` as dependency-free liveness and `/ready` as database-backed fail-closed readiness, with focused regression tests.
- Add focused backend and web regression tests for correlation, redaction, error boundaries, and health/readiness behavior.

## Explicit non-goals

- No database tables, migrations, Prisma changes, RLS changes, auth/RBAC changes, or tenant-policy changes.
- No new persisted security-event/audit trail; that is S043 scope.
- No vendor-specific tracing SDK, metrics backend, alerting platform, log transport, or deployment configuration.
- No change to HTTP route contracts beyond safe existing request-ID continuity.
- No change to retry/idempotency semantics (S038), browser evidence (S027), or later sprint work.

## Security and operational invariants

1. Logs are valid structured JSON and contain only allowlisted request metadata and sanitized error metadata.
2. Raw query strings, authorization/cookie values, request bodies, stack traces, and exception messages are never emitted by request/error observability paths.
3. A missing request context fails closed: the server still returns a generic error and does not invent tenant or actor attribution.
4. `x-request-id` remains available in responses and error bodies, but malformed or oversized caller input is bounded or replaced and is never treated as authentication.
5. `/health` must not require the database; `/ready` must return 503 when its database probe fails.
6. Existing auth, organization scoping, request-scoped database sessions, forced RLS, and audit/event behavior remain unchanged.

## Implementation surface

- `app/backend/logging.ts`
- `app/backend/middleware/productionHardening.ts`
- `app/backend/middleware/errorHandler.ts`
- `app/backend/health.ts` only if needed to preserve/clarify safe readiness logging
- `app/tests/productionHardening.test.ts`
- `app/tests/errorHandler.test.ts`
- `app/tests/health.test.ts`
- `web/src/app/error.tsx` and a focused test if the existing frontend test convention supports it

## Required verification

- Focused backend tests covering normal completion, error completion, malformed/oversized request IDs, query-secret redaction, and generic client error output.
- Health/readiness tests proving liveness is dependency-free and readiness fails closed.
- Frontend error-boundary regression proving exception messages are not rendered to users.
- `git diff --check`, `npm run pr:preflight -- --base origin/main`, `npm run pr:test`, `npm run docs:test`, and `npm run docs:check -- --base origin/main`.
- `cd app && npm test`, `npm run lint`, and `npm run build`; integration tests are required if implementation touches database behavior, otherwise marked N/A with reason.
- `cd web && npm test`, `npm run lint`, and `npm run build` when the frontend boundary changes.

## Completion evidence

Record the merged readiness and implementation PRs, exact SHAs, CI results, focused security/redaction evidence, health/readiness evidence, review disposition, explicit non-goals, and any environment-blocked production/browser evidence in `docs/architecture/S037_COMPLETION_EVIDENCE.md`. Reconcile S037 to DONE only after the implementation PR and evidence PR both report MERGED and their commits are present on `origin/main`.

## Founder and external dependencies

None identified. Existing repository doctrine determines the bounded behavior. Production log aggregation and authenticated rendered browser evidence are external/deployment concerns and must not be claimed from repository tests.
