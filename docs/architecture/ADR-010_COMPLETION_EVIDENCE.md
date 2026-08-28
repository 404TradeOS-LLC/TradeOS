# ADR-010 Completion Evidence — Customer Magic-Link Portal

Status: COMPLETE

## Shipped outcome

ADR-010 is implemented on `origin/main`. Customers can redeem a one-time,
customer-scoped magic-link value into a short-lived portal session and use the
public `/customer-portal/*` routes to view their own projects, proposals,
invoices, and contracts. The only customer-originated mutation is signing the
exact pending contract associated with the verified customer and project.

Access-token and session secrets are stored only as SHA-256 digests. Redemption
is an atomic compare-and-set operation, replayed or revoked values fail closed,
session refresh uses a revocation compare-and-set, and PostgreSQL RLS applies
tenant/customer scope to portal reads and the contract-signing write. Customer
signatures record `actorUserId = null` plus explicit customer-portal attribution
and reported client metadata. The existing authenticated `/portal/*` staff
preview and ADR-007 legal-signature boundary remain unchanged.

## Implementation evidence

- Implementation PR: [#402](https://github.com/404TradeOS-LLC/TradeOS/pull/402)
- Final implementation head before squash merge: `6977349f04af9a7f0594416203e1bdf179045e83`
- Squash merge commit on `origin/main`: `9adb89e59e259adda037c9851657d0ea9f337a74`
- Post-merge reconciliation confirmed the merge commit is an ancestor of
  `origin/main` and the route, service, migration, and documentation changes
  are present on the default branch.

## Verification evidence

- Hosted Verify repository run #1766 passed app typecheck, app unit tests, app
  build/dependency audit, hosted PostgreSQL integration and migration
  rehearsal, web tests/lint/build, and Athena checks.
- Hosted migration safety #87, dependency review #636, docs consistency #1745,
  live documentation reconciliation #305, sprint governance #277, and branch
  currency #377 passed.
- Focused local portal service and migration tests: 11 passed.
- Local app test suite before publication repair: 225 suites / 1,955 tests
  passed; app lint and build passed. Local web suite: 148 tests passed; web
  lint and build passed.
- Hosted PostgreSQL coverage exercises customer/tenant read isolation, exact
  contract targeting, customer-originated signing attribution, and the
  activity/contract event write boundary under forced RLS.

## Scope and security boundary

- The portal identity is a verified customer identity for scoped portal access,
  not a staff role, password account, or certificate-backed identity.
- Portal sessions cannot reach staff API routes, another customer's project,
  another tenant, draft customer documents, or arbitrary contract mutations.
- Link issuance and revocation remain staff operations protected by the
  existing `documents.manage` permission and a dedicated rate limiter.
- No production data, deployment credentials, email provider configuration, or
  customer-facing beta claim was introduced by this merge.

## External verification limitation

An authenticated rendered-browser run against an approved non-production URL
was not available in this execution environment. The repository and hosted CI
evidence above are complete; deployment configuration, sanitized tenant
fixtures, and browser artifacts remain operational follow-up before claiming
the broader product beta gate.
