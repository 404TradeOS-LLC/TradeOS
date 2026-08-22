---
status: current
owner: platform
last_verified: 2026-08-09
source_of_truth: true
related_code:
  - app/backend/server.ts
  - app/backend/middleware/auth.ts
  - app/backend/middleware/databaseSession.ts
  - app/db/requestSession.ts
  - app/prisma/schema.prisma
  - app/prisma/migrations/20260703090000_add_search_trgm_indexes/migration.sql
  - web/src/lib/api.ts
  - web/src/lib/clientApi.ts
  - web/src/app/actions/auth.ts
  - web/src/app/api/proxy/[...path]/route.ts
  - web/src/app/api/documents/[...path]/route.ts
  - packages/knowledge-engine/
---

# Architecture

## Repository layout

TradeOS is one first-party product monorepo. Its current implemented runtime has two deployable applications and one existing supporting knowledge package:

- `app/` for the Express and TypeScript API
- `web/` for the Next.js 16 frontend
- `packages/knowledge-engine/` for read-only knowledge/runtime assets

The active product flow is shared across `app/` and `web/`; it is not a set of isolated sub-applications.

The monorepo also reserves `packages/athena/` as the canonical location for the reusable Athena AI/orchestration foundation when that package is introduced through bounded implementation work. This is a target ownership boundary, not a statement that existing production code has already moved there.

Athena owns foundation-level AI concerns: kernel, tool registry, context engine, router, action framework, shared AI interfaces/contracts, capability registration, and orchestration policy. Athena must remain domain-agnostic. Costbook, Estimator, Dispatcher, CRM, Field Tech, Office Manager, and other domain implementations retain their business rules and expose capabilities to Athena through explicit contracts or tool registration.

Do not split first-party TradeOS capabilities into separate repositories merely to create agent or project isolation. Codex projects, threads, and agent missions are working-context boundaries; they should operate from the monorepo root so repository-wide dependencies, tests, governance, and documentation remain visible.

Do not move existing production code solely to make the repository resemble the target package layout during RC1 hardening. `packages/costbook/` may be introduced later only if a demonstrated reusable cross-application Costbook boundary exists.

The governing decision is recorded in `docs/decisions/ADR-005-athena-monorepo-platform-boundary.md`.

## Backend and frontend boundaries

Backend responsibilities:

- authenticate and authorize requests
- establish the tenant-scoped database session
- own HTTP contracts and business services
- enforce lifecycle and permission rules
- generate binary document responses

Frontend responsibilities:

- render the authenticated workspace
- use server components and server actions for most reads and writes
- use the browser proxy only for interactive client-side mutations
- keep bearer tokens out of browser JavaScript

## Tenancy and data architecture

Every authenticated API request depends on three layers:

1. bearer JWT verification
2. organization-membership authorization
3. forced PostgreSQL row-level security inside a scoped database session

The organization context comes from the verified identity and the matching active membership, not from request-controlled tenant headers.

The request-scoped database session sets:

- `app.user_id`
- `app.org_id`
- `app.role`
- `app.session_source`

The backend establishes those values in `app/db/requestSession.ts` through a Prisma transaction opened by `app/backend/middleware/databaseSession.ts`.
That transaction keeps separate bounded acquisition and execution timers. The
15-second default acquisition wait accommodates parallel authenticated loaders
when a serverless instance intentionally limits Prisma to one connection; it
does not enlarge the database pool or weaken the RLS transaction boundary.
Service-level transactions opened through `runInDatabaseTransaction` also bind the active Prisma transaction to the same async-local routing, so nested service calls and advisory-lock flows use one transaction even outside an HTTP request.

Background jobs use the same session model through `runWithBackgroundDatabaseSession`.

Database search-index changes do not alter this tenancy model. The `pg_trgm` extension and the GIN trigram indexes added in migration `20260703090000_add_search_trgm_indexes` operate below the query planner and do not bypass or weaken RLS.

