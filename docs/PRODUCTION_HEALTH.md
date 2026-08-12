---
status: current
owner: platform
last_verified: 2026-08-12
---

# Production Health Contract

TradeOS exposes separate liveness and readiness probes so operators and automated repair agents can distinguish a running process from a service that can actually serve production traffic.

## `GET /health`

`/health` is the liveness probe. It is dependency-free and should remain fast even when PostgreSQL or another downstream service is unavailable.

The response includes status, service name, application version, timestamp, process uptime, and deployment commit SHA when available. A successful `/health` proves the API process is running; it does not prove the database is reachable.

## `GET /ready`

`/ready` is the traffic-readiness probe. It performs a minimal `SELECT 1` against the shared base Prisma client. Success returns HTTP 200 with `status: "ready"` and database latency. Failure returns HTTP 503 with `status: "not_ready"` and sanitized component status. Credentials, connection strings, hostnames, query details, and stack traces are never returned.

Readiness failures emit the structured log event `health.readiness_failed` with component, latency, and normalized error message.

## Monitoring and repair-agent use

1. `/health` fails: investigate deployment, runtime start, routing, DNS, or platform availability.
2. `/health` succeeds but `/ready` fails: prioritize database connectivity, configuration, connection limits, or database availability.
3. Both succeed but authenticated workflows fail: investigate auth, tenancy/RLS, route behavior, domain logic, or frontend/backend integration.

These probes remain unauthenticated because they expose intentionally minimal non-tenant health information.

## Future observability

This is the base layer for richer observability: external error tracking, deployment correlation, latency/error-rate aggregation, alert routing, and dependency-specific readiness checks. Optional integrations should not make the API globally unready unless they are truly required to serve traffic.
