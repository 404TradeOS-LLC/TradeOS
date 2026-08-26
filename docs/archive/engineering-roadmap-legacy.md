---
status: archived
superseded_by: docs/ROADMAP.md
do_not_use_for_implementation: true
---

# Engineering Roadmap

Last updated: 2026-07-05

## Purpose

This roadmap translates the current repository audit and architecture review into the next recommended engineering sprints.

It is intentionally grounded in the current codebase.

It does not assume a rewrite.

It prioritizes release readiness, product trust, and architectural follow-through over speculative expansion.

## Roadmap principles

- finish and harden existing workflows before expanding into adjacent systems
- preserve the current backend/frontend split
- keep projects as the operational hub
- keep AI advisory and human-reviewed
- prefer shared platform primitives over one-off subsystem logic

## Priority order

### Sprint 2: Verification Baseline

Goal:

- restore and automate repository-wide confidence in lint, unit tests, integration tests, and production builds

Why now:

- rapid development is unsafe without a stable verification baseline
- the repo already had one failing backend suite and environment-dependent integration friction

What this sprint should include:

- fix drifting tests when request/auth contracts change
- add general GitHub Actions verification for app and web
- keep integration verification using the same migration + role-provisioning path as production

Estimated complexity: Medium

Dependencies:

- none

Risk level: Low

### Sprint 3: Release Surface Polish

Goal:

- remove contractor-visible placeholder surfaces and ensure active workflows read like commercial software, not internal scaffolding

Why now:

- visible placeholders are one of the clearest RC1 trust breakers

What this sprint should include:

- remove or downgrade unfinished UI affordances
- clean customer-facing document and portal copy
- eliminate demo-branded or internal framing in active product routes

Estimated complexity: Medium

Dependencies:

- Sprint 2 baseline verification

Risk level: Low

### Sprint 4: Lifecycle Consistency

Goal:

- normalize project, document, and workflow status vocabulary so the product speaks one consistent lifecycle language

Why now:

- overlapping statuses create long-term bugs in dashboards, filters, automation, reporting, and CRM evolution

What this sprint should include:

- standardize project status naming
- align backend DTOs, UI labels, and transition behavior
- document the canonical lifecycle states

Estimated complexity: Medium

Dependencies:

- Sprint 2 baseline verification

Risk level: Medium

### Sprint 5: Activity and Notification Convergence

Goal:

- make backend-owned activity and notification services the operational source of truth instead of relying on mixed derived UI timelines

Why now:

- the intelligence foundation exists, but adoption is incomplete
- this is the cleanest way to support CRM, notifications, portal auditability, and weather/event inputs later

What this sprint should include:

- expand `ActivityTimelineService.record()` coverage across business actions
- reduce derived timeline logic where persisted events now exist
- route notification UI toward backend-owned notification records

Estimated complexity: High

Dependencies:

- Sprint 4 lifecycle consistency

Risk level: Medium

### Sprint 6: Document Metadata and Versioning

Goal:

- deepen the document/file model so TradeOS can support closeout packages, signed artifacts, and customer-visible records more cleanly

Why now:

- the current shared file layer works, but classification and versioning are intentionally shallow

What this sprint should include:

- document categories and metadata
- version-aware handling for customer-facing artifacts
- better structure for permits, closeout, warranty, and signed deliverables

Estimated complexity: High

Dependencies:

- Sprint 3 release surface polish
- Sprint 5 activity convergence

Risk level: Medium

### Sprint 7: AI Review Telemetry

Goal:

- persist AI estimate-assist review outcomes so suggestion quality can be measured and improved safely

Why now:

- the assist flow is already live enough to justify feedback capture
- telemetry is a prerequisite for responsible AI iteration

What this sprint should include:

- acceptance/rejection/edit outcome persistence
- org-scoped analytics hooks
- review-first reporting, not autonomous learning behavior

Estimated complexity: Medium

Dependencies:

- Sprint 2 baseline verification
- Sprint 4 lifecycle consistency

Risk level: Low

### Sprint 8: Supplier Integration Scope Decision

Goal:

- resolve the gap between real supplier review infrastructure and the still-stubbed live supplier feed story

Why now:

- this is a product-positioning risk as much as a technical one

What this sprint should include:

- either complete one real supplier connector
- or explicitly relabel the feature everywhere as manual review infrastructure only

Estimated complexity: Medium to High

Dependencies:

- product decision on RC1 scope

Risk level: Medium

### Sprint 9: Warranty and Closeout Domain Hardening

Goal:

- decide whether warranty remains a supporting record surface or becomes a first-class backend-owned domain

Why now:

- the current lifecycle references warranty, but the architecture intentionally stops short of a dedicated module

What this sprint should include:

- explicit scope decision
- record model if promoted
- portal/document linkage if customer-facing

Estimated complexity: Medium

Dependencies:

- Sprint 6 document metadata and versioning

Risk level: Medium

### Sprint 10: Knowledge Engine Boundary Cleanup

Goal:

- clarify active knowledge-engine source versus duplicate/archive material to reduce long-term maintenance confusion

Why now:

- the runtime boundary is sound, but repository organization still creates avoidable ambiguity

What this sprint should include:

- archive boundary cleanup
- documentation of canonical runtime source paths
- explicit distinction between active exports, runtime inputs, and legacy material

Estimated complexity: Medium

Dependencies:

- none required for product behavior

Risk level: Low

### Sprint 11: Weather and Operational Signals

Goal:

- introduce weather-aware notifications and operational alerts through the existing intelligence/event model

Why later:

- structurally supported already, but not launch-critical compared with existing RC1 blockers

What this sprint should include:

- weather ingestion source
- event-to-notification mapping
- project-level alerting and audit trace

Estimated complexity: Medium

Dependencies:

- Sprint 5 activity and notification convergence

Risk level: Low

## Recommended milestone grouping

### RC1 closure

Recommended sprints:

- Sprint 2: Verification Baseline
- Sprint 3: Release Surface Polish
- Sprint 4: Lifecycle Consistency
- Sprint 8: Supplier Integration Scope Decision

Primary outcome:

- trustworthy release candidate with stable verification, consistent lifecycle language, polished active workflows, and honest product scoping

### v1.0 hardening

Recommended sprints:

- Sprint 5: Activity and Notification Convergence
- Sprint 6: Document Metadata and Versioning
- Sprint 7: AI Review Telemetry

Primary outcome:

- stronger operational platform quality without changing the fundamental architecture

### v1.1 operational maturity

Recommended sprints:

- Sprint 9: Warranty and Closeout Domain Hardening
- Sprint 10: Knowledge Engine Boundary Cleanup
- Sprint 11: Weather and Operational Signals

Primary outcome:

- deeper operational completeness built on the same platform seams

## Explicit non-recommendations

The roadmap does not recommend:

- microservices
- a separate CRM app
- a separate customer portal app
- replacing Express or Next.js
- rewriting the knowledge engine into a write-backed application module during RC1
- broad framework or infrastructure migrations unrelated to launch blockers

## Conclusion

TradeOS already has the right architectural spine for the next stage of development.

The best roadmap is a sequencing problem, not a redesign problem.

The next successful sprints should keep increasing confidence, consistency, and operational depth while preserving the current architecture that is already working.