Auth flows that must find a user before any org context exists (login, password reset, invite acceptance, and Supabase identity bootstrap) use a separate, narrower escape hatch instead: an `app.login_lookup` session flag, then `app.user_id` once the user is known, then `app.org_id` once their membership is known — set in that order, inside one transaction. See [modules/auth-and-tenancy.md](modules/auth-and-tenancy.md)'s Database security invariants.

## Service boundaries

Business logic follows the module pattern:

```text
app/modules/<name>/
  service.ts
  types.ts
```

Controllers own request validation and HTTP shaping. Services take `orgId` explicitly and do not depend on Express request objects.

Route groups are mounted centrally in `app/backend/server.ts`.

## Frontend data paths

Preferred frontend paths:

- server components and server actions call `web/src/lib/api.ts`
- interactive client components call `web/src/lib/clientApi.ts` through `web/src/app/api/proxy/[...path]/route.ts`
- binary document downloads stream through `web/src/app/api/documents/[...path]/route.ts`
- `web/src/app/actions/auth.ts`'s `signupAction`/`loginAction`/`finishSetupAction` are the one frontend surface that calls the backend directly via `web/src/lib/api.ts`'s `apiFetch` with a Supabase-issued bearer token, rather than going through the session-cookie-based proxy — this is how the frontend links a Supabase Auth identity to an application organization/membership (`POST /api/v1/auth/bootstrap`). `finishSetupAction` (backing the standalone `/finish-setup` page) is the recovery path `loginAction` redirects to when bootstrap reports an authenticated identity with no organization and no recoverable `organization_name` metadata — see [modules/auth-and-tenancy.md](modules/auth-and-tenancy.md#finish-setup-recovery-flow)

## Source-of-truth contract locations

- Roles and lifecycle labels: `app/domain/contracts.ts`
- API route mounting: `app/backend/server.ts`
- Persistent data model: `app/prisma/schema.prisma`
- Search-index rollout: `app/prisma/migrations/20260703090000_add_search_trgm_indexes/migration.sql`
- Forced-RLS request session behavior: `app/backend/middleware/databaseSession.ts` and `app/db/requestSession.ts`
- Web route surface: `web/src/app/**/page.tsx`
- Athena platform boundary: `docs/decisions/ADR-005-athena-monorepo-platform-boundary.md`

## Athena production-readiness boundary

Athena's current RC1 hardening work remains inside the monorepo runtime rather
than a separate package extraction. The implemented boundary now includes:

- durable approval persistence and review routes under `app/modules/athena-approvals/**` and `app/backend/routes/athena.routes.ts`;
- durable audit persistence under `app/modules/athena-audit/**`;
- operator-facing approval review at `web/src/app/(app)/athena/approvals/page.tsx`;
- first-party context providers for customers, estimates, and costbook, all of
  which still call existing application services instead of reaching Prisma
  directly.

The request-scoped RLS session remains the floor for all of these paths. Athena
review UI and APIs may narrow access further, but they do not bypass the
tenant-scoped database session model documented above.

## Search indexing notes

The repository now requires PostgreSQL `pg_trgm` for substring-search acceleration in the estimating catalog.

Current migration-backed indexes:

- `idx_cost_items_name_trgm` on `cost_items.name`
- `idx_assemblies_name_trgm` on `assemblies.name`
- `idx_materials_name_trgm` on `materials.name`
- `idx_suppliers_name_trgm` on `suppliers.name`

These indexes accelerate the existing Prisma `contains` plus `mode: "insensitive"` pattern that compiles to `ILIKE '%query%'` for name-oriented search behavior.

Current limitation:

- combined name-or-code search in cost items and assemblies may still fall back to a scan-heavy plan because `code` substring matching is not trigram-indexed

Deployment guidance:

- the current migration uses standard `CREATE INDEX`, which is appropriate for the existing tracked migration flow but can take stronger table locks during rollout
- if online index creation becomes necessary for larger production tables, a future migration can switch to `CREATE INDEX CONCURRENTLY` with the usual PostgreSQL migration constraints and extra rollout care

Implementation-specific deep dives belong in module docs and ADRs, not in this file.
