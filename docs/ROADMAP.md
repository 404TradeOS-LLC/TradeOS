---
status: current
owner: platform
last_verified: 2026-07-14
source_of_truth: true
related_code:
  - docs/CURRENT_STATE.md
  - app/backend/server.ts
  - web/src/app
---

# Roadmap

## Current milestone

RC1 hardening.

The strategic roadmap is executed through `docs/SPRINT_BACKLOG.md`. The Roadmap remains the strategic view; the Sprint Backlog is the tactical queue for one branch and PR at a time.

## Upcoming milestones

### Execution-system hardening

- establish `docs/TRADEOS_BIBLE.md` as the source-of-truth operating index
- use `docs/SPRINT_BACKLOG.md` as the canonical numbered sprint queue
- use `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md` to select the next safe sprint without a custom founder prompt
- keep this Roadmap high-level instead of duplicating all 50 sprint records

### Next coherent milestone: Lifecycle normalization

Business goal:

- make project, proposal, contract, invoice, and job state transitions read the same way in storage, APIs, workspace UI, and portal surfaces so release readiness is not undermined by status drift

Workflow focus:

- office staff should be able to move one project from lead through estimate, proposal, contract, scheduling, execution, invoicing, and closeout preparation without seeing conflicting lifecycle labels or incompatible actions between screens

Planned scope:

- reduce persisted legacy project and proposal status values where compatibility shims remain
- align contract pre-signature persistence with canonical lifecycle language
- continue narrowing project status drift between stored values and canonical display states
- preserve current RBAC boundaries and job override rules while making lifecycle behavior more explicit

Explicit exclusions:

- live supplier feed ingestion
- advanced dispatch optimization
- automated route optimization
- fleet-routing intelligence
- automatic technician-routing decisions
- public payment processing
- broad UI redesigns or architecture rewrites

These exclusions do not remove the existing jobs, scheduling, technician-assignment, or dispatcher workflow surface already in scope.

### Release hardening

- keep repository verification stable
- monitor the documentation-governance checks and tune ownership rules only where they prove too noisy
- improve customer-portal hardening
- verify production deployment and environment approval posture outside the codebase

## Deferred capabilities

- live supplier feed ingestion beyond the current queue and scheduler scaffolding
- advanced dispatch optimization
- route planning
- public payment processing
- payroll and accounting integrations
- inventory management

## Technical debt

- legacy roles remain in compatibility mode
- several lifecycle states still normalize older stored values
- cost-item and assembly substring code search still lacks trigram indexing, so mixed name-or-code search can remain scan-heavy
- older setup notes and deep-dive documents required archival and should stay archived

## Explicit non-goals

- redesigning the application architecture
- splitting the project workflow into separate products
- replacing RLS with app-only filtering
- inventing speculative abstractions ahead of verified product need
