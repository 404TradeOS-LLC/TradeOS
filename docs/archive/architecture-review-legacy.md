---
status: archived
superseded_by: docs/ARCHITECTURE.md
do_not_use_for_implementation: true
---

# Architecture Review

Last updated: 2026-07-05

## Purpose

This review evaluates whether the current TradeOS architecture can support the intended product surface without unnecessary rewrites.

The goal is not to redesign the system.

The goal is to confirm where the current architecture is already strong, where it can be extended safely, and where a small structural improvement would reduce future delivery risk.

## Current architectural shape

TradeOS is currently well-positioned as a project-centered operations platform built from:

- `app/` as the secured multi-tenant API
- `web/` as the authenticated operational workspace
- `packages/knowledge-engine/` as a read-only knowledge source

The strongest architectural choices already in place are:

- explicit backend module boundaries under `app/modules/*`
- request-scoped PostgreSQL RLS with org/user/role session values
- a project workspace that acts as the operational hub instead of splitting into separate apps
- a frontend data model that cleanly separates server-only fetches, browser proxy fetches, and binary document routing
- reusable shared intelligence primitives for activity, notifications, attachments, comments, tags, saved views, recents, and feature flags

## Product-area fit

### CRM

Status: supported with moderate extension work

Why:

- customer records already exist
- project-first workflow already models lead-to-project progression
- settings already include CRM workflow preferences
- intelligence foundation can support pipeline activity, notes, tags, saved views, and recent items

What is still needed:

- normalized lifecycle/status vocabulary for lead and opportunity stages
- richer customer interaction history
- persistent activity/event ownership instead of partially derived timelines

Recommendation:

- extend the existing customer/project/intelligence model
- do not introduce a separate CRM subsystem

### Customers

Status: strongly supported

Why:

- customer CRUD exists today
- customers already link directly to projects
- customer detail surfaces are already routed and integrated into the app shell

What is still needed:

- deeper comments/attachments/tag usage in the customer detail experience
- stronger metadata around communication history if RC1 evolves into full CRM operations

Recommendation:

- continue using customer as a first-class business entity inside the current project-centered model

### Projects

Status: strongly supported

Why:

- the project workspace is the operational hub
- estimates, files, site visits, tasks, proposals, invoices, contracts, and change orders already hang off the project record
- project routing and server-rendered composition are already stable

What is still needed:

- consistent project status naming
- richer event persistence for timeline fidelity

Recommendation:

- keep projects as the central aggregate root for TradeOS

### CostBook

Status: strongly supported

Why:

- cost, labor, material, equipment, supplier, and assembly modules already exist
- the current backend module pattern fits this domain well
- supplier review queue architecture safely stages pricing changes

What is still needed:

- live supplier connector decision
- dependency and documentation cleanup around knowledge-engine duplication

Recommendation:

- preserve the current modular backend structure
- avoid collapsing costbook logic into broader project modules

### Estimate Builder

Status: strongly supported

Why:

- estimate engine, compare flow, AI assist, and assembly quick-add behavior already exist
- the estimate builder already routes through the project context
- AI remains advisory and hands off into the deterministic estimate engine

What is still needed:

- persisted telemetry for AI acceptance/rejection
- continued UX polish around placeholders and review-state trust

Recommendation:

- keep AI advisory and estimate engine authoritative

### Documents

Status: supported with targeted hardening needed

Why:

- proposals, contracts, invoices, and PDF generation are already modularized
- document routes and portal views already exist
- project files provide a shared storage layer

What is still needed:

- better document metadata and versioning
- stronger artifact classification for closeout, warranty, permits, and signed deliverables
- removal of remaining placeholder copy in active document flows

Recommendation:

- evolve the current document modules and shared file model
- do not create a separate document platform

### Brand Studio

Status: supported

Why:

- brand profile, brand assets, and brand document settings already exist in schema and routes
- the frontend already has a dedicated brand-studio console

What is still needed:

- finish integration across all outbound document and notification surfaces
- reduce placeholder developer metadata in adjacent settings screens

