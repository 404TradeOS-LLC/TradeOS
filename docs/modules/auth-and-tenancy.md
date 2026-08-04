---
status: current
owner: platform
last_verified: 2026-08-04
source_of_truth: false
related_code:
  - app/backend/middleware/auth.ts
  - app/backend/middleware/databaseSession.ts
  - app/db/requestSession.ts
  - app/modules/auth/service.ts
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

## Deferred work

- further credential hardening beyond the current auth and refresh flow

## Last verified date

2026-08-04
