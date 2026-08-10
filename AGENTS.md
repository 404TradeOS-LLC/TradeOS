# AGENTS.md — TradeOS RC1 Developer Guide

Essential repository-specific engineering guidance for AI agents.

## Canonical execution contract

- `docs/TRADEOS_BIBLE.md` owns doctrine and the source-of-truth hierarchy.
- `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md` owns the sole executable
  [startup](docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md#canonical-startup-flow)
  and
  [completion](docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md#canonical-completion-flow)
  flows for every agent task.
- `docs/REPOSITORY_GOVERNANCE.md` owns branch, worktree, PR-readiness, review,
  merge, and cleanup policy.
- `docs/SPRINT_BACKLOG.md` owns executable sprint state, and
  `docs/SESSION_HANDOFF.md` owns immediate continuity.
- `docs/README.md` is the documentation index; it does not define a competing
  execution flow.

Follow the canonical protocol before using the engineering guidance below.
Supporting checklists and worktree contracts are compatibility or lane-specific
references only. `continue` resumes only the current bounded mission.

## Big picture

Two independent deployables:

- **`app/`** — Express/TypeScript API
- **`web/`** — Next.js 16 frontend

Current operating mode:

- TradeOS is in RC1 hardening
- prioritize production readiness, stability, polish, and documentation
- do not redesign working systems
- do not introduce speculative abstractions

## Monorepo and Athena architecture

This repository is the canonical TradeOS product monorepo. Repository boundaries
and AI-agent working-context boundaries are not the same thing: Athena, Costbook,
Estimator, Dispatcher, Field Tech, Office Manager, and other TradeOS capabilities
may be developed as separate focused workstreams while remaining in this one
repository.

### Repository boundary

Keep TradeOS product code in this repository unless an explicit architecture
decision changes that policy.

Do **not** create separate repositories merely to isolate:

- Athena
- Costbook
- Estimator
- Dispatcher
- Field Tech
- Office Manager
- CRM capabilities
- other first-party TradeOS feature modules

Do **not** create peer top-level source folders named only for product branding,
such as `404TradeOS/`, `TradeOSCostbook/`, or `Athena/`, when the code belongs in
an existing application or package boundary.

### Athena's role

Athena is TradeOS's shared intelligence and orchestration layer. It is one
assistant that gains capabilities through registered tools, context, routing,
and actions. Orchestration should remain internal and invisible to end users.

Athena owns foundation-level concerns such as:

- AI Kernel
- Tool Registry
- Context Engine
- Router
- Action Framework
- shared AI interfaces and contracts
- capability registration contracts
- orchestration policy
- low-risk action execution policy
- durable user-preference interfaces
- third-party tool-registration interfaces when that platform surface is built

Athena must remain domain-agnostic. It coordinates domain capabilities; it does
not become the implementation home for every domain.

Athena must **not** absorb business logic for:

- Costbook
- estimating
- dispatch
- CRM
- customers
- projects
- field-service workflows
- office-management workflows
- invoicing
- proposals
- contracts
- supplier workflows

Those domains expose capabilities to Athena through explicit interfaces and tool
registration.

### Canonical Athena location

When Athena is represented as a reusable workspace package, its canonical home
is:

```text
packages/athena/
```

Preferred internal shape:

```text
packages/athena/
  kernel/
  context/
  router/
  tools/
  actions/
  interfaces/
  tests/
```

The exact internal folder structure may evolve with implementation evidence, but
Athena's ownership boundary must remain stable.

Do **not** move existing production code solely to make the repository resemble
this target layout. RC1 stability takes precedence. Introduce `packages/athena/`
through a bounded architecture/Foundation change with tests and dependency
migration, not a broad cosmetic refactor.

### Feature capability pattern

Feature domains remain independently owned and register capabilities with
Athena rather than embedding their business logic inside Athena.

Conceptually:

```text
Estimator ---------\
Dispatcher ---------+--> Athena contracts / tool registry --> user-facing assistant
Field Tech ---------+
Office Manager -----/
Costbook -----------/
```

A domain capability should define:

1. its input/output contract
2. authorization requirements
3. context requirements
4. side-effect/risk classification
5. execution implementation
6. tests
7. registration with Athena

Athena may choose and orchestrate the capability. The domain remains responsible
for the business rules.

### Costbook placement

Costbook is a TradeOS domain, not a separate repository requirement. Existing
Costbook code should remain in its current application/module boundaries during
RC1 hardening.

If Costbook later requires a reusable cross-application domain package, the
preferred extraction target is:

```text
packages/costbook/
```

Create that package only when there is a real shared-library boundary. Do not
extract code merely for symmetry with Athena.

### Dependency direction

Prefer dependency flow that keeps domain logic independent from orchestration:

```text
apps (app/web)
   |
   +--> domain modules/packages
   |
   +--> Athena integration/adapters

Athena foundation
   |
   +--> shared interfaces/contracts
   |
   X--> must not depend on concrete domain business implementations
```

Avoid circular dependencies between Athena and feature domains. Domain adapters
may depend on Athena contracts to register capabilities; Athena core must not
import concrete Estimator, Dispatcher, Costbook, CRM, or other feature services.

### AI-agent/Codex working scope

AI agents may use focused workstreams such as `Athena`, `Costbook`, `Estimator`,
or `Dispatcher`, but each workstream should operate from the repository root so
it can see dependency and test impact across the monorepo.

A focused task must still respect repository-wide contracts, tests, migrations,
and documentation. Working-context separation is not permission to duplicate
shared infrastructure or create competing implementations.

## Security model

Every authenticated backend request depends on all three of these layers:

1. bearer JWT verification
2. organization-membership authorization
3. forced PostgreSQL row-level security inside a scoped database session

The request-scoped database session sets:

- `app.user_id`
- `app.org_id`
- `app.role`

## Module pattern

Every business module follows:

```text
app/modules/<name>/
  types.ts
  service.ts
```

Rules:

- services take `orgId` explicitly
- services do not depend on Express request objects
- controllers own HTTP and Zod validation

## Active product areas

The repository currently supports:

- customers
- projects
- site visit intake
- jobs and scheduling
- estimate creation, duplication, comparison, and AI assist
- proposals
- contracts
- invoices
- change orders
- project tasks
- supplier review queue
- knowledge runtime

This is now one connected workflow, not a collection of isolated modules.

## Database and migrations

Source of truth:

- `app/prisma/migrations/`

Rules for new tables that need RLS:

- write raw SQL inside the migration when Prisma schema language cannot express the policy
- use `FORCE ROW LEVEL SECURITY`
- parent-owned resources should inherit org scope through joins
- always add a live integration test for new RLS-protected tables

Deploy with:

```bash
cd app
npm run db:deploy
```

## Testing

Backend unit tests:

```bash
cd app
npm test
```

Backend live integration tests:

```bash
cd app
npm run test:integration
```

Important:

- mocked Prisma tests do not prove RLS correctness
- new RLS-backed tables need live integration coverage in `app/tests/rls.integration.ts`

Frontend verification:

```bash
cd web
npm run lint
npm run build
```

Documentation verification:

```bash
npm run docs:check
```

## Production hardening already present

Backend now includes:

- centralized error handling
- request IDs
- structured JSON logging
- security headers
- health endpoint
- auth/provisioning rate limiting
- trust-proxy and HSTS configuration

See:

- `docs/DEPLOYMENT_GUIDE.md`

## Frontend patterns

Preferred data paths:

- server components and server actions use `web/src/lib/api.ts`
- interactive client components use `web/src/lib/clientApi.ts` through `web/src/app/api/proxy/[...path]/route.ts`
- binary documents use `web/src/app/api/documents/[...path]/route.ts`

Guidelines:

- prefer server components unless interactivity requires a client component
- keep page files thin
- reuse existing shared/project/proposal/contract/intake component systems
- do not create parallel UI systems for the same workflow

## Key files

- `app/backend/server.ts` — Express setup and route mounting
- `app/backend/start.ts` — long-lived backend process entrypoint
- `app/index.ts` — serverless backend entrypoint
- `app/backend/middleware/auth.ts` — JWT and membership resolution
- `app/backend/middleware/databaseSession.ts` — request-scoped DB session
- `app/backend/middleware/errorHandler.ts` — API error mapping
- `app/db/requestSession.ts` — async-local Prisma session routing
- `app/tests/rls.integration.ts` — live RLS verification
- `web/src/lib/api.ts` — server-side backend client
- `web/src/app/api/proxy/[...path]/route.ts` — authenticated browser proxy
- `web/src/app/api/documents/[...path]/route.ts` — binary document proxy

## Release posture gotchas

1. **RLS is forced.** App-side filtering is defense in depth, not the primary control.
2. **Do not treat RC1 like a sprint backlog.** Finish and harden before inventing.
3. **Placeholder UX matters.** Contractor-visible unfinished wording is a release issue, not just a copy issue.
4. **Supplier integration is only partially complete.** Queue/review plumbing is real; live feed ingestion is still the question.
5. **Integration tests require `psql` on `PATH`.** If `npm run test:integration` fails during role provisioning, check local tooling before assuming an app regression.
6. **Project workspace is the hub.** Extend current project-centered flows instead of branching into separate subsystems.

## Before commit

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

All should pass, or the failure should be documented as a real blocker.
