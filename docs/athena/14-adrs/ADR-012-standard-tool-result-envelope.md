# ADR-012: Tool Results Use A Standard Result Envelope

Status: Accepted

## Context

Arbitrary tool output makes planning, user responses, telemetry, events, and
error handling inconsistent.

## Decision

Every Athena tool returns the standard result envelope containing `success`,
`summary`, `data`, `events`, `warnings`, `followUps`, and `telemetry`.

## Consequences

Tool results become predictable, auditable, and UI-friendly. Tool-specific data
must live under documented `data` schemas.

## Alternatives Considered

Tool-specific top-level responses; raw service responses; plain text results.

## Migration/Revisit Conditions

Revisit only to add compatible optional envelope fields with clear semantics.
