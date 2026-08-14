---
status: current
owner: platform
last_verified: 2026-08-14
source_of_truth: false
related_code:
  - app/backend/middleware/auth.ts
  - app/backend/middleware/databaseSession.ts
  - app/backend/middleware/productionHardening.ts
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
  - web/src/app/finish-setup/page.tsx
  - web/src/app/finish-setup/finish-setup-form.tsx
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
- `POST /api/v1/auth/bootstrap` — links a verified Supabase Auth identity (Bearer token verified via `verifyAnyAuthToken`) to an application `AppUser`/`OrganizationMembership`. Idempotent: if the identity (matched by `authSubject` or `email`) already has an active membership, returns that existing user/organization/role and does not create anything, regardless of what `organizationName` was passed. `organizationName` is required only to provision a brand-new organization for a never-before-seen identity; role is always `owner` for that path and is never taken from the request — when it's missing, the response is a `400` with `details: { code: "organization_name_required" }` (a stable, machine-readable discriminator; the response's `error` message text is UI copy, not a contract). Called from `web/src/app/actions/auth.ts` after `signupAction` (when Supabase returns a session immediately, i.e. email confirmation is disabled), every `loginAction`, and `finishSetupAction` (see "Finish-setup recovery flow" below).
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
- any lookup of a user/membership/organization performed *before* an authenticated request-scoped session exists (i.e. before `app.org_id` can be set) must explicitly set `app.login_lookup`, then `app.user_id` once the user is known, then `app.org_id` once their membership is known — in that order, each inside the same transaction — to satisfy `users_login_lookup_policy`, `memberships_login_lookup_policy`, and `organizations_select_policy`. `AuthService.login()`, `.refresh()`, `.requestPasswordReset()`, `.resetPassword()`, and `.acceptInvite()` all follow this three-step pattern. `bootstrapSupabaseIdentity`'s existing-user lookup did not (a single un-flagged `basePrisma.appUser.findFirst` with a nested `include`) until a production incident surfaced it — see Known Limitations below and `docs/CURRENT_STATE.md`.
- Athena approval and audit persistence uses the same request-scoped session
  mechanism. Approval submission inherits the caller's tenant/actor identity;
  review actions are then narrowed further by API role checks and by
  `athena_approvals` RLS updates that restrict row mutation to
  `owner`/`admin`/`dispatcher`.

## Frontend surfaces

- `/login`
- `/signup`
- `/finish-setup`
- `web/src/app/actions/auth.ts`

`signupAction` passes `emailRedirectTo: ${NEXT_PUBLIC_APP_URL}/login` to Supabase's `signUp()` and stores the typed organization name in Supabase's own user metadata (`options.data.organization_name`) so it survives the signup → email-confirmation → first-login round trip, where no application-side state exists yet to hold it. `NEXT_PUBLIC_APP_URL` must be set to this deployment's real origin in every environment (falls back to `http://localhost:3000` for local dev) — Supabase only honors `emailRedirectTo` when the same URL is also present in that Supabase project's Auth → URL Configuration → Redirect URLs allowlist; setting the env var alone does not change Supabase's own dashboard config, which must be updated separately (see `web/.env.example`).

### Finish-setup recovery flow

`loginAction` routes a successful sign-in to one of three outcomes, based on the result of its bootstrap call:

1. **Bootstrap succeeds** (existing membership, or a new one provisioned from `organization_name` metadata) → `redirect("/dashboard")`.
2. **Bootstrap fails with `organization_name_required`** (an authenticated identity with no application membership and no `organization_name` in Supabase user metadata — the state of any account created before `signupAction` started storing that metadata) → `redirect("/finish-setup")`.
3. **Bootstrap fails for any other reason** (transient backend error, network failure, the `409` "user exists but has no active membership" edge case, etc.) → `loginAction` returns `{ error }` and stays on `/login`. It deliberately does **not** fall through to `/dashboard` in this case: every page under `(app)` calls backend endpoints that 403 for an unprovisioned identity, and letting that 403 surface mid-render is what previously crashed into the generic root `error.tsx` boundary in production ("Minified React error #441" — Next.js redacts the real server error message from the client-side error object in production, so the boundary alone can't distinguish this case and route intelligently; preventing the unprovisioned dashboard visit in the first place is the fix).

`/finish-setup` (`web/src/app/finish-setup/page.tsx` + `finish-setup-form.tsx`) is a minimal, session-gated page — not part of the `(app)` route group, since that group's layout renders the full authenticated nav (Customers, Projects, Dispatch, Settings), all of which would 403 for a user who hasn't finished setup. Its only input is `organizationName`; `finishSetupAction`:

- requires an active Supabase session (checked via the session cookie server-side, not a client-supplied token) and redirects unauthenticated callers to `/login` before calling bootstrap at all;
- never reads `role`, `userId`, `organizationId`, or `authSubject` from the submitted form — identity comes exclusively from the verified session, matching every other entry point into `POST /api/v1/auth/bootstrap`;
- calls the same idempotent `bootstrapOrganization` helper `loginAction`/`signupAction` use, so an already-provisioned identity that lands here again (a stale tab, a resubmit after a transient failure) safely no-ops instead of creating a second organization.

The already-orphaned production account (`hello@404tradeos.com`, created before `organization_name` metadata capture existed) is expected to self-heal by completing this flow on its next login — no manual database intervention performed or needed.

## Tests

- `app/tests/auth.service.test.ts`
- `app/tests/auth.middleware.test.ts`
- `app/tests/auth.controller.bootstrap.test.ts` — supertest-level trust-boundary coverage: a bootstrap request body carrying `role`/`userId`/`authSubject`/`organizationId` is rejected (`400`, Zod `.strict()`) before it ever reaches provisioning logic
- `app/tests/trustProxy.test.ts` — proves `TRUST_PROXY=1` resolves `req.ip` from the single innermost `X-Forwarded-For` entry Vercel's edge appends (silencing `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`) without trusting an attacker-prefixed chain
- `app/tests/platformProvisioningAuth.test.ts`
- `app/tests/platformProvisioningRateLimit.test.ts`
- `app/tests/rls.integration.ts` (Docker-backed, live Postgres) — includes `bootstrapSupabaseIdentity finds an already-provisioned identity's real membership against live RLS, not a false 409`, the authoritative regression test for the RLS-context bug described above (a mocked Prisma client can't catch an RLS visibility gap)
- `app/tests/databaseSecurityHardening.migration.test.ts`
- `web/src/app/actions/auth.test.ts` — source-shape pinning (no mock harness exists for Server Actions in `web/`; see the file's own header comment) covering the three-way `loginAction` routing outcome, the `finishSetupAction` auth/trust-boundary guarantees, and the `/finish-setup` page's session gate

## Known limitations

- legacy roles still normalize at session time
- TOTP exists as stored credential scaffolding but is not the primary documented login path
- a truly transient bootstrap failure (e.g. a momentary backend blip) on an *already-provisioned* returning user now surfaces a "please try again" message on `/login` instead of letting them through to `/dashboard` on that one attempt — a deliberate tradeoff versus the previous best-effort behavior, made because the old behavior's failure mode (silently continuing to a dashboard that then itself crashes for an *unprovisioned* user) was the exact production incident this recovery flow fixes, and `loginAction` cannot yet distinguish "already provisioned, just had a hiccup" from "not provisioned at all" without a second network round trip
- `app/backend/auth/jwt.ts` verifies Supabase-issued JWTs by dynamically importing `jose` (`await import("jose")`); this project's CommonJS TypeScript build downlevels that into `require("jose")`, so `jose` must stay pinned to a version that ships a CommonJS build (currently `^4.15.9` — `jose` v5+ is ESM-only and throws `ERR_REQUIRE_ESM` at runtime, which is exactly what happened in production before this was caught; see `docs/CURRENT_STATE.md`). `app/tests/jwt.supabase.test.ts` exercises the real `jose` import path end-to-end and will fail the suite if this regresses.
- `TRUST_PROXY` must be set to `"1"` in Vercel Production and Preview for the backend project (`tradeos-costbook`) — the code has correctly supported this since the repository's initial scaffolding, but the env var itself was never set in Vercel, so production logged `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` on every request (harmless — a warning, not a request failure — but see `app/.env.example` for why the value must be `"1"`, never `"true"`).

## Deferred work

- further credential hardening beyond the current auth and refresh flow

## Last verified date

2026-08-14