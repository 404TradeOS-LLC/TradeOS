# S037 Application Observability Baseline

Status: READY

## Objective

Define and extend the existing application observability baseline so critical
request flows are traceable through structured, correlation-aware events,
health/readiness signals, and safe error reporting without leaking secrets or
tenant data.

## Existing foundation

- `app/backend/logging.ts` emits JSON logs with level, message, and metadata.
- `app/backend/middleware/productionHardening.ts` assigns and returns
  `x-request-id`, and records request completion with method, path, status, and
  duration.
- `app/backend/health.ts` provides dependency-free `/health` liveness and
  database-backed `/ready` readiness with fail-closed status.
- `app/backend/middleware/errorHandler.ts` returns request IDs and logs
  unexpected failures.
- Existing tests cover request IDs, health/readiness, security headers, and
  error mapping.

## Bounded implementation scope

1. Harden the shared logging boundary with explicit safe-field/redaction rules
   for common secret, token, cookie, authorization, and sensitive payload keys.
2. Preserve and test request correlation across successful requests, failures,
   and readiness errors without changing response contracts except where the
   existing request ID is already part of the contract.
3. Normalize the small set of operational event names and metadata owned by
   the existing startup, request, error, health, and readiness paths.
4. Document the event schema and operator-safe fields for local logs and the
   existing deployment log sink.

## Security and tenancy invariants

- Never log bearer tokens, cookies, passwords, reset/invite tokens, API keys,
  database URLs, authorization headers, request bodies, or raw customer data.
- Request IDs are correlation metadata, not authorization credentials.
- Organization IDs and actor IDs may be logged only where already present in a
  safe operational event and must not widen resource access or bypass RLS.
- Preserve forced RLS, request-scoped transactions, existing auth/RBAC, and
  tenant isolation. Observability must be fail-safe and non-authorizing.

## Explicit non-goals

No tracing vendor, metrics backend, alerting product, durable event store,
queue, new database tables, migrations, schema/index changes, log shipping
credentials, dashboard, retention policy, new role/permission, auth change,
S027 browser evidence, S036 index work, or S038 retry implementation.

## Required verification

- Unit tests for redaction, structured event shape, request correlation, health,
  readiness, and error paths.
- Negative tests proving secrets and request payloads do not reach log output.
- Existing application tests plus lint, typecheck/build, and repository docs and
  preflight checks.
- Review the final diff for PII, credential, tenant-boundary, and log-volume
  risks. No production-log or browser evidence is claimed without observation.

## Completion evidence

Record changed event fields, redaction tests, CI, review findings, known log
volume limitations, and the exact main merge in
`docs/architecture/S037_COMPLETION_EVIDENCE.md`.
