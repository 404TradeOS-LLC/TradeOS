---
status: current
owner: platform
last_verified: 2026-08-08
source_of_truth: false
related_code:
  - app/backend/middleware/auth.ts
  - app/backend/middleware/databaseSession.ts
  - app/backend/auth/jwt.ts
  - app/db/requestSession.ts
  - app/modules/auth/service.ts
  - app/modules/auth/types.ts
  - app/backend/controllers/auth.controller.ts
  - app/prisma/migrations/20260804020000_harden_database_security_boundaries/migration.sql
  - app/scripts/sql/provision-app-role.sql
  - app/backend/routes/auth.routes.ts
  - app/backend/routes/account.routes.ts
  - app/backend/routes/organizationProvisioning.routes.ts
  - web/src/app/actions/auth.ts
  - web/src/lib/session.ts
---

# Auth and Tenancy

## Purpose

Authenticate users, resolve organization membership, and establish the RLS-backed tenant session used by all protected API requests.

Protected API requests must derive tenant context from a verified authenticated identity plus an active membership. Request headers are not a tenant-selection mechanism.

Request-scoped and service-level database transactions use the shared async-local Prisma routing in `app/db/requestSession.ts`, keeping RLS settings, advisory locks, and nested service writes inside the same transaction boundary.

## Source code locations

- `app/backend/middleware/auth.ts`
- `app/backend/middleware/databaseSession.ts`
- `app/db/requestSession.ts`
- `app/modules/auth/*`
- `app/backend/routes/auth.routes.ts`
- `app/backend/routes/account.routes.ts`
- `app/backend/routes/organizationProvisioning.routes.ts`

## Core models

- `AppUser`
- `OrganizationMembership`
- `OrganizationInvite`
- `AuthRefreshToken`
- `PasswordResetToken`
- `UserTotpCredential`

## Routes

- `POST /api/v1/platform/organizations`
- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/bootstrap` — links a verified Supabase Auth identity (Bearer token verified via `verifyAnyAuthToken`) to an application `AppUser`/`OrganizationMembership`. Idempotent: if the identity (matched by `authSubject` or `email`) already has an active membership, returns that existing user/organization/role and does not create anything, regardless of what `organizationName` was passed. `organizationName` is required only to provision a brand-new organization for a never-before-seen identity; role is always `owner` for that path and is never taken from the request. Called from `web/src/app/actions/auth.ts` after both `signupAction` (when Supabase returns a session immediately, i.e. email confirmation is disabled) and every `loginAction` (best-effort — this is what actually bootstraps a user who confirmed their email asynchronously and is now logging in for the first time, since no session exists to call bootstrap from at signup time when confirmation is pending).
- `GET /api/v1/account`

## Permissions

See [RBAC_MATRIX.md](../RBAC_MATRIX.md).

Special constraints:

- public auth routes are rate-limited
- organization provisioning uses a separate high-entropy secret
- team invites are currently limited to `dispatcher` and `technician`

## Database security invariants

- `OrganizationInvite`, `AuthRefreshToken`, and `PasswordResetToken` retain their organization/user/token identity across updates, including during transaction-local login lookup; only the lifecycle fields used by invite acceptance, token rotation, and password reset consumption remain mutable
- update policies validate the resulting row rather than using an unconditional `WITH CHECK (true)` expression
- request-context RLS helper functions have fixed empty search paths; helpers that call another application function use schema-qualified references
- `public._prisma_migrations` is administrator-only deployment state and is excluded from runtime application-role privileges after every role-provisioning run

## Frontend surfaces

- `/login`
- `/signup`
- `web/src/app/actions/auth.ts`

`signupAction` passes `emailRedirectTo: ${NEXT_PUBLIC_APP_URL}/login` to Supabase's `signUp()` and stores the typed organization name in Supabase's own user metadata (`options.data.organization_name`) so it survives the signup → email-confirmation → first-login round trip, where no application-side state exists yet to hold it. `NEXT_PUBLIC_APP_URL` must be set to this deployment's real origin in every environment (falls back to `http://localhost:3000` for local dev) — Supabase only honors `emailRedirectTo` when the same URL is also present in that Supabase project's Auth → URL Configuration → Redirect URLs allowlist; setting the env var alone does not change Supabase's own dashboard config, which must be updated separately (see `web/.env.example`).

## Tests

- `app/tests/auth.service.test.ts`
- `app/tests/auth.middleware.test.ts`
- `app/tests/platformProvisioningAuth.test.ts`
- `app/tests/platformProvisioningRateLimit.test.ts`
- `app/tests/rls.integration.ts`
- `app/tests/databaseSecurityHardening.migration.test.ts`

## Known limitations

- legacy roles still normalize at session time
- TOTP exists as stored credential scaffolding but is not the primary documented login path
- `loginAction`'s post-login bootstrap call is best-effort: a login that succeeds but whose bootstrap check fails (e.g. a transient backend error, or — should it ever occur — a confirmed identity whose Supabase user metadata is missing `organization_name`) still redirects to `/dashboard` rather than blocking the login, so a user can in principle reach the dashboard without a completed organization/membership. This was judged the safer failure mode (a returning user is never locked out over an unrelated bootstrap hiccup) but means the dashboard/data layer should not assume every authenticated session has a resolvable organization without checking.
- `app/backend/auth/jwt.ts` verifies Supabase-issued JWTs by dynamically importing `jose` (`await import("jose")`); this project's CommonJS TypeScript build downlevels that into `require("jose")`, so `jose` must stay pinned to a version that ships a CommonJS build (currently `^4.15.9` — `jose` v5+ is ESM-only and throws `ERR_REQUIRE_ESM` at runtime, which is exactly what happened in production before this was caught; see `docs/CURRENT_STATE.md`). `app/tests/jwt.supabase.test.ts` exercises the real `jose` import path end-to-end and will fail the suite if this regresses.

## Deferred work

- further credential hardening beyond the current auth and refresh flow

## Last verified date

2026-08-08
