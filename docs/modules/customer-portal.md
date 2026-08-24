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

- backend authentication and tenant-boundary behavior is covered by `app/tests/auth.middleware.test.ts`, `app/tests/jwt.local.test.ts`, and the live PostgreSQL assertions in `app/tests/rls.integration.ts`
- portal pages and document proxies continue to use server-side session token propagation; no client-selected organization or public-link path is introduced

## Known limitations

- S018 shipped the bounded hardening of the existing boundary: local access tokens expire and reject malformed claims, inactive users cannot refresh or bootstrap a session, and the PostgreSQL/RLS test suite asserts same-organization access plus cross-organization denial for portal resources. Exact-head Verify repository #1332 and the associated governance checks passed before implementation merge. There is still no separate customer identity, portal token, or immediate bearer-revocation model.

## Deferred work

- broader customer self-service behavior beyond document viewing and related project context

## Last verified date

2026-08-24 (S018 implementation and exact-head CI evidence)
