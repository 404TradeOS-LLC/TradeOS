---
status: current
owner: platform
last_verified: 2026-07-14
source_of_truth: false
related_code:
  - app/domain/contracts.ts
  - app/modules/auth/service.ts
---

# ADR-002 Canonical Role Model

## Status

Accepted

## Context

Older repository phases referenced `estimator` and `viewer`, but the live role and permission model now centers on `owner`, `admin`, `dispatcher`, and `technician`.

## Decision

Treat `owner`, `admin`, `dispatcher`, and `technician` as canonical roles. Keep `estimator` and `viewer` only as compatibility inputs that normalize at runtime.

## Consequences

- documentation and new product work use one role vocabulary
- persisted legacy values can continue to function during transition
- auth and RBAC docs must document compatibility mappings explicitly

## Alternatives considered

- continuing to treat legacy roles as first-class
- forcing an immediate destructive cleanup of persisted legacy values
