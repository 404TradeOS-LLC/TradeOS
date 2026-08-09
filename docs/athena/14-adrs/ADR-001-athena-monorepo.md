# ADR-001: Athena Remains Inside The TradeOS Monorepo Initially

Status: Accepted

## Context

Athena depends on TradeOS auth, RBAC, application services, Knowledge Runtime,
AI Estimate Assist, Activity and Intelligence primitives, and documentation
governance.

## Decision

Athena architecture, contracts, first-party tools, and early runtime code remain
inside the TradeOS monorepo initially.

## Consequences

This keeps implementation close to service boundaries and docs governance. It
also means Athena changes must respect normal TradeOS validation and PR rules.

## Alternatives Considered

Separate AI service; separate plugin repository; vendored prototype.

## Migration/Revisit Conditions

Revisit when Athena needs independent deployment cadence, scaling boundaries, or
external SDK distribution that cannot be managed cleanly in the monorepo.
