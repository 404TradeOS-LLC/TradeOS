# TradeOS Backend API

Express + TypeScript backend for the TradeOS RC1 platform.

For current product and implementation truth, start with:

- [../docs/CURRENT_STATE.md](../docs/CURRENT_STATE.md)
- [../docs/API_REFERENCE.md](../docs/API_REFERENCE.md)
- [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
- [../docs/modules/](../docs/modules/)

## Project Structure

```text
backend/
  server.ts              Express app setup, route mounting, middleware
  start.ts               long-lived process entrypoint
  routes/                one router per route group
  controllers/           Zod validation and HTTP response shaping
  middleware/            auth, RLS session, rate limiting, error handling
  views/                 lightweight internal admin HTML views
db/
  client.ts              Prisma client with request transaction routing
  requestSession.ts      async-local transaction and PostgreSQL session values
  seed/seed.ts           sample data seed script
modules/
  */service.ts           business services, independent of Express
  */types.ts             module contracts
prisma/
  schema.prisma          ORM schema
  migrations/            tracked migration history, including raw SQL for RLS
scripts/
  deploy-migrations.sh   production rollout and app-role provisioning
  test-integration-db.sh disposable PostgreSQL integration harness
tests/                   Jest unit and live RLS integration tests
```

Services take `orgId` explicitly and do not depend on Express request objects. Controllers own HTTP validation and call services.

## Prerequisites

- Node.js 20+
- PostgreSQL or Supabase connection strings
- `psql` on `PATH` for migration deployment and live integration tests
- Docker for `npm run test:integration`

On macOS via Homebrew, `psql` is installed with `brew install libpq`; add `$(brew --prefix libpq)/bin` to `PATH`.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` with `DATABASE_URL`, `DATABASE_ADMIN_URL`, `APP_DB_ROLE_PASSWORD`, `AUTH_JWT_SECRET`, and any optional scheduler/provisioning settings needed for local work.

## Migrations

`prisma/migrations/` is the authoritative tracked migration history. RLS policies and helper functions that Prisma cannot express are committed as raw SQL inside migration folders.

Apply migrations and provision the restricted application role through an elevated connection:

```bash
npm run db:deploy
npm run prisma:generate
```

Provision only the application role, for example during password rotation:

```bash
npm run db:provision-role
```

Local schema iteration can use:

```bash
npm run prisma:migrate
```

Forced RLS applies even to table owners, so request-session code and RLS migrations must be deployed together for new protected tables.

## Seeding

```bash
npm run db:seed
```

The seed creates a sample organization and enough customer/project/costbook data to exercise the estimate-to-document workflow locally. Seeded backend users and memberships are not proof that hosted web-login credentials are ready.

## Running The API

```bash
npm run dev
# or
npm run build && npm start
```

The API listens on `http://localhost:4000` by default. Health check:

```bash
curl localhost:4000/health
```

All `/api/v1/*` routes run through bearer-token auth except explicitly public auth and platform-provisioning routes. Request-controlled tenant headers cannot impersonate another organization. Authenticated requests run inside a Prisma transaction with transaction-local PostgreSQL settings:

- `app.user_id`
- `app.org_id`
- `app.role`
- `app.session_source`

Background workers should use `runWithBackgroundDatabaseSession` so RLS boundaries match HTTP requests.

## Core Local Loop

Protected route examples require a bearer token:

```bash
curl -X POST localhost:4000/api/v1/estimates \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"projectId": "<projectId>", "overheadPct": 10}'

curl -X POST localhost:4000/api/v1/estimates/<estimateId>/line-items \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"costItemId": "<costItemId>", "quantity": 25}'

curl -X POST localhost:4000/api/v1/proposals/preview/<estimateId> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{}'

curl localhost:4000/api/v1/proposals/<proposalId>/pdf \
  -H "Authorization: Bearer <token>" \
  -o proposal.pdf
```

See [../docs/API_REFERENCE.md](../docs/API_REFERENCE.md) for mounted route groups.

## Structured AI Estimating

The backend exposes a review-first structured estimating path for contractor-language scopes:

```text
POST /api/v1/estimates/<estimateId>/ai-estimator/draft
POST /api/v1/estimates/<estimateId>/ai-estimator/apply
```

Draft generation parses scope text, uses the read-only Knowledge Runtime for candidate matches, resolves candidates to existing org-scoped cost items or assemblies, and retrieves pricing through existing costbook services.

Apply accepts only reviewed line items with matching server-signed review tokens, validates accepted targets server-side, serializes concurrent apply requests per estimate, and writes through `EstimateEngineService.addLineItem`. Generated output never writes estimate lines directly to Prisma.

Current limitation: the active web assist surface still uses the older reviewable `/ai-suggestions` contract, so structured estimator frontend integration is partial.

## Supplier Integration

Supplier records and supplier price-update review queues are implemented. Supplier-fed price changes are staged for review rather than applied automatically.

The actual live feed fetcher is still a stub returning no quotes. Operators can configure either the in-process scheduler or an external cron path using `SUPPLIER_PRICE_SYNC_JOBS`, but each target must be listed explicitly with org, user, and supplier IDs.

## Testing

```bash
npm test
npm run test:integration
npm run lint
npm run build
```

`npm run test:integration` recreates a disposable PostgreSQL Docker container, applies tracked Prisma migrations through `scripts/deploy-migrations.sh`, creates a restricted non-superuser application role, and proves RLS behavior against the live database.

Repository CI mirrors the backend verification path in [../.github/workflows/verify-repository.yml](../.github/workflows/verify-repository.yml).

## Not Yet Implemented Or Not Proven

- Live supplier feed ingestion.
- Public payment processing or subscription billing.
- Accounting, payroll, inventory, route-optimization, and fleet integrations.
- Production topology, backup/restore rehearsal, hosted preview health, environment approvals, and GitHub ruleset state. These require live external verification.
- Full unification of Brand Studio document frame rendering across proposal, contract, invoice, and portal documents.
