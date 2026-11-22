---
status: ready
owner: platform
last_verified: 2026-11-22
source_of_truth: true
related_docs:
  - docs/SPRINT_BACKLOG.md
  - docs/decisions/ADR-010-customer-magic-link-portal.md
  - docs/testing/S073_RLS_COVERAGE_MATRIX.json
  - docs/architecture/S073_RLS_COVERAGE_EVIDENCE.md
  - docs/RBAC_MATRIX.md
  - docs/ARCHITECTURE.md
  - docs/REPOSITORY_GOVERNANCE.md
related_code:
  - app/modules/customer-portal/service.ts
  - app/tests/s073.rls.integration.ts
  - web/src/lib/customer-portal-session.ts
---

# S059 — Customer Portal Access and Session Certification Plan

## Outcome

S059 must certify the existing ADR-010 magic-link customer portal on current
`main`: staff issuance, single-use access redemption, customer-scoped session,
revocation, expiry, replay denial, and cross-tenant isolation. Certification
means retained authenticated browser evidence plus negative security evidence
plus current-head PostgreSQL/RLS evidence for the portal identity rows — not a
new customer identity or authorization model.

This sprint is proof work over an implemented contract. It does **not**
authorize broadening customer authorization, weakening RLS, or inventing a
new auth architecture.

## Readiness reconciliation

- Dependency S051 is `DONE` through merged PR #538
  (`49cfb31ce8badf8a3440792e0f9aa7a8a01026db`).
- Current `main` at readiness start is
  `c430fd17d9ec1ba0a1600dc6ff2a0a17306b51d0`.
- Live GitHub overlap rechecked 2026-11-22: zero open PRs; no live S059
  implementation lane. The prior readiness branch
  `origin/docs/s059-readiness-promotion` (PR #619, closed unmerged
  2026-10-04 as superseded) prepared readiness behind the then-READY S053 and
  is stale; this promotion regenerates from current `main` per #619's own
  closing note and that branch is not reused.
- The ADR-010 model is implemented on current `main`:
  `app/modules/customer-portal/service.ts` exposes staff issuance
  (`issueAccessToken`, `documents.manage`, single-use expiring link, raw value
  returned only at issuance, SHA-256 digest persisted); redemption atomically
  consumes the token and creates a short-lived opaque hashed session carrying
  organization/customer scope server-side; the redemption web route fails
  closed on absent, malformed, or expired session payloads, clears the pending
  invitation, and creates no session cookie; public reads verify scope plus
  the requested resource's project/customer relationship; customer-originated
  writes are limited to the narrow pending-contract signing transition.
