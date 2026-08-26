---
status: current
owner: platform
last_verified: 2026-07-14
source_of_truth: true
related_code:
  - README.md
  - app/backend/server.ts
  - web/src/app
---

# Product Scope

## Purpose

TradeOS is a contractor operations platform for small and mid-sized trade businesses. The current product centers on customer, project, estimating, document, billing, and field-execution workflows inside one tenant-scoped workspace.

## Target contractor profile

TradeOS is currently shaped for teams that need:

- one company-scoped operating system rather than separate estimator, CRM, dispatch, and document tools
- fast movement between office and field workflows
- project-centered coordination with strict tenant isolation
- branded customer-facing proposals, contracts, invoices, and portal views

## Core product boundaries

TradeOS owns:

- tenant-scoped identity and organization membership
- customer and project records
- site visit intake and operational notes
- cost-book-backed estimating
- proposal, contract, invoice, and payment-state workflows
- jobs, technician assignment, scheduling and rescheduling, dispatcher coordination, and schedule conflict handling
- activity and search primitives inside the authenticated workspace

TradeOS does not currently claim to be:

- a general ledger
- payroll software
- a route optimization platform
- an inventory system
- a public marketing site builder

## In-scope RC1 capabilities

- email and password sign-up, login, refresh, and httpOnly-cookie web sessions
- project-first workflow from customer creation through invoice/payment-state updates
- customer -> project -> job coordination with project-linked field execution records
- job creation, assignment, scheduling, rescheduling, and operational status coordination
- dispatcher workflows for technician assignment, schedule management, and permitted workload coordination
- AI estimate assist as advisory input only
- customer portal access to project-related commercial documents
- Brand Studio for organization-scoped document presentation
- supplier price-review queue with scheduler plumbing

## Explicitly out of scope

- automated supplier feed integrations beyond the current stubbed fetch path
- advanced dispatch optimization or routing
- automated route optimization
- fleet-routing intelligence
- GPS fleet tracking
- automatic technician-routing decisions
- payroll and accounting reconciliation
- public self-service payment processing
- speculative platform rewrites or new deployable applications

These exclusions do not remove the existing jobs, scheduling, technician-assignment, or dispatcher workflows already present in the product.
