---
status: current
owner: platform
last_verified: 2026-07-14
source_of_truth: false
related_code:
  - app/modules/jobs/service.ts
  - app/prisma/schema.prisma
---

# ADR-001 Project Job Separation

## Status

Accepted

## Context

Projects had become the operational hub for commercial workflows, while field execution needed scheduling, assignment, and dispatch behavior that did not fit safely inside the project record itself.

## Decision

Keep `Project` as the workflow hub and model `Job` as a separate first-class execution record linked back to the project, customer, and service address.

## Consequences

- project-level commercial workflows stay stable
- scheduling and technician-assignment rules can evolve independently
- field access can be scoped to assigned technicians

## Alternatives considered

- storing schedule and assignment state directly on projects
- introducing a separate dispatch-only subsystem disconnected from the existing project workflow
