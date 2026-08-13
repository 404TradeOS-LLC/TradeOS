---
status: current
owner: platform
last_verified: 2026-08-13
source_of_truth: false
related_code:
  - app/backend/start.ts
  - app/index.ts
  - app/backend/server.ts
  - app/backend/health.ts
  - web/src/lib/api.ts
  - .github/workflows/deploy-migrations.yml
---

# TradeOS Deployment Guide

## Overview

TradeOS deploys as two applications:

- `app/` — Express + TypeScript backend API
- `web/` — Next.js frontend

Production posture for RC1:

- authenticated API access through bearer JWTs
- org-scoped authorization in application code
- forced PostgreSQL row-level security in the database
- tracked Prisma migrations for schema and RLS policy rollout
- request IDs and structured JSON logs on the API

## Deployment model

### Backend

The backend can run in either of these modes:

- long-lived Node process using `app/backend/start.ts`
- serverless deployment using `app/index.ts`

For long-lived deployments, the API can also run the in-process supplier sync scheduler when configured.

For serverless deployments, do not rely on the in-process scheduler. Use the one-shot job runner from external cron or an equivalent platform scheduler.

### Frontend

The frontend is a standard Next.js app that talks to the backend over `BACKEND_API_URL`.

Server components and server actions call the backend directly on the server.
Client components use the same-origin proxy route so bearer tokens stay out of browser JavaScript.

## Required environment variables

### Backend required

- `DATABASE_URL`
  Use the restricted application role, not the admin database user.
- `DATABASE_ADMIN_URL`
  Required for migration rollout and role provisioning.
- `APP_DB_ROLE_PASSWORD`
  Required when provisioning or rotating the restricted database role.
- `AUTH_JWT_SECRET`
  Required for local/self-hosted JWT signing and verification where Supabase JWT settings are not the only auth source.
- `PLATFORM_PROVISIONING_SECRET`
  Required if using first-owner organization provisioning.

### Backend commonly required

- `PORT`
  Defaults to `4000`.
- `TRUST_PROXY`
  Set this when the app is behind a load balancer, ingress, or platform proxy.
- `ENABLE_STRICT_TRANSPORT_SECURITY`
  Set to `true` only when all production traffic is HTTPS.
- `SUPABASE_URL`
- `SUPABASE_JWT_ISSUER`
- `SUPABASE_JWT_JWKS_URL`
- `SUPABASE_JWT_AUDIENCE`
- `AUTH_ISSUER`
- `AUTH_AUDIENCE`
- `RLS_TRANSACTION_TIMEOUT_MS`
- `PLATFORM_PROVISIONING_ALLOWED_IPS`
- `PLATFORM_PROVISIONING_RATE_LIMIT_WINDOW_MS`
- `PLATFORM_PROVISIONING_RATE_LIMIT_MAX`

### Backend optional supplier sync variables

- `SUPPLIER_PRICE_SYNC_CRON_SCHEDULE`
- `SUPPLIER_PRICE_SYNC_JOBS`

If both are set, the long-lived backend process starts the in-process scheduler.
If either is missing, the scheduler stays off.

### Frontend required

