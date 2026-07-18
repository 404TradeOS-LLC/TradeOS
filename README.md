# TradeOS

TradeOS is a project-centered construction workflow platform for trade contractors.

The current repository supports the operational path from customer and project creation through job creation, technician assignment, scheduling, dispatcher coordination, field execution, invoicing, and closeout preparation.

## RC1 status

TradeOS is in Release Candidate 1 hardening.

The focus is no longer feature chasing. Current work is centered on:

- production readiness
- stability
- UX polish
- deployment confidence
- release documentation

Start here for current implementation truth:

- [docs/README.md](docs/README.md)
- [docs/TRADEOS_BIBLE.md](docs/TRADEOS_BIBLE.md)
- [docs/ENGINEERING_COMMAND_CENTER.md](docs/ENGINEERING_COMMAND_CENTER.md)
- [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md)
- [docs/SPRINT_BACKLOG.md](docs/SPRINT_BACKLOG.md)
- [docs/SESSION_HANDOFF.md](docs/SESSION_HANDOFF.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)
- [docs/REPOSITORY_GOVERNANCE.md](docs/REPOSITORY_GOVERNANCE.md)

## Applications

### `app/`

Express + TypeScript backend API with:

- bearer-token auth
- organization membership checks
- forced PostgreSQL row-level security
- Prisma migrations and deployment scripts
- proposal, contract, invoice, change-order, task, intake, jobs, scheduling, dispatcher, and knowledge-runtime modules

See:

- [app/README.md](app/README.md)

### `web/`

Next.js 16 frontend with:

- authenticated app shell
- customer and project workflows
- project workspace
- job creation, assignment, scheduling, and field-status coordination through project workspace surfaces
- estimate builder and AI estimate assist
- proposal, contract, and invoice screens
- customer portal document views

See:

- [web/README.md](web/README.md)

## Repository structure

```text
.github/workflows/                 repository verification, migration rollout, and docs governance workflows
docs/                              source-of-truth docs, module docs, ADRs, agent contracts, archive
app/                               backend API, Prisma schema/migrations, tests, deployment scripts
web/                               Next.js frontend
packages/knowledge-engine/         knowledge-runtime source and archive material
scripts/                           documentation consistency tooling
```

## Documentation governance

Implementation truth lives under [docs/README.md](docs/README.md).

- Use the canonical docs in `docs/` and `docs/modules/` for current-state decisions.
- Treat `docs/archive/` as historical context only.
- Run `npm run docs:check` when a change affects documented behavior.
- Use [docs/REPOSITORY_GOVERNANCE.md](docs/REPOSITORY_GOVERNANCE.md) for protected-branch policy, required checks, and worktree lifecycle.

## Core workflow currently supported

TradeOS currently connects:

- customer records
- project creation
- customer -> project -> job coordination
- site visit intake
- estimate creation, duplication, comparison, and AI-assisted review
- proposal drafting and lifecycle
- contract generation and signature flow
- job creation and assignment
- scheduling, rescheduling, and calendar coordination
- dispatcher workflows for technician assignment and job-status coordination
- field-work coordination through operational job states
- invoice issue and payment-state workflow
- change orders
- project tasks
- closeout and warranty-supporting record organization

## Deployment and verification

Deployment guidance:

- [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)

Main verification commands:

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

GitHub Actions mirrors this baseline automatically:

- `.github/workflows/verify-repository.yml` runs app lint, unit tests, build, integration, plus web lint and build
- `.github/workflows/deploy-migrations.yml` handles production migration rollout
- `.github/workflows/docs-consistency.yml` enforces required documentation updates on pull requests

## Scope guardrails

During RC1, do not treat this repository as a greenfield redesign.

The intended direction is:

- preserve working architecture
- preserve APIs
- preserve database compatibility
- finish and harden what already exists

The following exclusions do not remove the existing Jobs, Scheduling, and Dispatcher product surface; they limit only advanced optimization and adjacent enterprise systems.

The following remain intentionally out of scope unless priorities change:

- advanced dispatch optimization and route planning
- payroll or accounting integrations
- inventory systems
- broad architecture rewrites
- speculative platform abstractions
