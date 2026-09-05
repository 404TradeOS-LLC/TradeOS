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

## Supersession

This ADR supersedes the “no public link, token, or customer identity model”
non-goal in ADR-007 only for the approved `/customer-portal/*` surface. ADR-007's
limits on legal-signature claims and provider/certificate semantics remain in
force.
