---
status: accepted
owner: platform
date: 2026-08-09
related_docs:
  - AGENTS.md
  - docs/ARCHITECTURE.md
  - docs/bible/VOLUME_3_ENGINEERING.md
  - docs/ENGINEERING_COMMAND_CENTER.md
  - docs/REPOSITORY_GOVERNANCE.md
---

# ADR-005: Athena monorepo platform boundary

## Context

TradeOS is implemented as a single first-party product repository with `app/`, `web/`, and supporting package content. Athena is being designed as the shared intelligence and orchestration layer for TradeOS while product domains such as Costbook, Estimator, Dispatcher, CRM, Field Tech, and Office Manager remain independently owned capabilities.

Development tools may use separate Codex projects, threads, or focused agent missions. Those working-context boundaries do not require separate Git repositories and should not create duplicate infrastructure or disconnected architecture.

RC1 hardening also means existing production code must not be broadly reorganized merely to resemble a desired future directory layout.

## Decision

TradeOS will remain one first-party product monorepo unless a later accepted architecture decision explicitly creates a repository boundary.

Athena's canonical reusable package location is reserved as:

```text
packages/athena/
```

Athena owns foundation-level AI concerns:

- AI kernel
- tool registry
- context engine
- router
- action framework
- shared AI interfaces and contracts
- capability-registration contracts
- orchestration and low-risk action policy

Athena remains domain-agnostic. Costbook, estimating, dispatch, CRM, Field Tech, Office Manager, and other business domains retain ownership of their data, invariants, services, and business rules. They expose bounded capabilities to Athena through explicit interfaces and tool registration.

Athena core must not import concrete domain business implementations. Domain adapters may depend on Athena contracts to register capabilities, but circular dependency between Athena core and feature domains is prohibited.

Codex and other AI-agent workstreams should operate from the repository root even when their mission is scoped to one capability. Agent context isolation is not repository isolation.

Existing `app/` and `web/` deployable boundaries remain authoritative during RC1. No production code is moved by this decision alone. `packages/athena/` is introduced only through bounded implementation work with tests and dependency migration.

A future `packages/costbook/` extraction is allowed only when a real reusable cross-application package boundary is demonstrated; symmetry with Athena is not sufficient justification.

## Consequences

### Positive

- one source of truth for TradeOS product code and architecture
- repository-wide dependency and test visibility for Codex and human contributors
- clear separation between orchestration infrastructure and domain business logic
- Athena can grow capabilities without becoming a monolithic business-logic package
- third-party tool registration can evolve behind stable Athena contracts

### Constraints

- domain modules must expose explicit capability contracts rather than being absorbed into Athena
- Athena core cannot depend on concrete Costbook, Estimator, Dispatcher, CRM, or other feature services
- package extraction requires implementation evidence, not cosmetic organization
- RC1 hardening takes precedence over broad folder movement

## Current-state clarification

`docs/bible/VOLUME_3_ENGINEERING.md` correctly describes the currently implemented repository as `app/`, `web/`, and `packages/knowledge-engine/`. This ADR adds the accepted target ownership boundary for Athena; it does not claim `packages/athena/` is already implemented.

Any future implementation that creates `packages/athena/` must update Volume 3 and other current-state documentation in the same PR so implemented architecture and accepted target architecture remain distinguishable.
