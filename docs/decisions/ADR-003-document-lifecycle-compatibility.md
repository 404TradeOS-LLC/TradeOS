---
status: current
owner: platform
last_verified: 2026-07-14
source_of_truth: false
related_code:
  - app/domain/contracts.ts
  - app/modules/proposals/service.ts
  - app/modules/contracts/service.ts
  - app/modules/invoices/service.ts
---

# ADR-003 Document Lifecycle Compatibility

## Status

Accepted

## Context

The repository now has shared lifecycle language, but persisted proposal and contract values still include earlier names such as `rejected` and `pending_signature`.

## Decision

Define canonical display lifecycles in shared docs and contracts while preserving compatibility normalization for persisted legacy values until a dedicated migration and cleanup path is ready.

## Consequences

- UI and docs can speak one lifecycle language now
- services and migrations can clean up storage values incrementally
- lifecycle docs must distinguish canonical display status from compatibility persistence

## Alternatives considered

- documenting only the stored values
- rewriting all stored values immediately without a dedicated normalization plan
