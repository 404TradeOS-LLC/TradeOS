---
status: current
owner: platform
last_verified: 2026-08-12
---

# Production Health Contract

TradeOS exposes separate liveness and readiness probes so operators and automated repair agents can distinguish a running process from a service that can actually serve production traffic.

## `GET /health`

`/health` is the liveness probe. It is dependency-free and should remain fast even when PostgreSQL or another downstream service is unavailable.

The response includes:

- `status: "ok"`
- service name
- application version
- current timestamp
- process uptime
- deployment commit SHA when `VERCEL_GIT_COMMIT_SHA` or `GIT_COMMIT_SHA` is available

A successful `/health` proves the API process is running. It does **not** prove the database is reachable.

## `GET /ready`

`/ready` is the traffic-readiness probe. It performs a minimal `SELECT 1` against the shared base Prisma client.

When the database probe succeeds, the endpoint returns HTTP `200` with `status: "ready"` and database latency. When it fails, the endpoint returns HTTP `503` with `status: "not_ready"` and a sanitized component status. Database connection strings, credentials, hostnames, query details, and stack traces are never returned.

Readiness failures emit the structured log event `health.readiness_failed` with the component name, latency, and normalized error message. Ordinary request completion continues to use the existing request-ID-aware structured logging middleware.

## Monitoring and repair-agent use

Production monitoring should check `/health` for process liveness and `/ready` for service availability. A production repair agent should use the distinction when triaging incidents:

1. `/health` fails: investigate deployment, runtime start, routing, DNS, or platform availability.
2. `/health` succeeds but `/ready` fails: prioritize database connectivity, credentials/configuration, connection limits, or database availability.
3. Both succeed but an authenticated workflow fails: investigate auth, tenancy/RLS, route behavior, domain logic, or frontend/backend integration instead of treating the API as globally down.

These probes are diagnostics, not an authorization bypass. They remain unauthenticated only because they expose intentionally minimal non-tenant health information.

## Future observability

This contract is the base layer for richer production observability. Future additions may include external error tracking, deployment/build correlation, latency/error-rate aggregation, alert routing, and dependency-specific readiness checks. New checks should fail closed only when the dependency is truly required to serve production traffic; optional integrations should not make the whole API unready.
