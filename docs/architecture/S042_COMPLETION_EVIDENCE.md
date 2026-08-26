# S042 Completion Evidence — Authentication/session hardening

## Objective

Verify session creation, refresh, revocation, expiry, and server-action enforcement with fail-closed behavior across the API and web server actions.

## Shipped behavior

- Refresh-token rotation is conditional on `revokedAt IS NULL`; concurrent reuse permits exactly one replacement session.
- Authenticated `POST /api/v1/auth/logout` revokes the caller's active local refresh sessions.
- Password-reset confirmation revokes the user's active local refresh sessions.
- Inactive-account authentication revokes local refresh sessions in a committed transaction before returning `403`.
- Supabase JWT verification requires finite `exp` and `iat` claims.
- Project storage server actions reject missing server-side sessions before storage access.
- No schema, migration, provider, role, permission, RLS-policy, or access-token model change was introduced. Captured access JWTs remain valid until their finite expiry by policy.

## Merge evidence

- Readiness PR: #353, merge commit `b63f1a51281e19b64c1bdcbdff4163f954f789e0`.
- Implementation PR: #354, implementation head `3f70aa8804d04a8d90701d23c9173da9892c4b43`, merge commit `8415c913cd0e596e0e2e18e33a8536f7257b6769`.
- Implementation was merged by protected squash merge after required checks completed successfully.

## Verification

- App unit tests: passed in GitHub Verify repository workflow 1608.
- App typecheck/lint/build: passed.
- App integration tests and migration rehearsal: passed.
- Web unit tests, lint, and build: passed.
- Dependency review, Docs consistency, Live documentation reconciliation, Sprint governance, and branch currency: passed.
- Focused regression coverage added for conditional refresh rotation, session revocation, Supabase timestamp claims, and storage-action authentication guards.
- Local app/web test execution was unavailable in the coordinator checkout because dependency directories were absent; GitHub CI is the authoritative runtime evidence.
- `git diff --check` and sprint governance validation passed during the implementation lane.

## Security validation

Adversarial review traced the refresh token from hash lookup through conditional revocation and replacement creation, confirmed request-scoped transaction reuse for logout, confirmed inactive revocation commits before rejection, and required rate limiting on the new logout route. All valid findings were repaired and their review threads resolved before merge.

Tenant isolation, active-membership authorization, forced RLS, immutable token identity, and service-layer write boundaries remain unchanged. No production credentials, data, or browser evidence were used.

## Non-goals and deferred work

- Immediate revocation of already-issued access JWTs remains intentionally out of scope; finite expiry is the boundary.
- Supabase provider replacement, session-version schema, new token persistence, RLS redesign, and role/permission changes remain out of scope.
- S027 authenticated rendered Costbook browser evidence remains independently blocked and is not represented here.
- S043 and later sprints were not started. S043 remains ineligible while its S037 dependency is PLANNED.

## Repository truth after implementation merge

At implementation merge, `origin/main` was `8415c913cd0e596e0e2e18e33a8536f7257b6769`. This evidence document and canonical sprint-status reconciliation are the remaining governed completion lane.
