# S020 Readiness Contract — Portal Contract Signing Flow

Status: READY

## Objective

Harden and prove the existing authenticated contract viewing, signing, decline,
and signature-audit boundary. The sprint is limited to durable, auditable
in-app acceptance/signature evidence.

## Existing boundary

The current mutation requires the existing authenticated internal
`documents.manage` permission and records the client-supplied typed name or
drawn signature, server timestamp, request IP, and contract event. ADR-007
explicitly resolves the product boundary: this is not certificate-backed
signing, identity verification, notarized execution, or standalone legal
e-signature service behavior.

## Allowed scope

- Existing contract service/controller/routes and focused tests.
- Existing authenticated session, server-derived organization context,
  request-scoped database session, forced PostgreSQL RLS, and actor/org audit
  attribution.
- Atomic or transaction-safe lifecycle transitions, idempotency/concurrency
  coverage, decline handling, and durable event/audit assertions where needed.
- Documentation and evidence required to prove the above.

## Required evidence

- Same-organization authenticated viewing/signing/decline succeeds only for
  authorized actors.
- Unauthenticated, invalid-session, unauthorized-role, malformed-ID, and
  cross-organization direct-object attempts fail closed.
- Competing sign/decline requests produce one valid durable transition and
  bounded, auditable outcomes; duplicate requests do not duplicate evidence.
- Signature event data remains tenant-scoped, actor-attributed, and durable.
- Existing route/API shapes and contract lifecycle semantics remain intact.

## Explicit non-goals

No new customer identity model, public link, token persistence, auth-provider,
RBAC/RLS policy, e-signature provider, certificate, notarization, legal claim,
schema migration, document-rendering redesign, payment behavior, or unrelated
numbered sprint work.

## Founder and dependency gate

Founder decision is resolved by ADR-007. S010 and S018 are DONE; no open S020
implementation/readiness overlap exists at this promotion snapshot. If the
implementation requires any forbidden product/legal/auth/schema boundary, stop
and prepare a founder-decision packet instead of widening scope.

## Validation contract

Run focused contract service/controller tests, PostgreSQL/RLS integration,
authorization and concurrency coverage, typecheck/lint/build, repository docs
and governance checks, and the required exact-head GitHub checks before merge.
