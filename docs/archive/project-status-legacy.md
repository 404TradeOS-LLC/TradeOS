---
status: archived
superseded_by: docs/CURRENT_STATE.md
do_not_use_for_implementation: true
---

# Project Status

Last updated: 2026-07-03

## Release posture

TradeOS is in RC1 hardening.

The repository is no longer organized around sprint delivery or MVP feature chasing. The current objective is to stabilize, polish, verify, and document the product that already exists so it can be treated like a release candidate for a commercial software launch.

## What is implemented

### Core platform

- Express + TypeScript backend in `app/`
- Next.js 16 frontend in `web/`
- bearer-token auth with organization membership checks
- forced PostgreSQL row-level security with request-scoped Prisma session state
- tracked Prisma migrations and role-provisioning rollout scripts
- structured API request/error logging, request IDs, and health endpoint

### Active product workflow

TradeOS currently supports the primary contractor flow across:

- customer records
- project creation and project workspace
- site visit intake and field notes
- estimate creation, duplication, comparison, and AI-assisted drafting
- proposal drafting, review, preview, and lifecycle management
- contract generation, portal review, and signature capture
- invoice creation, issue, and payment-status workflow
- change orders
- project tasks
- closeout and warranty-supporting document organization

### UI and workflow posture

- project detail is now a workspace rather than a single estimating page
- field, office, and document activities reuse one shared frontend system
- customer-facing document flows are connected to the same project record
- empty states, loading states, and contractor-facing copy have been tightened for RC1

## Current strengths

- clear backend service/module boundaries
- strong multi-tenant security model
- good unit-test and live-RLS test coverage
- reusable frontend component structure
- deployment and migration story is documented and scriptable
- estimate, proposal, contract, invoice, and project surfaces now feel like one product instead of isolated modules

## RC1 blockers and active hardening themes

The biggest remaining launch concerns are:

- a few still-incomplete workflow surfaces that need final polish or clearer scoping
- supplier integration plumbing being real while live feed ingestion is still stubbed
- release documentation and repository hygiene still catching up to the actual product state

See:

- `docs/RC1_READINESS.md`
- `docs/DEPLOYMENT_GUIDE.md`

## Intentionally not in RC1

The following are still out of scope for RC1 unless priorities change:

- scheduling and crew dispatch
- payroll and accounting integrations
- ERP sync and payment processing
- inventory management
- full warranty claims as a dedicated backend module
- persisted lifecycle event-log tables replacing all derived activity views
- long-term AI suggestion telemetry and feedback persistence rewrites

## Confidence summary

TradeOS is beyond prototype stage.

The system now behaves like a connected construction workflow platform, but RC1 still depends on finish quality: final documentation alignment, launch-safe workflow wording, and disciplined production hardening rather than new feature expansion.
