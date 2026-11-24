# ADR-010: Customer magic-link portal identity

Status: Accepted
Date: 2026-08-28
Decision owner: Founder

## Context

The existing `/portal/*` pages are an authenticated staff-session preview. The
approved pre-beta workflow also needs a customer to review shared documents and
sign a pending contract without a TradeOS staff account. ADR-007's decision to
avoid a public identity model applied to the earlier in-app-only scope and is
superseded for this customer self-service surface.

## Decision

TradeOS uses an expiring, customer-scoped magic-link principal for the public
customer portal. A staff member with `documents.manage` may issue a link for a
customer who has an email address. The raw high-entropy value is returned only
at issuance and is never persisted; the database stores only its SHA-256
digest.

The link is single-use. Redemption atomically marks the access token consumed
and creates a short-lived, opaque, hashed portal session. The session carries
the organization and customer scope server-side. Public reads must verify both
that scope and the requested resource's project/customer relationship; a
customer session cannot access staff routes, another customer's records, or a
different organization.

Customer-originated writes are limited to signing the customer's pending
contract. A dedicated PostgreSQL policy permits only the exact pending contract
bound to the session customer to transition to `signed`; the portal does not
receive a staff role or the staff-wide write helper. The signature is attributed
to the customer record and portal session. Network address and user agent are
retained only as explicitly reported metadata because the web tier may proxy
the request. Magic-link possession is not represented as certificate-backed
identity verification, notarization, or a legal-signature guarantee.

The public route group is `/customer-portal/*`; the existing `/portal/*` staff
preview remains available and continues to use the staff session boundary.

## Consequences

- Customers can access shared projects, proposals, contracts, and invoices
  without a staff login.
- Link replay is rejected after the first redemption; active sessions expire
  and are invalidated when the customer is deleted.
- Public portal security depends on the database token/session tables, forced
  RLS, resource-level customer checks, and the narrowly scoped contract-sign
  policy working together.
- Outbound email delivery of an issued link remains an adapter concern; the
  authenticated issuance endpoint provides the link for the delivery layer and
  controlled verification workflows.

## Amendment — DES-10-F7 governed proposal response (2026-11-24)

Founder decision 2026-11-24 ~09:00 EST (DES-10 verdict gap 7: the public
proposal portal was read-only; the Copperline TARGET frames specify a
governed approval + signature experience). The permitted
customer-originated writes extend from contract signing alone to the
governed proposal response:

- `POST /api/v1/customer-portal/proposals/:id/accept` — sent/viewed →
  `accepted`, only with a drawn signature image plus the printed name,
  attributed to the customer record's email on file (never a
  caller-supplied email) and the portal session.
- `POST /api/v1/customer-portal/proposals/:id/decline` — sent/viewed →
  `declined`, with an optional reason (≤ 500 chars) recorded in the audit
  event.

The identity model is unchanged: the same organization/customer-scoped
magic-link principal (the service asserts the proposal belongs to the
session's customer before any write; the single-proposal scope is
transaction-local — a dedicated RLS policy keyed by
`app.portal_proposal_id` plus a trigger pinning every column except the
response itself is the second layer), and no staff role or staff-wide write
helper for the portal. The signature must decode to an actual image (a
bare `data:image/` prefix with no payload is rejected at the HTTP boundary,
in the service, and by the trigger). Both responses take an optional
`expectedUpdatedAt` binding the answer to the revision the customer
reviewed — a staff edit after the page rendered is a 409. An error
response rolls the portal transaction back rather than committing a
half-recorded response. The portal displays what the
proposal already says — scope, prices, and terms cannot be rewritten from
the portal. Acceptance also awards the owning project (`estimating` →
`awarded`, staff accept parity, under its own narrow policy); declining
deliberately leaves the project untouched. Both responses record a
`proposal.accepted` / `proposal.declined` delivery event with
`delivery_channel: "portal"` and `actorType: "customer_portal"`, plus the
matching activity row; no Athena event is published and no email is sent.
The ADR-007 limits on legal-signature claims and provider/certificate
semantics remain in force: magic-link possession is not certificate-backed
identity verification, notarization, or a legal-signature guarantee.

## Supersession

This ADR supersedes the “no public link, token, or customer identity model”
non-goal in ADR-007 only for the approved `/customer-portal/*` surface. ADR-007's
limits on legal-signature claims and provider/certificate semantics remain in
force.
