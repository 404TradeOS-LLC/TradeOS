# S020 Completion Evidence — Portal Contract Signing Flow

Status: DONE

## Shipped outcome

S020 hardened the existing authenticated in-app contract acceptance/signature
boundary. Contract sign and void mutations now require organization scope and
use organization-scoped expected-status predicates. Stale competing mutations
fail closed before recording a losing contract event, and repeated voiding is
rejected.

Implementation PR #322 merged to `main` as
`a3e9d376ebb1f350330b8924951c12ffc00911f3`.

## Scope preserved

- Existing `documents.manage` authorization remains the write boundary.
- Existing authenticated session, server-derived organization context, forced
  PostgreSQL RLS, route/API shapes, actor attribution, and contract event
  history remain intact.
- ADR-007 remains authoritative: this is bounded authenticated in-app
  acceptance/signature evidence, not certificate-backed signing, identity
  verification, notarization, or standalone legal e-signature semantics.
- No schema migration, new identity model, public link, token persistence,
  provider integration, payment behavior, or document-rendering redesign was
  introduced.

## Acceptance and security evidence

- Focused contract service tests: 10 passed, 0 failed.
- Coverage includes successful signing, already-signed rejection, repeated
  void rejection, competing sign failure, competing void failure, and no event
  creation for losing mutations.
- Organization scope is mandatory for sign and void service inputs and remains
  present in both mutation predicates.
- Full repository Verify workflow passed App unit tests, App integration and
  migration rehearsal, App typecheck/lint/build, dependency audit, and the
  applicable Web checks.
- Docs consistency, live documentation reconciliation, sprint governance,
  dependency review, and branch currency checks passed.

## Known limitation

The status update and contract-event write are not yet wrapped in one database
transaction. The expected-status predicates prevent stale competing mutations;
transactional event atomicity remains future hardening if separately promoted.

## Production verification

`NOT RUN`: no production signing or authenticated browser execution was
performed. Repository and CI evidence only is claimed.
