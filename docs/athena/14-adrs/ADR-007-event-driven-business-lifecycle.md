# ADR-007: Event-Driven Business Lifecycle

Status: Accepted

## Context

Athena's proactive behavior needs reliable signals from lead, estimate,
proposal, job, invoice, warranty, and maintenance workflows.

## Decision

Important business changes emit versioned events that subscribers can consume
for recommendations, notifications, memory updates, and observability.

## Consequences

Athena becomes proactive without polling every module or inventing state.

## Alternatives Considered

Polling dashboards; direct database triggers only; LLM conversation inference.

## Migration/Revisit Conditions

Revisit event infrastructure details as throughput, ordering, and replay needs
become concrete.
