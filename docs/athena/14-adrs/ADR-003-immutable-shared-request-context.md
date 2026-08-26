# ADR-003: Immutable Shared Request Context

Status: Accepted

## Context

Athena needs consistent facts across planning, approvals, and tool execution,
but providers can be stale, partial, or unavailable.

## Decision

Each request receives an immutable AI Context snapshot with provider freshness
and failure metadata.

## Consequences

Plans are reproducible and auditable. Consequential actions still revalidate
through services when live state is required.

## Alternatives Considered

Mutable shared context; tool-local ad hoc fetches; LLM-managed memory.

## Migration/Revisit Conditions

Revisit if streaming context updates are needed; preserve snapshot versions for
audit and approval decisions.
