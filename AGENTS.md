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
