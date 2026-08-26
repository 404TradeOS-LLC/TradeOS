# ADR-005: Long-Term Memory Model

Status: Accepted

## Context

Athena needs durable preferences and business context, but memory can become
stale, private, conflicting, or poisoned.

## Decision

Long-term memory is source-attributed, confidence-scored, scoped, retained by
policy, correctable, deletable, and auditable.

## Consequences

Memory improves continuity without becoming hidden ungoverned authority.

## Alternatives Considered

No long-term memory; raw transcript retention; model-provider memory only.

## Migration/Revisit Conditions

Revisit before enabling production memory writes or changing retention/deletion
policy.
