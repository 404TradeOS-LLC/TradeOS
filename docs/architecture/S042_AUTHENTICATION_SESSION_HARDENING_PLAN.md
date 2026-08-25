---
status: ready
owner: platform
last_verified: 2026-08-25
source_of_truth: true
related_docs:
  - docs/SPRINT_BACKLOG.md
  - docs/modules/auth-and-tenancy.md
  - docs/API_REFERENCE.md
  - docs/RBAC_MATRIX.md
  - docs/ARCHITECTURE.md
related_code:
  - app/backend/auth/jwt.ts
  - app/backend/auth/session.ts
  - app/backend/middleware/auth.ts
  - app/backend/routes/auth.routes.ts
  - app/modules/auth/service.ts
  - web/src/app/actions/auth.ts
  - web/src/lib/session.ts

# S042 — Authentication/session hardening

## Objective

Verify and narrowly harden the existing local API and Supabase-backed web
authentication/session boundary so session creation, refresh, revocation,
expiry, and server-action enforcement fail closed across API and web paths.

## Approved bounded policy

- Refresh-token rotation is single-use under concurrency: exactly one
  concurrent refresh of one token may succeed.
- Local refresh sessions are revoked on local logout, password reset, and
  account deactivation.
- Existing finite-lifetime access JWTs remain stateless; no session-version
  column or new token architecture is introduced. A captured access JWT may
  remain usable until its existing expiry.
- Supabase JWT verification requires finite `exp` and `iat` claims in addition
  to the existing signature, issuer, and audience checks.
- Web server actions verify the server-side session before storage or API side
  effects and fail closed on missing/expired sessions.

## Dependencies and invariants

S018 is DONE. Preserve the existing Supabase provider, local token tables,
route shapes, role and permission vocabulary, organization-membership lookup,
request-scoped database sessions, forced RLS, audit attribution, and current
API error semantics except for the narrowly required 401 failure paths.

## Allowed scope

- Existing files under `app/backend/auth/**`, auth middleware/controllers/routes,
  and `app/modules/auth/**`.
- Existing web session, Supabase server/proxy, and authentication server-action
  files.
- Focused auth, JWT, server-action, and PostgreSQL/RLS tests.
- Required owner documentation and completion evidence.

## Explicit non-goals

No Prisma schema or migration, RLS-policy redesign, new role or permission,
authentication-provider replacement, new token persistence model, broad
authorization refactor, production secret/data/deployment change, S027 browser
evidence, S043+ work, or unrelated UI/billing/payment change.

## Required acceptance evidence

1. Invalid credentials, inactive users, missing memberships, malformed/forged/
   expired/issuer-mismatched/audience-mismatched tokens fail before protected
   database authorization.
2. Refresh rotation preserves active identity and tenant membership, rejects
   revoked/expired/inactive-user/inactive-membership tokens, and has a
   concurrent exactly-one-success regression test.
3. Logout, password reset, and account deactivation revoke local refresh
   sessions; old refresh tokens fail closed. Existing access JWT expiry remains
   explicit and documented.
4. Supabase token verification rejects missing or malformed finite `exp`/`iat`.
5. Server actions verify the server-side Supabase session before side effects,
   never trust client identity/role/org fields, and fail closed on bootstrap or
   logout errors.
6. Same-organization behavior, cross-organization denial, forced RLS, and
   actor attribution remain intact.

## Required validation

`git diff --check`; `npm run pr:preflight -- --base origin/main`; `npm run
pr:test`; `npm run docs:test`; `npm run docs:check -- --base origin/main`;
`cd app && npm test && npm run lint && npm run build && npm run test:integration`;
and `cd web && npm test && npm run lint && npm run build`.

Production Supabase/Vercel configuration and authenticated browser evidence are
external evidence boundaries. They must be recorded as unavailable rather than
claimed.
