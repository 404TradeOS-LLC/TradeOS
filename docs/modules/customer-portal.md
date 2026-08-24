---
status: current
owner: platform
last_verified: 2026-08-24
source_of_truth: false
related_code:
  - web/src/app/(app)/portal
  - web/src/app/actions/proposals.ts
  - web/src/app/actions/contracts.ts
  - web/src/app/actions/invoices.ts
  - web/src/lib/document-workflow.ts
---

# Customer Portal

## Purpose

Provide customer-facing document and project views for proposals, contracts, invoices, and portal project summaries.

## Source code locations

- `web/src/app/(app)/portal/**`
- `web/src/lib/document-workflow.ts`

## Core models

- portal pages consume `Project`, `Proposal`, `Contract`, `Invoice`, and their history DTOs

## Routes

- `/portal/projects/[id]`
- `/portal/proposals/[proposalId]`
- `/portal/contracts/[contractId]`
- `/portal/invoices/[invoiceId]`

## Permissions

Portal routes currently depend on the same authenticated web session and backend authorization model as the internal application. `web/src/proxy.ts` refreshes the Supabase session for `/portal/:path*`; server-side pages pass the session bearer token to protected `/api/v1/*` routes, where verified identity, active organization membership, request-scoped database session, and forced PostgreSQL RLS remain authoritative. There is no separate customer token or customer identity model today. See [RBAC_MATRIX.md](../RBAC_MATRIX.md) and [S018 readiness plan](../architecture/S018_CUSTOMER_PORTAL_AUTHENTICATION_PLAN.md).

## Lifecycle and statuses

Portal timelines render proposal delivery history, contract events, and invoice delivery history. See [WORKFLOW_LIFECYCLES.md](../WORKFLOW_LIFECYCLES.md).

## Tests

- currently validated through the broader web build and workflow surfaces

## Known limitations

- portal authentication hardening remains an RC1 follow-through area and is now `READY` as S018; no runtime implementation has shipped from that readiness promotion

## Deferred work

- broader customer self-service behavior beyond document viewing and related project context

## Last verified date

2026-07-14
