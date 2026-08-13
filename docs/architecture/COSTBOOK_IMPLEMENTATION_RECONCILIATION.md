---
status: current
owner: platform
last_verified: 2026-08-12
source_of_truth: true
related_docs:
  - docs/architecture/COSTBOOK_DOMAIN_ARCHITECTURE.md
  - docs/modules/cost-book.md
  - docs/CURRENT_STATE.md
  - docs/SPRINT_BACKLOG.md
  - docs/SESSION_HANDOFF.md
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
related_code:
  - app/modules/cost-database
  - app/modules/labor-database
  - app/modules/material-database
  - app/modules/equipment-database
  - app/modules/assemblies-database
  - app/modules/costbook
  - app/backend/routes/costDatabase.routes.ts
  - app/backend/routes/costbook.routes.ts
  - web/src/app/(app)/costbook
---

# Costbook Implementation Reconciliation

## Purpose

This document records the live Costbook implementation boundary so new work extends the existing pricing-intelligence domain instead of recreating it. The original reconciliation was written while C001-C004 were landing and before C005 existed; that historical snapshot is no longer an accurate implementation plan.

## Current implementation truth

Costbook is not greenfield. TradeOS already has one authoritative catalog/pricing model built on the existing tenant-scoped `Division`, `Category`, `Subcategory`, `CostItem`, `LaborRate`, `Material`, `Equipment`, `Assembly`, and `AssemblyItem` models.

Two layers intentionally coexist:

- **Legacy catalog services** under `app/modules/{cost-database,labor-database,material-database,equipment-database,assemblies-database}`.
- **Unified Costbook boundary** under `app/modules/costbook` and `/api/v1/costbook/*`, which wraps those existing tables behind `costbook.read`, `costbook.write`, and `costbook.manage` rather than duplicating them.

The legacy routes remain compatibility surfaces. New Costbook slices should prefer the unified boundary while preserving existing domain ownership and relationship-derived pricing semantics.

## C-series status

### C001 — Workspace foundation — merged

Provides `GET /api/v1/costbook/workspace`, Costbook-specific permissions, forced-RLS workspace foundation tables, and the `/costbook` route.

### C002 — Materials catalog — merged

Provides organization-scoped Costbook material reads/writes over the existing `materials` table, material price-audit behavior, and `/costbook/materials`.

### C003 — Labor rates foundation — merged

Extends the existing `labor_rates` table in place and exposes Costbook labor-rate CRUD/deactivation plus `/costbook/labor-rates`.

### C005 — Hierarchy management — merged

The earlier reconciliation identified Division/Category/Subcategory detail/update/delete and hierarchy UI as future work. That gap is now closed. C005 provides full hierarchy CRUD under `/api/v1/costbook/{divisions,categories,subcategories}` and the `/costbook/divisions` hierarchy UI.

PR #151 subsequently hardened that hierarchy and merged as `5b7dbcbfaa589360fb349f4badaca394683c3da7`. The merged boundary includes explicit parent-derived tenant predicates, cross-organization parent rejection, active-child checks beneath inactive ancestors, and parent-deactivation guards that prevent active descendants from being stranded beneath inactive parents. The old plan to build hierarchy CRUD/UI is therefore retired and must not be reimplemented.

### C004 — Equipment catalog — replacement PR #183

Original PR #128 is closed as superseded. PR #183 (`feature/costbook-c004-reconciled`) rebuilds C004 directly on post-#151 hardened `main` and preserves only equipment-specific scope:

- Costbook equipment list/detail/create/update/delete APIs;
- legacy equipment permission alignment;
- the existing `equipment` table and existing forced-RLS tenant boundary;
- Costbook-specific owner/admin write policy;
- cent-safe hourly-cost derivation and nullable daily-rate handling;
- `/costbook/equipment` real-data UI;
- live PostgreSQL proof for tenant-scoped reads, owner writes, technician denial, and cross-organization denial.

As of this reconciliation, PR #183 has green Docs consistency and Verify repository workflows, fresh CodeRabbit approval, and resolved review threads. It still contains a migration and remains a protected human-decision boundary until merged or otherwise retired.

## Architectural decision

The existing Costbook domain remains the source of truth. Future work must:

- extend existing models and services rather than create parallel `Division`/`Category`/`Subcategory`/`CostItem` systems;
- preserve relationship-derived CostItem cost composition rather than introduce a flat incompatible `cost`/`markupPercentage`/`vendor` model;
- keep organization isolation enforced by request-scoped database sessions and forced RLS;
- keep AI review-first for writes and route estimate-line mutations through `EstimateEngineService`;
- preserve legacy routes only as compatibility surfaces while new functionality converges on `/api/v1/costbook/*`.

## S027 governance status

S027 — Intelligent Costbook production readiness remains `BLOCKED`, but its recorded blocker history must be interpreted against live GitHub state:

- PRs #94, #95, and #96 are merged; those original blockers are resolved.
- PR #151 is merged as `5b7dbcbfaa589360fb349f4badaca394683c3da7`.
- PR #128 is closed and superseded by PR #183.
- PR #183 is the current overlapping Costbook implementation and remains open/protected.

Removing old blockers does **not** automatically make S027 `READY`. S027 is intentionally broader than the C-series catalog foundations. Promotion requires a separate governance-only readiness review after active Costbook overlap is resolved.

## Remaining S027 scope after C001-C005

The remaining production-readiness mission is not another hierarchy rebuild. It is the evidence-backed integration/hardening layer across the existing system, including where justified by live repository state:

- coherent search/filter/sort/pagination across Costbook surfaces;
- assembly and derived-cost workflow hardening;
- truthful regional/supplier pricing provenance and sync state;
- Knowledge Runtime retrieval/semantic matching through existing architecture;
- review-first AI assistance without autonomous database writes;
- representative contractor E2E coverage;
- loading/error/empty/accessibility/responsive behavior;
- query/index work only when supported by measured evidence and the appropriate dependent sprint/governance gates.

Any future S027 implementation branch must first reverify PR #183 and all other live Costbook overlap, then promote S027 through `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md`. This document does not itself promote the sprint.

## Repository cleanup note

The historical `app/.claude/skills/run-tradeos-costbook-api/` material described a standalone Costbook API/admin topology that no longer matches the monorepo runtime. Treat such legacy instructions as historical unless their paths are independently verified against current `app/` and `web/` source. Do not use stale standalone topology as a reason to create duplicate services.
