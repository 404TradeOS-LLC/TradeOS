---
status: current
owner: platform
last_verified: 2026-08-24
source_of_truth: false
related_code:
  - app/backend/middleware/auth.ts
  - app/backend/middleware/databaseSession.ts
  - app/backend/auth/jwt.ts
  - app/backend/auth/session.ts
  - app/db/requestSession.ts
  - app/backend/routes/projects.routes.ts
  - app/backend/routes/proposals.routes.ts
  - app/backend/routes/contracts.routes.ts
  - app/backend/routes/invoices.routes.ts
  - web/src/proxy.ts
  - web/src/lib/supabase/proxy.ts
  - web/src/lib/session.ts
  - web/src/app/(app)/portal
---

# S018 — Customer Portal Authentication Hardening

## Shipped outcome

S018 is complete. Implementation PR #290 merged on 2026-08-24 as
`6f2dd254c121855fa629d19da6bc0452cc9e6de7`; completion-evidence PR #292
records the exact-head verification. The shipped slice preserves
the existing authenticated Supabase session, bearer-authenticated API,
membership resolution, request-scoped database session, forced PostgreSQL RLS,
route/API shapes, and existing permissions.

The implementation adds finite expiry and strict claim validation for locally
issued HS256 access tokens, fail-closed malformed/expired/invalid bearer
handling, and inactive-user denial in refresh/bootstrap flows. Focused HTTP
regressions and PostgreSQL/RLS integration assertions cover missing/inactive
membership, same-organization project/proposal/contract/invoice access,
cross-organization direct-ID denial, and forced-RLS metadata. No new customer
identity, portal token persistence, public link, auth-provider replacement,
RBAC/RLS redesign, schema migration, billing behavior, or portal redesign
shipped.

Exact-head Verify repository #1332, Docs consistency #1229, Dependency review
#296, PR branch currency #15, Live documentation reconciliation #14, and Sprint
governance #14 passed.

## Readiness decision

S018 is promoted from `PLANNED` to `READY` after live reconciliation on
2026-08-24. Dependencies S007, S009, S010, and S011 are merged and recorded as
`DONE`. No open or draft S018 implementation or readiness PR, remote S018
branch, or active worktree overlap was found.

## Runtime inventory and material finding

The portal currently consists of authenticated web routes for project,
proposal, contract, and invoice views. `web/src/proxy.ts` applies the existing
Supabase session refresh to `/portal/:path*`; the pages obtain the server-side
session token and call the existing API client. The backend accepts only a
verified bearer token on protected `/api/v1/*` routes, resolves the active
database-backed organization membership, and establishes the request-scoped
forced-RLS session before route handlers run.

There is no separate customer portal token, customer identity, or public
portal authorization boundary in the current runtime. The portal is presently
an authenticated application surface using the internal staff session and
existing resource authorization. This is an implementation finding, not
authorization to invent a new customer-auth product under S018.

## Authorized implementation contract

S018 may harden and prove the established boundary by:

1. denying unauthenticated, malformed, expired, revoked, or otherwise invalid
   portal/API sessions and failing closed when active application membership is
   absent;
2. verifying that portal resource reads and mutations use the authenticated
   identity and active organization, never a client-selected organization ID;
3. proving cross-organization access denial for project, proposal, contract,
   invoice, and related document resources through application authorization
   and PostgreSQL RLS;
4. preserving actor, organization, permission, and audit behavior for the
   existing portal actions; and
5. updating only the existing portal/auth implementation or its focused tests
   when fresh runtime evidence shows a concrete defect in this boundary.

The implementation must preserve the current server-side bearer-token
architecture, request-scoped database session, forced RLS, and existing portal
route and API shapes unless a separately approved decision authorizes a change.

## Protected decisions and stop conditions

S018 does not authorize a new customer login or invitation product, a separate
portal token format, a public unauthenticated document-link model, an auth
provider replacement, an RBAC/RLS policy redesign, or a portal UI redesign. If
tenant-safe customer access requires a new identity model or changes the
established authentication/authorization policy, stop and obtain a founder
decision before implementation.

No schema migration is expected. If a migration, new token persistence, or
cross-domain billing/document redesign is required for the bounded behavior,
stop and report the dependency rather than expanding S018.

S018 does not implement S019 proposal workflow hardening, S020 contract signing
hardening, S021 invoice/payment presentation, S022 document rendering, S027
Costbook evidence, or any unrelated security or deployment repair.

## Required implementation evidence

Focused coverage must include invalid and expired auth behavior, missing or
inactive membership denial, same-organization portal access, cross-organization
resource denial, permission boundaries for existing portal mutations, and
forced-RLS isolation in live PostgreSQL. Web session/proxy behavior must be
covered by the existing frontend test/build lanes. The implementation PR must
run `git diff --check`, `npm run pr:preflight -- --base origin/main`,
`npm run pr:test`, `npm run docs:test`,
`npm run docs:check -- --base origin/main`, `(cd app && npm test && npm run
lint && npm run build && npm run test:integration)`, and the applicable web
test/lint/build lanes. Exact-head GitHub Actions and review state are
authoritative.