- `BACKEND_API_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### Frontend storage-related

- `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET`
- `SUPABASE_STORAGE_BUCKET_PUBLIC`

## Local deployment flow

### Backend

```bash
cd app
npm install
cp .env.example .env
npm run db:deploy
npm run prisma:generate
npm run db:seed
npm run dev
```

### Frontend

```bash
cd web
npm install
cp .env.example .env.local
npm run dev
```

## Production rollout steps

### 1. Prepare secrets

Populate production secrets for:

- database admin connection
- restricted app-role password
- backend runtime database URL
- JWT and Supabase auth configuration
- provisioning secret
- frontend runtime variables

Do not use the admin database connection as `DATABASE_URL`.

### 2. Roll out database changes

From `app/`:

```bash
npm run db:deploy
```

This is the canonical production migration command.
It does two things:

1. runs `prisma migrate deploy` against `DATABASE_ADMIN_URL`
2. reprovisions the restricted app role if `APP_DB_ROLE_PASSWORD` is set

### Migration history reconciliation

If a production schema object already exists because it was created outside Prisma's
recorded migration history, do not rerun that SQL. First verify the live table,
constraints, indexes, forced RLS state, policies, and any related external resource
against the migration file. When the live schema matches exactly, reconcile Prisma's
history only:

```bash
npx prisma migrate resolve --applied <migration_folder_name>
```

For PR #30, production project `kssaceuetdjwfqnbzhly` already contains the
`settings_asset_uploads` table and private `project-files` bucket shape described by
`20260728120000_add_settings_asset_uploads`. The migration file checksum verified for
that release gate is:

```text
0f224dc9c71ac0b61fddb4db02b8afe1789229eebc0beb97094be8bae268a761
```

The approved reconciliation command is:

```bash
npx prisma migrate resolve --applied 20260728120000_add_settings_asset_uploads
```

Run it only with explicit production approval, then run `npx prisma migrate status`
against the same production database before merging application code. PR #30 ships a
one-time manual workflow for this exact case:
`.github/workflows/reconcile-production-migration.yml`. It uses the `production`
GitHub Environment, maps the existing `DATABASE_ADMIN_URL` secret to Prisma's
`DATABASE_URL`, verifies the migration file checksum above, runs only the
`migrate resolve --applied` command, and then prints `migrate status`. It must not be
reused for ordinary migration deployment and must not replace `npm run db:deploy`.

### 3. Build the applications

Backend:

```bash
cd app
npm run build
```

Frontend:

```bash
cd web
npm run build
```

### 4. Deploy the backend

For a long-lived process deployment:

```bash
cd app
npm start
```

For serverless deployment, deploy the project entrypoint that uses `app/index.ts`.

### 5. Deploy the frontend

Deploy the `web/` application with its production environment variables pointed at the deployed backend.

## Proxy and HTTPS guidance

### `TRUST_PROXY`

Set `TRUST_PROXY` when the app is behind:

- a reverse proxy
- a load balancer
- ingress
- a platform runtime that forwards client IP and protocol

Examples:

- `TRUST_PROXY=true`
- `TRUST_PROXY=1`
- `TRUST_PROXY=loopback`

This matters for:

- correct client IP logging
- rate limiting behavior
- provisioning IP allowlists

### HSTS

Set `ENABLE_STRICT_TRANSPORT_SECURITY=true` only when:

- the backend is reachable exclusively over HTTPS
- TLS termination is correctly configured in front of the app

Do not enable HSTS for mixed HTTP/HTTPS or local environments.

## Health checks and observability

### Health endpoint

`GET /health` returns:

- `status`
- `service`
- `version`
- `timestamp`
- `uptimeSeconds`

Use this for basic liveness checks.

### Request IDs

Every API response includes `x-request-id`.

If a caller supplies `x-request-id`, the API preserves it.
Otherwise the backend generates one.

Error responses now also include `requestId` in the JSON body.

### Structured logging

The API emits JSON logs for:

- server startup
- completed requests
- unexpected request failures
- supplier sync scheduler activity

Recommended production behavior:

- ship stdout/stderr to a centralized log sink
- index by `requestId`, `path`, and `statusCode`
- alert on repeated `request.failed` and supplier sync failures

## Supplier sync deployment choices

### Option 1: in-process scheduler

Use this only for long-lived backend processes.

Set:

- `SUPPLIER_PRICE_SYNC_CRON_SCHEDULE`
- `SUPPLIER_PRICE_SYNC_JOBS`

This starts scheduled sync execution inside the API process.

### Option 2: external scheduler

Recommended for serverless or container orchestration environments.

Run:

```bash
cd app
npm run jobs:supplier-price-sync
```

on a platform scheduler such as:

- Kubernetes CronJob
- GitHub Actions scheduled workflow
- ECS scheduled task
- systemd timer
- host cron

The job exits non-zero if any configured target fails, which is better for alerting.

## Security checklist

- `DATABASE_URL` uses the restricted role, not the admin role.
- `DATABASE_ADMIN_URL` is available only to deploy tooling and trusted operators.
- `PLATFORM_PROVISIONING_SECRET` is high entropy and rotated when needed.
- provisioning routes are also protected by network controls.
- `TRUST_PROXY` is set correctly for the deployment topology.
- HSTS is enabled only on fully HTTPS production deployments.
- JWT and Supabase auth settings match the active environment.

## Verification checklist after deploy

### Backend

1. `GET /health` returns `200` (liveness).
2. `GET /ready` returns `200` with `status: "ready"` (database-aware readiness; see `docs/PRODUCTION_HEALTH.md`).
3. signup/login or a known authenticated route succeeds.
4. one authenticated read route and one authenticated write route succeed.
5. a forced-RLS cross-org access attempt is denied.
6. logs include request IDs and structured request completion entries.

### Frontend

1. login loads and submits successfully.
2. dashboard renders with authenticated data.
3. customer and project pages resolve without backend proxy errors.
4. a PDF download route works.
5. project workspace renders photos/documents according to storage bucket visibility rules.

## Rollback guidance

### Application rollback

If a backend or frontend deploy is unhealthy but the database schema is still compatible:

1. roll back the application artifact
2. keep the database at the current migration level
3. verify health, auth, and key read/write routes

### Migration rollback

Prefer roll-forward over destructive rollback.

Because migrations include RLS and privilege-related DDL, rollback should be treated carefully:

1. stop new deploys
2. assess whether the failure is application-only or schema-related
3. if schema changes must be reversed, create a corrective forward migration where possible
4. avoid manual destructive changes outside tracked migrations unless incident response absolutely requires it

## RC1 known operational risks

- Supplier sync infrastructure is real, but live supplier feed ingestion is still not production-complete unless a real connector is added.
- Provisioning IP allowlists depend on correct proxy configuration and should not be the only network protection.
- `/health` is a dependency-free liveness probe; `/ready` is the database-aware readiness probe. See `docs/PRODUCTION_HEALTH.md` for the full contract and repair-agent triage order.

## Pre-release command checklist

Backend:

```bash
cd app
npm test
npm run test:integration
npm run lint
npm run build
```

Frontend:

```bash
cd web
npm run lint
npm run build
```

RC1 should not be considered deployment-ready until these commands pass in the release candidate environment.
