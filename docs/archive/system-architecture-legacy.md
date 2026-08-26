---
status: archived
superseded_by: docs/ARCHITECTURE.md
do_not_use_for_implementation: true
---

# System Architecture

Last updated: 2026-07-03

## Overview

TradeOS is a two-application system:

- `app/` — Express + TypeScript backend API
- `web/` — Next.js frontend

The current product shape is project-centered:

`Lead -> Customer -> Project -> Site Visit -> Estimate -> Proposal -> Contract -> Invoice -> Closeout`

The architecture deliberately keeps that lifecycle inside the existing backend/frontend split rather than introducing separate field, CRM, or document platforms.

## Backend architecture

### Runtime

- Node 20+
- Express
- Prisma
- PostgreSQL
- forced row-level security

### Security model

Every `/api/v1/*` request depends on three layers:

1. bearer JWT verification
2. organization-membership authorization
3. PostgreSQL RLS inside a scoped database session

The request-scoped transaction sets:

- `app.user_id`
- `app.org_id`
- `app.role`

This lets the database enforce tenant isolation even if an application filter were missed.

### Module pattern

Business logic lives in `app/modules/<name>/` with:

- `types.ts`
- `service.ts`

Services take `orgId` explicitly and remain free of Express request objects.
Controllers handle Zod validation and HTTP adaptation.

### Active backend modules

Current primary modules include:

- `auth`
- `organization-provisioning`
- `cost-database`
- `labor-database`
- `material-database`
- `equipment-database`
- `assemblies-database`
- `estimate-engine`
- `ai-estimate-assist`
- `knowledge-runtime`
- `project-intake`
- `project-tasks`
- `proposals`
- `proposal-generator`
- `contracts`
- `invoices`
- `change-orders`
- `supplier-database`
- `supplier-integration`
- `admin-dashboard`

### Request/session behavior

- authenticated requests enter `requireAuth`
- request work is wrapped by `databaseSession`
- Prisma is routed through async-local request context
- background jobs use `runWithBackgroundDatabaseSession`

### Production hardening already in place

- centralized error handling
- structured JSON logging
- request IDs
- health endpoint
- auth and provisioning rate limiting
- migration deploy script plus database-role provisioning script

## Frontend architecture

### Runtime

- Next.js App Router
- React Server Components by default
- Server Actions for authenticated mutations
- TanStack Query only where interactive client behavior genuinely needs it

### Data flow

There are three intended access paths:

- server components and server actions call `web/src/lib/api.ts`
- client components call `web/src/lib/clientApi.ts` through `web/src/app/api/proxy/[...path]/route.ts`
- binary PDF/document downloads route through `web/src/app/api/documents/[...path]/route.ts`

Bearer tokens stay server-side in all three cases.

### UI organization

Reusable UI is organized by concern:

- `web/src/components/shared/`
- `web/src/components/projects/`
- `web/src/components/proposals/`
- `web/src/components/contracts/`
- `web/src/components/intake/`
- `web/src/components/estimate-assist/`
- `web/src/components/ui/`

### Route shape

The authenticated application shell lives under:

- `web/src/app/(app)/`

Current major app routes include:

- dashboard
- customers
- projects
- project workspace
- intake
- estimate builder
- estimate compare
- AI estimate assist
- proposal detail and preview
- contract detail and portal signing
- invoice detail and portal view

## Project workspace architecture

The project workspace is the operational hub for the product.

It is not a separate application. It is a project-detail expansion built from:

- a server-rendered project fetch
- project-scoped REST endpoints
- server actions for mutations
- reusable workspace panels and tabs

Current workspace areas include:

- overview
- estimate history
- proposals
- contracts
- invoices
- photos
- documents
- site visits
- tasks
- change orders
- timeline
- closeout and warranty-supporting records
- notes
- activity

## Document and lifecycle architecture

Proposal, contract, and invoice flows are separate modules, but they stay tied to one project lifecycle.

Supporting patterns:

- PDFs are generated on the backend
- project files remain the shared storage layer for photos and documents
- timeline and notification views are still derived from source records rather than a dedicated event-log table

## Supplier sync architecture

Supplier price updates are intentionally staged:

- supplier-fed proposals go into a review queue
- approval writes the actual material price change and audit trail
- sync can run from an in-process cron schedule or an external scheduler

The queue/review infrastructure is real.
Live supplier feed ingestion is still the part that remains intentionally incomplete for RC1 unless explicitly finished.

## Known intentional gaps

The following are still outside the current launch scope:

- scheduling and dispatch
- payroll and accounting
- inventory
- first-class warranty claims module
- full event-log persistence replacing derived lifecycle views
- long-term AI acceptance telemetry and knowledge feedback loops

## Architectural direction

The repository should continue to evolve by finishing and hardening the existing system:

- preserve APIs where possible
- preserve database compatibility
- avoid speculative abstractions
- expand through current module boundaries instead of inventing parallel platforms
