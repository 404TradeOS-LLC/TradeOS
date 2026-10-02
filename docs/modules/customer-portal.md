---
status: current
owner: platform
last_verified: 2026-08-28
source_of_truth: false
related_code:
  - web/src/app/(app)/portal
  - web/src/app/customer-portal
  - app/modules/customer-portal
  - app/backend/routes/customerPortal.routes.ts
  - web/src/app/actions/proposals.ts
  - web/src/app/actions/contracts.ts
  - web/src/app/actions/invoices.ts
  - web/src/lib/document-workflow.ts
---

# Customer Portal

## Purpose

Provide staff-accessible previews and a customer-scoped public document portal for proposals, contracts, invoices, and project summaries.

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
- `/customer-portal/access?token=...`
- `/customer-portal/access/confirm`
- `/customer-portal`
- `/customer-portal/projects/[id]`
- `/customer-portal/proposals/[proposalId]`
- `/customer-portal/contracts/[contractId]`
- `/customer-portal/invoices/[invoiceId]`

## Permissions

The `/portal/*` preview depends on the staff session. The `/customer-portal/*`
surface uses a separate customer magic-link principal: a single-use hashed
access token redeems to a short-lived hashed session cookie, and every backend
request carries the server-side organization/customer scope in a dedicated
portal database session. Public resource checks require the requested project
to belong to both that organization and customer. Staff may revoke an issued
access value; revocation also invalidates every portal session redeemed from
that value. Opening the emailed URL does not redeem it: the GET stores the
validated opaque value in a ten-minute HttpOnly, path-scoped pending cookie,
redirects to a token-free confirmation URL, and requires an exact-origin POST
before calling the single-use redemption endpoint. This prevents automated
email scanners and link previews from consuming the invitation. See
[ADR-010](../decisions/ADR-010-customer-magic-link-portal.md), [RBAC_MATRIX.md](../RBAC_MATRIX.md), and [S018 readiness plan](../architecture/S018_CUSTOMER_PORTAL_AUTHENTICATION_PLAN.md).

## Lifecycle and statuses

Portal timelines render proposal delivery history, contract events, and invoice delivery history. See [WORKFLOW_LIFECYCLES.md](../WORKFLOW_LIFECYCLES.md).

## Invoice presentation

The portal project view lists all organization-scoped invoices for the project,
including total, recorded paid amount, derived balance due, due date, and
status. The invoice detail view shows the same server-derived values and a
sanitized history of recorded payments. Pending or failed payment rows are not
counted or displayed, and the portal does not expose the internal payment-
recording mutation or invent a pay-now action.

Staff preview PDFs continue to use the authenticated document proxy. Public
PDFs use `/api/customer-portal/*`, which forwards only the HttpOnly portal
session to the backend. The server-side document generators resolve canonical
organization branding; no client-selected organization is accepted.

Portal invoice loading uses the shared document-detail skeleton with an
accessible loading status and a valid two-column ratio at wide-screen sizes;
the loading state does not alter invoice data, permissions, or payment
behavior.

## Proposal review actions

`/portal/proposals/[proposalId]` uses the existing staff session-token path for
proposal reads and mutations. The public customer surface is read-only for
proposal documents in this slice. Customer-originated mutation is deliberately
limited to signing a pending contract through the dedicated portal policy.

## Tests

- backend authentication and tenant-boundary behavior is covered by `app/tests/auth.middleware.test.ts`, `app/tests/jwt.local.test.ts`, and the live PostgreSQL assertions in `app/tests/rls.integration.ts`
- portal access-token/session replay, customer/tenant scoping, and portal-only contract signing are covered by `app/tests/customer-portal.service.test.ts` and `app/tests/customer-portal.migration.test.ts`
- public portal pages and PDF routes keep portal session tokens server-side; no client-selected organization is accepted
- the web access-gate regression checks pin non-consuming GET behavior, exact-origin POST redemption, pending-cookie cleanup, and the absence of a raw-token form field
- focused web validation rejects absent, malformed, or expired backend redemption payloads before setting the HttpOnly session cookie; service denial checks cover invalid/revoked/expired secrets, customer and organization ownership for each document and PDF, and draft exclusion

S059 still requires live authenticated browser, real PostgreSQL/RLS, and retained
redaction-safe security evidence. Never retain a raw access URL, response body,
cookie, or request header in screenshots, recordings, console logs, traces, CI
artifacts, or test fixtures. Record only opaque test-case labels and outcomes.

## Known limitations

- S018 shipped the staff-session hardening; ADR-010 now adds a separate customer magic-link principal for `/customer-portal/*`. Raw access values are single-use and hashed, sessions are short-lived and hashed, and customer/tenant scope is rechecked on every public resource request.
- Contract portal presentation now includes the frozen agreed amount and snapshot-backed scope when available; it does not change the staff-session gate.

## Deferred work

- customer proposal accept/decline actions remain a separate slice; the public identity, server-side access-link delivery, scanner-safe confirmation gate, and contract-signing boundary are implemented here

## Last verified date

2026-09-21 (scanner-safe server-side portal access delivery)

## Access-link delivery

The staff-only `POST /api/v1/customer-portal/access-tokens` endpoint creates a single-use, customer-scoped token and schedules a server-side transactional email through `EmailService.sendCustomerPortalAccess`. The raw token is never written to logs or server-side persistence; production delivery requires `RESEND_API_KEY`, `EMAIL_FROM`, and an HTTPS `APP_BASE_URL`. The HTTP response may still expose the raw token to the authenticated staff caller for controlled staging and UI flows, but browser code must not send the email or persist it in script-readable storage.

The emailed URL first reaches a non-consuming GET. TradeOS validates the token
shape, places it in a short-lived HttpOnly cookie restricted to the access
path, and redirects to `/customer-portal/access/confirm` so the token is no
longer visible in the address bar. The confirmation button submits an
exact-origin POST; only that POST calls the backend redemption endpoint, clears
the pending cookie, and establishes the short-lived portal session. Automated
GETs therefore cannot spend the invitation.
