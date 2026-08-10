# ADR-011: Stable Versioned Contracts

Status: Accepted

## Context

Athena needs compatibility across tools, context, memory, planner, telemetry,
events, and future plugins.

## Decision

Platform contracts C001-C012 are stable and versioned. Breaking changes require
major-version migration.

## Consequences

Agents and humans can review changes against explicit schemas instead of hidden
prompt behavior.

## Alternatives Considered

Ad hoc DTOs; implicit prompt contracts; versionless JSON.

## Migration/Revisit Conditions

Revisit contract versioning policy after first plugin or external SDK rollout.
