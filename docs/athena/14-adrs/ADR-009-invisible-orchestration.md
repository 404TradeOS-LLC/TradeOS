# ADR-009: Invisible Orchestration

Status: Accepted

## Context

Athena may use routing, planners, tools, evaluators, or subagents internally,
but users need one coherent assistant.

## Decision

Internal planning, routing, orchestration, tool selection, and subagents remain
invisible to users.

## Consequences

The user experience stays simple. Audit and telemetry still record internal
execution for review and debugging.

## Alternatives Considered

Expose agent names; let users choose tools manually; show raw chain-of-thought.

## Migration/Revisit Conditions

Revisit only for admin/debug views that show safe traces without revealing
hidden reasoning or sensitive data.