- S073 (implementation PR #1000, merged 2026-11-21 as `4d8f8a74`) added live
  disposable-PostgreSQL same-org/cross-org evidence for
  `customer_portal_access_tokens` and `customer_portal_sessions`, plus the
  deterministic coverage matrix. Portal request-context repair PR #1001
  merged 2026-11-18 as `6f860f34`.
- What S059 still must prove: current-head authenticated browser evidence
  (staff issuance, customer redemption, portal reads, contract-signing
  transition) at 1440/1024/768/390, negative security evidence (replay,
  expired, revoked, malformed, cross-tenant, cross-customer, unauthenticated,
  wrong-role), and expiry/revocation behavior end to end. Focused service and
  web tests already cover replay, expiry, malformed input, draft exclusion,
  and document-scoping denial paths; browser and live-RLS certification
  remain pending, so S059 is not complete.

## Authoritative scope discovery

The implementation must derive the certification set from current code, not
memory:

1. Start with the S051 `customer-portal` journey in
   `docs/testing/FRONTEND_BACKEND_CONNECTION_MATRIX.json` and the S073 matrix
   rows for `customer_portal_access_tokens` and `customer_portal_sessions`.
2. Trace each current portal route/service action
   (`/api/v1/customer-portal/*`, `app/modules/customer-portal/service.ts`,
   `web/src/lib/customer-portal-session.ts`, `/customer-portal/*` routes) to
   every table it reads or writes when that table participates in tenant or
   customer isolation.
3. Include staff issuance (`documents.manage` authorization, one-time link
   copy), redemption (single-use consumption, session creation, fail-closed
   payload handling), session reads (project/proposal/contract/invoice
   scoping), revocation (customer deletion invalidation, explicit revocation
   where implemented), expiry (token TTL, session TTL), and the narrow
   customer contract-signing transition with attribution.
4. Exclude email delivery of issued links (S074 owns durable delivery; the
   issuance endpoint already returns the link for the delivery layer),
   customer proposal acceptance (S019 owns the authenticated boundary; portal
   proposal review remains read-only), and customer payments (no Pay Now
   exists in the portal); explain every exclusion in the evidence document.

## Required evidence fields

Each certification step must record:

- journey step and owning route/service;
- actor (staff role, customer session, unauthenticated, foreign customer);
- expected outcome (allowed, denied, fail-closed) and observed outcome;
- tenant/customer scope verified (same-org, cross-org, cross-customer);
- token/session state before and after (issued, consumed, expired, revoked);
- retained evidence location (browser capture, test name, integration run);
- bearer-material handling: no raw access token, portal session, cookie,
  header, or bearer material retained in any evidence artifact.

## Implementation scope

Allowed:

- non-production evidence tooling for the bounded S059 browser/security run;
- focused portal browser/security tests and additive disposable-PostgreSQL
  evidence where a current-head gap is found;
- reproduced-defect repair inside the existing ADR-010 contract;
- a human-readable S059 evidence document under `docs/architecture/` or
  `docs/testing/`;
- documentation required by `docs/DOC_OWNERSHIP.yml`.

Forbidden without a separate founder/security decision:

- new customer identity, login, invitation, or magic-link product model;
- public tokenized document links beyond the ADR-010 surface;
- auth-provider replacement or RBAC/RLS policy redesign;
- proposal-acceptance mutation beyond the existing read-only portal review;
- payment implementation or customer Pay Now;
- test-only public TTL override, backdoor, or bearer-material retention;
- production database access, data mutation, or credentials;
- S060/S074+ implementation.

## Expiry evidence boundary

True expiry behavior must be proven without adding a public TTL override or
backdoor. A truly expired access-link browser state may require a controlled
non-production fixture or time-based environment support; backend/PostgreSQL
current-head evidence remains required regardless. If the fixture cannot be
built inside this sprint's allowed scope, record the exact missing
infrastructure as the blocker and stop — do not invent it.

## Gap handling

If browser, negative-security, or live-RLS evidence exposes a real defect in
the portal boundary, S059 must **not** hide the failure by weakening a check
or adding an application filter as a substitute for the database boundary.
Record a blocking `GAP` with the exact failing test and owner, and stop
policy/migration repair at a reviewable security boundary. Any RLS-policy,
migration, role/permission, authentication, portal-principal, or production
database change requires a separate protected decision/PR under repository
governance.

## Acceptance

S059 is complete only when:

1. staff issuance, single-use redemption, customer-scoped session, revocation,
   expiry, replay denial, and cross-tenant isolation each have retained
   current-head evidence;
2. authenticated browser evidence covers the portal journeys at
   1440/1024/768/390 with truthful loading/error/empty states;
3. negative security evidence covers replay, expired, revoked, malformed,
   cross-tenant, cross-customer, unauthenticated, and wrong-role attempts;
4. live PostgreSQL/RLS evidence for the portal identity rows is current-head
   (S073 evidence re-verified or extended where the sprint touches it);
5. no raw access token, portal session, cookie, header, or bearer material is
   retained in any evidence artifact;
6. any gap has explicit blocking test ownership instead of being silently
   waived;
7. repository-required App integration, App unit/build/typecheck, Web
   unit/lint/build where touched, docs, dependency, governance, and
   branch-currency checks pass on the exact PR head.

## Verification commands

```text
git diff --check
npm run pr:preflight -- --base origin/main
npm run pr:test
npm run docs:test
npm run docs:check -- --base origin/main
cd app && npm test
cd app && npm run lint
cd app && npm run build
cd app && npm run test:integration
```

Web runtime changes are not planned beyond evidence tooling. If
implementation unexpectedly touches `web/**` product surfaces, run the full
Web test/lint/build lane and stop to reconcile scope.

## Founder decision and merge boundary

Founder decision: **NO** for the bounded certification of the existing
ADR-010 magic-link/session model described above.

Founder/security decision: **YES** before any new customer identity or
authorization model, RLS-policy, migration, role/permission, authentication,
portal-principal, or production database change. In that case preserve the
failing evidence and stop before the protected change.

S054's separate portal decision and S074's durable-delivery work are not
dependencies of S059 and are not decided by this promotion.

## Next five implementation tasks

1. Reconcile the S051 customer-portal journey, S073 matrix rows, and current
   route/service code into the exact certification step list.
2. Build the bounded non-production evidence run (staff issuance, redemption,
   portal reads, contract-signing transition) at all four widths.
3. Capture negative security evidence for replay, expiry, revocation,
   malformed, cross-tenant, cross-customer, unauthenticated, and wrong-role
   attempts with redaction-safe artifacts.
4. Re-verify current-head live PostgreSQL/RLS evidence for the portal
   identity rows and extend it only where the sprint exposes a gap.
5. Record the retained evidence document, run exact-head checks, and merge
   only if no gap requires a protected policy/migration change.