Recommendation:

- continue as a bounded module
- no architecture change needed

### Knowledge Engine

Status: supported with clear boundary

Why:

- the runtime bridge is intentionally read-only
- loader, repository, matcher, and service seams are already separated
- AI estimate assist consumes the runtime without compromising transactional app logic

What is still needed:

- clearer repository boundary between active knowledge-engine source and duplicated/archive material
- versioned import strategy before any future write-backed knowledge workflows are introduced

Recommendation:

- preserve the read-only boundary
- do not move knowledge authoring into the main application during RC1

### Customer Portal

Status: supported with UX and security hardening still needed

Why:

- dedicated portal routes already exist for projects, proposals, contracts, and invoices
- contract signing and document review flows are already in place

What is still needed:

- final copy polish
- clearer authentication/session expectations for external users if the portal becomes more than a lightweight view layer
- document/versioning improvements so customer-visible artifacts are better controlled

Recommendation:

- extend the existing portal routes inside the current Next app
- do not create a second frontend

### AI Services

Status: supported with governance constraints

Why:

- AI estimate assist is already isolated from final pricing authority
- knowledge-runtime and intake services provide a deterministic/non-speculative foundation
- settings already model AI-related operational controls

What is still needed:

- acceptance telemetry
- better operational diagnostics
- discipline around keeping AI advisory rather than auto-committing business decisions

Recommendation:

- continue building AI features as supervised helpers over existing business modules

### Weather

Status: structurally supportable but not yet implemented

Why:

- the intelligence layer already defines `weather_alert` as a notification category
- project and scheduling context already exist where weather alerts would matter

What is still needed:

- event ingestion source
- notification delivery strategy
- activity/event persistence so weather-driven changes can be audited

Recommendation:

- implement weather as an intelligence/event input, not as its own subsystem

### Notifications

Status: partially supported

Why:

- generic notification tables and services already exist
- notification categories, priorities, and statuses are modeled
- frontend has notification UI building blocks

What is still needed:

- live backend-backed notification center usage across the app
- real delivery channels if email/SMS/browser push become launch requirements
- reduction of mock/derived notification data in document workflow helpers

Recommendation:

- build on the intelligence notification service already present
- avoid ad hoc module-specific notification tables

### Activity Timeline

Status: partially supported

Why:

- generic activity tables and services now exist
- several business actions already emit activity events

What is still needed:

- broader adoption across all major modules
- reduction of derived timeline-only logic from document helpers
- consistent event taxonomy

Recommendation:

- converge on backend-owned activity events as the source of truth
- this is the most important structural improvement still needed

## Architecture risks that matter now

The current repo does not need a rewrite, but it does have a few architectural risks worth addressing before large expansion:

1. Project status vocabulary is inconsistent and overlapping.
2. Activity and notification truth is split between persisted foundation services and derived UI helpers.
3. Knowledge-engine source and archive material are not separated cleanly enough for long-term maintainability.
4. Document/file storage is still intentionally shallow for metadata and version control.
5. Supplier integration naming overstates current capability if live ingestion remains stubbed.

## Necessary improvements only

The following improvements are justified by the current repository shape:

1. Standardize lifecycle and project status naming.
2. Expand persisted activity-event coverage across major business actions.
3. Move notification and timeline UIs toward backend-owned intelligence data.
4. Add document metadata/versioning instead of creating a new document subsystem.
5. Clarify active versus archive knowledge-engine material in the repository.
6. Add telemetry for AI assist review outcomes.

The following are not necessary right now:

- splitting the repo
- replacing Express
- replacing Next.js
- introducing a message bus
- creating microservices
- separating CRM, portal, or field operations into independent apps

## Conclusion

TradeOS can support the intended product map on its current architecture.

The codebase is already shaped correctly around:

- project-centered operations
- explicit backend modules
- secure org-scoped data access
- controlled AI assistance
- shared cross-entity intelligence services

The best next work is disciplined hardening and normalization, not a redesign.
