# ADR-002: Registry-Based Tool Architecture

Status: Accepted

## Context

Athena needs many capabilities without allowing arbitrary model-selected code or
direct infrastructure access.

## Decision

All executable capabilities are registered tools with versioned metadata,
schemas, permissions, risk class, timeout, idempotency, and result envelope.

## Consequences

Tool discovery is governable and auditable. Unsupported actions fail closed.

## Alternatives Considered

Free-form function calling; direct service discovery; prompt-only instructions.

## Migration/Revisit Conditions

Revisit only if a future runtime provides stronger typed capability governance
without weakening auditability or permission checks.
