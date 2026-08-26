---
status: archived
superseded_by: docs/ROADMAP.md
do_not_use_for_implementation: true
---

# Next Engineering Sprints

## Sprint 2: Job Lifecycle Engine

Build the first complete operational workflow:

Customer -> Project -> Scheduled Job -> Technician Assignment -> Estimate -> Approval -> Invoice -> Payment

Backend deliverables:

- project lifecycle fields and archive support
- job scheduling and technician assignment
- estimate totals, approval flow, and invoice generation
- reusable activity timeline and audit trail coverage
- tenant-isolation and workflow tests

Definition of done:

- owner can complete the full workflow through backend APIs
- role restrictions are enforced
- tests, lint, and build are green

## Sprint 3: Operational Refinement

After the lifecycle engine is stable:

- stronger reporting and dashboards
- overdue / payment state automation
- richer search over projects, jobs, estimates, and invoices
- attachment and document workflow hardening
- stronger admin and support tooling

## Sprint 4: RC1 Hardening

- migration validation in production-like environments
- resilience and rate-limit review
- audit and timeline completeness review
- API documentation cleanup
- release readiness pass across contractor-visible workflow states

## Engineering Priorities Across Sprints

1. Preserve the current architecture
2. Prefer extending proven modules over creating parallel systems
3. Make workflow transitions explicit and testable
4. Keep tenant isolation and auditability non-negotiable
5. Build services first, UI second

## Living Document Rule

These sprint notes should be updated as scope narrows, exits criteria move, or a later sprint absorbs work that was scaffolded intentionally in an earlier sprint.
