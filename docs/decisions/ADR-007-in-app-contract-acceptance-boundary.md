# ADR-007: S020 remains authenticated in-app contract acceptance

Status: Accepted
Date: 2026-08-24
Decision owner: Founder

## Context

The current contract flow is an authenticated application mutation that records
a typed name or drawn signature, a server timestamp, request IP, and a contract
event. It does not provide identity verification, certificate-backed signing,
or immutable signed-document evidence.

## Decision

S020 is authorized as a bounded authenticated in-app acceptance/signature flow.
The authenticated server-side identity and active organization membership remain
the authority for who may act. The existing signature metadata, server time,
request IP, contract event history, permission checks, organization scoping,
request-scoped transactions, and forced RLS must be preserved and tested.

TradeOS must describe this as in-app contract acceptance/signature evidence. It
must not claim certificate-backed signatures, identity verification, notarized
execution, or a standalone legal e-signature service.

## Required S020 boundary

- Preserve the current authenticated customer/actor boundary; do not invent a
  public link, magic link, customer token, or separate identity model.
- Validate the eligible contract state server-side and make the transition
  durable, auditable, tenant-safe, and safely repeatable.
- Preserve signer attribution, timestamp, request metadata, and event history.
- Stop and return for a new founder decision if formal e-signature, identity
  verification, certificate evidence, public signing, or new persistent auth
  state becomes necessary.

## Explicit non-goals

No DocuSign/Adobe Sign integration, certificate authority, formal legal-opinion
claim, new auth architecture, RBAC/RLS redesign, schema expansion, or S021/S022
implementation is authorized by this ADR.
