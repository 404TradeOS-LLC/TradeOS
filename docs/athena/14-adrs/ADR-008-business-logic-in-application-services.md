# ADR-008: Business Logic Lives In Application Services

Status: Accepted

## Context

TradeOS already follows service-owned modules and forced tenant boundaries.
Athena must not create a parallel business layer.

## Decision

Business logic lives in application services and domain logic, not tools, LLM
prompts, planner code, or plugins.

## Consequences

Tools stay thin and stable. Existing tests and RLS behavior remain meaningful.

## Alternatives Considered

Tool-owned business logic; planner-owned workflows; direct infrastructure calls.

## Migration/Revisit Conditions

Revisit only for service extraction, not for moving rules into LLM/tool code.
