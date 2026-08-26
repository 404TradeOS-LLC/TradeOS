---
status: current
owner: platform
last_verified: 2026-08-06
source_of_truth: true
related_docs:
  - docs/TRADEOS_BIBLE.md
  - docs/ARCHITECTURE.md
  - docs/CURRENT_STATE.md
  - docs/DOMAIN_MODEL.md
  - docs/API_REFERENCE.md
  - docs/RBAC_MATRIX.md
  - docs/WORKFLOW_LIFECYCLES.md
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/DOC_OWNERSHIP.yml
  - docs/ENGINEERING_COMMAND_CENTER.md
related_code:
  - app/backend/server.ts
  - app/backend/middleware/auth.ts
  - app/backend/middleware/databaseSession.ts
  - app/backend/middleware/errorHandler.ts
  - app/backend/middleware/productionHardening.ts
  - app/db/requestSession.ts
  - app/domain/contracts.ts
  - app/prisma/schema.prisma
  - web/src/lib/api.ts
  - web/src/lib/clientApi.ts
  - web/src/app/api/proxy/[...path]/route.ts
  - web/src/app/api/documents/[...path]/route.ts
  - packages/knowledge-engine/
---

# TradeOS Bible - Volume 3: Engineering

## Purpose of this volume

This volume defines the engineering doctrine for TradeOS. It is an operating manual for building, reviewing, testing, deploying, and maintaining the product without drifting away from the current repository architecture.

This volume is not a claim that every desired standard is already implemented. Each section distinguishes the current implementation from required standards, planned follow-up, deferred work, and prohibited patterns.

## Evidence vocabulary

- Implemented: present in the repository or documented as current state.
- Required standard: mandatory rule for future work even when not fully automated.
- Planned: expected follow-up already aligned with current roadmap or blockers.
- Deferred: intentionally not part of the current RC1 path.
- Prohibited: patterns agents and engineers must not introduce without an accepted architecture decision.

## 1. Engineering mission

Implemented: TradeOS is in RC1 hardening. The repository already supports customers, projects, site visit intake, cost book, estimating, AI estimate assist, proposals, contracts, invoices, change orders, jobs and scheduling, project tasks, activity, intelligence primitives, Brand Studio, settings, customer portal document views, supplier review plumbing, and Knowledge Runtime integration.

Required standard: engineering work must make the existing operating system more reliable, secure, coherent, and reviewable. The first duty is to protect contractor data, financial correctness, workflow integrity, and human trust.

Planned: lifecycle normalization, customer portal hardening, production environment verification, and governance enforcement remain active RC1 priorities.

Prohibited: do not treat TradeOS as a playground for speculative rewrites, duplicate subsystems, or AI-first architecture that bypasses the product's current service and tenancy model.

## 2. Architecture principles

Implemented: the architecture is documented in `docs/ARCHITECTURE.md` as two deployables, `app/` and `web/`, plus the supporting `packages/knowledge-engine/` package.

Required standard: extend existing auth, tenancy, API, service, lifecycle, document, scheduling, estimating, and knowledge-runtime paths before adding new abstractions.

Planned: architecture changes that alter source-of-truth behavior belong in `docs/decisions/` and must update relevant docs in the same branch.

Prohibited: no second auth stack, second estimate engine, second AI estimator architecture, second document lifecycle, or parallel tenant-selection mechanism.

## 3. Monorepo structure

Implemented: `app/` is the Express and TypeScript API, `web/` is the Next.js 16 frontend, `packages/knowledge-engine/` stores knowledge assets and runtime support files, and `docs/` defines source-of-truth governance.

Required standard: code and documentation must remain organized by deployable and domain. Runtime code must not be changed from docs-only branches unless the mission explicitly allows it.

Planned: documentation may continue to mature into Bible volumes, sprint records, ADRs, module docs, and handoffs without duplicating runtime behavior.

Prohibited: do not move deployable boundaries or package ownership to satisfy a local sprint preference.

## 4. Backend architecture

Implemented: `app/backend/server.ts` mounts route groups under `/api/v1`, applies production hardening middleware, exposes `/health`, keeps public auth and platform provisioning outside protected tenant middleware, then applies `requireAuth` and `databaseSession` for protected routes.

Required standard: controllers own HTTP validation and response shaping; services own domain behavior; services take `orgId` explicitly and must not depend on Express request objects.

Planned: backend hardening continues by reducing lifecycle compatibility shims, expanding live integration coverage where RLS or multi-write behavior changes, and keeping docs current.

Prohibited: do not perform consequential database writes directly in controllers when an existing service owns the behavior.

## 5. Frontend architecture

Implemented: `web/` is a Next.js 16 frontend. Server components and server actions use `web/src/lib/api.ts`; interactive client components use `web/src/lib/clientApi.ts` through `web/src/app/api/proxy/[...path]/route.ts`; binary document downloads use `web/src/app/api/documents/[...path]/route.ts`.

Required standard: keep bearer tokens out of browser JavaScript, keep page files thin, reuse established project, proposal, contract, intake, and shared component systems, and avoid parallel UI systems for the same workflow.

Planned: customer portal and contractor-visible workflow polish remain RC1 hardening work.

Prohibited: do not introduce broad UI redesign, new design-system primitives, or frontend behavior changes from this Volume 3 docs branch.

## 6. Database and tenancy model

Implemented: every authenticated API request depends on bearer JWT verification, active organization-membership authorization, and forced PostgreSQL row-level security inside a scoped database session.

Required standard: tenant identity comes from verified auth and active membership, never request-controlled organization headers or body fields.

Planned: new tables that store tenant data must include migration-backed RLS, ownership relationships, and live integration tests.

Prohibited: no app-side-only tenant filters as the primary isolation boundary.

## 7. RLS philosophy

Implemented: request-scoped database sessions set `app.user_id`, `app.org_id`, `app.role`, and `app.session_source` through `app/db/requestSession.ts`. Background jobs use `runWithBackgroundDatabaseSession`.

Required standard: RLS is the mandatory data isolation floor. App-side filtering is defense in depth, not the source of truth.

Planned: RLS-backed schema changes require live integration coverage in `app/tests/rls.integration.ts` or an equivalent documented live harness.

Prohibited: do not add tenant-owned tables without `FORCE ROW LEVEL SECURITY` and policy coverage.

## 8. Authentication and authorization

Implemented: `requireAuth` verifies bearer tokens, resolves auth context through database-backed organization membership, and passes the result to request-scoped database session middleware.

Required standard: authorization must combine identity, active membership, canonical role normalization, permission checks, resource ownership, and RLS.

Planned: legacy role compatibility values `estimator` and `viewer` should be retired only through a deliberate migration plan.

Prohibited: no tenant impersonation by header, body, query string, or client-selected organization ID.

## 9. API design standards

Implemented: the backend is mounted under `/api/v1`; public routes are limited to auth and platform provisioning; protected routes require bearer auth and tenant session setup.

Required standard: route contracts must be typed, validated, rate-limited where abuse is likely, and documented when behavior changes.

Planned: API docs should keep route groups, auth expectations, and high-risk endpoint behavior aligned with implementation.

Prohibited: do not expose undocumented write endpoints or route groups that bypass centralized middleware.

## 10. Domain-service boundaries

Implemented: the module pattern is `app/modules/<name>/service.ts` plus `types.ts`, with route files in `app/backend/routes`.

Required standard: services own business invariants, lifecycle transitions, and multi-write coordination; controllers translate HTTP input into service calls.

Planned: module docs should remain close to the service behavior they describe.

Prohibited: no copy-pasted domain logic across controllers, server actions, tests, or AI helper code.

## 11. Shared contracts

Implemented: `app/domain/contracts.ts` defines canonical roles, permissions, lifecycle labels, compatibility maps, and status helpers.

Required standard: shared vocabulary must be updated before product surfaces rely on new role, permission, or lifecycle labels.

Planned: lifecycle normalization should reduce compatibility maps after stored values are migrated or intentionally preserved.

Prohibited: no hard-coded alternate role or status vocabularies in module-specific code when a shared contract exists.

## 12. Lifecycle consistency

Implemented: `docs/WORKFLOW_LIFECYCLES.md` documents canonical states for projects, estimates, proposals, contracts, jobs, and invoices, plus compatibility persistence where storage still differs.

Required standard: API responses, UI labels, module docs, customer-facing documents, and shared contracts must present lifecycle states consistently.

Planned: project, proposal, and contract compatibility values remain an RC1 normalization target.

Prohibited: do not invent new lifecycle stages in one surface without updating shared contracts, services, tests, and documentation.

## 13. Error handling

Implemented: `app/backend/middleware/errorHandler.ts` centralizes API errors, Zod validation errors, selected Prisma request errors, request IDs, and generic 500 responses.

Required standard: client-correctable errors should map to clear 4xx responses; unknown failures should log enough context for operators without leaking secrets or foreign tenant data.

Planned: new known Prisma or domain failures may receive explicit mappings after real behavior justifies them.

Prohibited: no scattered controller-level catch blocks that reshape errors inconsistently or leak internal stack traces.

## 14. Validation

Implemented: controllers own Zod validation, while service modules enforce domain rules that cannot be trusted to HTTP shape alone.

Required standard: all external input must be bounded, typed, and validated before service use. High-risk quantities, prompts, file fields, IDs, and accepted-line arrays need explicit maximums.

Planned: validation rules should be expanded alongside new endpoint behavior and covered with controller or service tests.

Prohibited: do not trust client-supplied price, total, organization, authorization, lifecycle, or AI target identity fields.

## 15. Auditability

Implemented: the repository has `ActivityEvent` and activity/intelligence primitives for tenant-scoped event history, plus request IDs and structured request logging.

Required standard: consequential business actions should be attributable to actor, organization, entity, action, timestamp, and relevant counts or outcome summaries.

Planned: audit depth should increase for production-critical flows such as document sends, AI-assisted applies, scheduling changes, and settings/branding mutations.

Prohibited: do not log secrets, bearer tokens, full sensitive prompts, or customer-private content when a safe summary is enough.

## 16. AI system architecture

Implemented: AI Estimate Assist and the structured AI estimator integrate with Knowledge Runtime, cost book, assemblies, and Estimate Engine services. Current structured drafts are review-first and do not call external model APIs in the current implementation.

Required standard: AI may draft, classify, retrieve, rank, and explain, but trusted identity, pricing, tenancy, authorization, and persistence decisions remain server-side.

Planned: future model-provider integration must preserve deterministic retrieval, bounded prompts, provenance, review tokens, auditability, and service-layer writes.

Prohibited: no autonomous AI database writes, no client-controlled target IDs, and no generated text treated as authority.

## 17. Review-first mutation rules

Implemented: structured AI estimator apply uses server-signed review tokens, active target validation, per-estimate apply serialization, duplicate protection through reviewed line source keys, and `EstimateEngineService.addLineItem(...)` writes.

Required standard: any AI-assisted financial, contractual, customer-facing, scheduling, or lifecycle mutation must require explicit human review and a server-verifiable provenance path.

Planned: a full draft-run persistence record remains outside the current implementation and should be added only if it serves audit, replay, or review needs.

Prohibited: do not allow AI output to bypass the estimate engine, document services, scheduling services, permission checks, or lifecycle rules.

## 18. Storage and asset handling

Implemented: Brand Studio, settings, document rendering, and storage helpers exist as part of the current product surface; PR #30 is separately active on brand-asset upload persistence and must not be duplicated here.

Required standard: uploaded assets must be tenant-scoped, type-checked, size-bounded, and referenced through controlled storage paths or signed access patterns.

Planned: document-brand consistency and asset persistence hardening should proceed through their dedicated PRs and sprints.

Prohibited: no public unscoped asset paths, no raw user-provided storage paths trusted as authorization proof, and no changes to PR #30 files from this branch.

## 19. Background jobs and async work

Implemented: background sessions use `runWithBackgroundDatabaseSession`, validating an active user and membership before establishing tenant session variables.

Required standard: async work must preserve tenant scope, actor or system identity, retry behavior, idempotency, and safe failure reporting.

Planned: supplier review scheduler plumbing exists, while live supplier feed ingestion remains stubbed and should be treated as future integration work.

Prohibited: no background worker may bypass RLS or operate with an undocumented global supertenant context.

## 20. Integrations

Implemented: current integrations include Supabase auth/client patterns, knowledge-runtime assets, supplier review queue plumbing, and internal document/customer portal routes.

Required standard: integrations must be tenant-aware, rate-limited where exposed, observable, testable without leaking secrets, and documented with failure modes.

Planned: live supplier feed ingestion and production deployment environment verification remain open work.

Deferred: public payment processing, advanced dispatch optimization, route optimization, and fleet-routing intelligence are explicitly outside the current RC1 scope.

## 21. Observability

Implemented: backend production hardening includes request IDs, request completion logs, security headers, `/health`, trust-proxy parsing, and structured logging helpers.

Required standard: production-relevant behavior needs enough traceability to answer what happened, who initiated it, which tenant was affected, and whether the action completed.

Planned: deployment and environment-specific observability must be verified outside the repository before production readiness is claimed.

Prohibited: do not claim production observability coverage solely because local logging exists.

## 22. Logging

Implemented: request logging records request ID, method, path, status code, duration, and IP; centralized error logging records failed request context.

Required standard: logs should be structured, searchable, low-noise, and safe for multi-tenant production operations.

Planned: domain events can add safer high-signal summaries for critical workflows.

Prohibited: no secrets, JWTs, raw credentials, full prompt bodies, or unnecessary customer-sensitive payloads in logs.

## 23. Metrics

Implemented: the repository exposes health and structured request timing in logs, but no full metrics stack is documented as production-ready.

Required standard: production readiness should include latency, error rate, throughput, integration failure, job retry, and database health metrics for critical paths.

Planned: metrics backend selection and alert thresholds require environment-level verification and should be documented when implemented.

Prohibited: do not mark metrics complete without live sink, retention, ownership, and alert routing evidence.

## 24. Alerting

Implemented: no repository evidence proves a production alerting system is configured.

Required standard: alerts should cover API health, failed migrations, RLS/integration test regressions, background job failures, document generation failures, auth failures, and high-risk write-path errors.

Planned: alerting policy belongs in deployment and operational readiness work after live environment ownership is verified.

Prohibited: do not claim alerting is active from code conventions alone.

## 25. Testing pyramid

Implemented: root docs checks, backend unit tests, backend integration tests, backend lint/build, and web lint/build are documented as the current verification surface.

Required standard: small deterministic tests should cover domain behavior; live integration tests should prove RLS, migrations, and real database behavior; browser tests should cover critical user workflows when the flow is UI-sensitive.

Planned: test coverage should grow where RC1 hardening exposes untested lifecycle, tenancy, portal, document, AI, or scheduling risk.

Prohibited: no reliance on mocked Prisma tests as proof of RLS correctness.

## 26. Unit testing

Implemented: `cd app && npm test` runs backend unit tests; recent AI estimator hardening includes focused service and controller coverage.

Required standard: unit tests should cover lifecycle transitions, permission decisions, validation bounds, duplicate/retry behavior, failure handling, and service-level invariants.

Planned: new service behavior should add tests in the same branch before review readiness.

Prohibited: do not use broad snapshots or fragile implementation mocks as a substitute for meaningful domain assertions.

## 27. Integration testing

Implemented: `cd app && npm run test:integration` is the documented live backend integration harness, and `app/tests/rls.integration.ts` is the canonical live RLS verification location.

Required standard: new RLS-protected tables, policies, migration behavior, and critical transaction paths require live database proof.

Planned: integration blockers such as Docker, `psql`, or database availability must be reported exactly rather than treated as passing checks.

Prohibited: no production-readiness claim when integration verification is skipped or environment-blocked.

## 28. Browser and workflow testing

Implemented: frontend verification currently relies on `cd web && npm run lint` and `cd web && npm run build`; customer portal and workflow polish remain RC1 hardening areas.

Required standard: browser/workflow testing should cover login, project workspace, estimate/proposal/contract/invoice flows, customer portal document views, scheduling, and settings/branding once stable infrastructure is available.

Planned: add browser verification when a sprint changes contractor-visible or customer-visible workflow behavior.

Prohibited: do not infer click-through readiness from typecheck or build success alone.

## 29. Security testing

Implemented: RLS integration tests, auth middleware tests, AI estimator hardening tests, security headers, rate limiting for auth/provisioning and AI estimate routes, and docs ownership rules are part of the current security posture.

Required standard: security-sensitive changes need tests for cross-organization access, fabricated IDs, permission failures, replay, stale provenance, input bounds, and non-leaking errors.

Planned: deeper security review should continue before production launch, especially around portal access, storage assets, supplier integrations, and environment configuration.

Prohibited: no merge of high-risk endpoint changes without negative tests.

## 30. Performance testing

Implemented: migration `20260703090000_add_search_trgm_indexes` adds PostgreSQL `pg_trgm` and GIN trigram indexes for name-oriented cost item, assembly, material, and supplier search.

Required standard: performance work must preserve RLS and correctness while proving measurable benefit for real query patterns.

Planned: combined name-or-code substring search may still degrade because `code` columns are not trigram-indexed.

Prohibited: do not add caches, denormalization, or broad indexes without a measured bottleneck and migration plan.

## 31. Migration policy

Implemented: migrations live in `app/prisma/migrations/`; raw SQL is used where Prisma schema cannot express RLS policies or database-specific behavior.

Required standard: migrations that affect tenant-owned data must include constraints, RLS, rollback awareness, local verification, and documentation updates.

Planned: deployment migration review and environment approval posture remain to be verified outside code.

Prohibited: no ad hoc production schema changes outside tracked migrations.

## 32. Deployment policy

Implemented: `docs/REPOSITORY_GOVERNANCE.md` documents PR readiness, branch policy, required checks, and manual GitHub settings still needed. `.github/workflows/verify-repository.yml` and `.github/workflows/deploy-migrations.yml` exist as current workflow references.

Required standard: deployment readiness requires passing checks, migration review, environment configuration, secret availability, rollback expectations, and post-deploy verification.

Planned: live production approval state must be verified externally before launch claims.

Prohibited: no production launch declaration based only on local docs or build success.

## 33. Environment management

Implemented: backend behavior depends on environment variables such as auth secrets, RLS transaction timeout, trust proxy, and strict transport security flags.

Required standard: environment-specific behavior must be explicit, minimal, reviewed, and documented when it changes production security or deployment behavior.

Planned: environment approvals and production readiness checks must be verified in the live hosting/GitHub environment.

Prohibited: no undocumented environment variable dependencies for critical paths.

## 34. Secrets management

Implemented: auth, provisioning, and AI estimator review-token behavior depend on server-side secrets, and production fail-closed behavior is documented for missing AI review-token signing material.

Required standard: secrets must live outside source control, be rotated intentionally, and fail closed for security-critical signing, authentication, and integration behavior.

Planned: production secret inventory belongs in operational readiness work.

Prohibited: no secrets in docs, commits, logs, fixtures, screenshots, or PR bodies.

## 35. Branch and worktree policy

Implemented: repository governance requires one clean main worktree and one linked worktree per active mission, with no direct development on `main`.

Required standard: every agent follows the canonical startup and completion
flows in `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md`; Repository Governance
owns the branch and worktree lifecycle rather than lane-specific copies.

Planned: stale branch and PR cleanup remains an active governance risk until old drafts are merged, closed, or refreshed.

Prohibited: no reuse of unrelated stale worktrees for new missions.

## 36. PR standards

Implemented: PR readiness requires bounded scope, required docs, clean final status, local checks, and exact reporting of blocked checks.

Required standard: a PR should describe mission, scope, files changed, tests run, risks, blockers, and whether it is ready for human review.

Planned: draft PRs should stay draft until required checks and environment-dependent proof are available.

Prohibited: no broad mixed-purpose PRs that combine docs governance, runtime features, refactors, and dependency changes without explicit approval.

## 37. Required status checks

Implemented: safe-to-require checks are documented as `Docs consistency`, `App lint, unit tests, and build`, `App integration tests`, and `Web lint and build`.

Required standard: these checks should pass before merge readiness unless a branch is explicitly docs-only and the repository's current CI scope is documented.

Planned: GitHub branch protection/ruleset enforcement is still documented as not configured as of the governance snapshot and must be verified live.

Prohibited: do not treat documented desired checks as live enforcement unless GitHub state proves it.

## 38. Release readiness

Implemented: current release posture is RC1 hardening with known gaps in lifecycle compatibility, supplier feed ingestion, code-column search performance, production environment verification, and governance enforcement.

Required standard: release readiness means the product is secure, stable, documented, tested, observable, and coherent for contractor workflows, not merely feature-complete.

Planned: current RC1 readiness work should focus on lifecycle normalization, customer portal hardening, production verification, and stale-draft cleanup.

Prohibited: no release-ready claim while known blockers are unresolved or unverified.

## 39. Incident response

Implemented: request IDs, structured logs, centralized error handling, and activity primitives provide a foundation for incident investigation.

Required standard: incidents need owner, severity, timeline, affected tenants, containment, remediation, customer impact, and follow-up decision records where architecture changes.

Planned: a formal production incident playbook should be added when deployment ownership and alerting are verified.

Prohibited: do not erase logs, suppress errors, or make silent data repairs without an auditable record.

## 40. Technical-debt policy

Implemented: current docs explicitly name compatibility-layer areas, supplier feed stubbing, search-performance gaps, production verification gaps, and stale branch risk.

Required standard: technical debt must be named, scoped, assigned to a sprint or decision record, and prevented from masquerading as completed implementation.

Planned: lifecycle compatibility cleanup and portal hardening are near-term RC1 debt reduction priorities.

Prohibited: no vague "cleanup later" comments for security, tenancy, financial correctness, or customer-facing behavior.

## 41. Deprecation policy

Implemented: legacy roles and lifecycle values are tolerated through compatibility maps and documented normalization.

Required standard: deprecation must identify current readers/writers, compatibility period, migration plan, tests, and user-visible behavior.

Planned: legacy project, proposal, contract, estimate, invoice, role, and state values should be retired only after safe migration and docs alignment.

Prohibited: no abrupt removal of compatibility values without data migration and rollback awareness.

## 42. Documentation ownership

Implemented: `docs/DOC_OWNERSHIP.yml` maps runtime paths to required source-of-truth documentation updates.

Required standard: code that changes validation, permission, rate-limit, tenancy, lifecycle, security, or API behavior must update the corresponding docs in the same branch.

Planned: ownership rules should expand when new modules, controllers, middleware, or governance documents become source-of-truth.

Prohibited: no behavior-changing runtime PR should merge with stale docs because "it was only code."

## 43. Agent engineering rules

Implemented: the Bible owns doctrine, the Next Sprint Protocol owns the sole
executable startup and completion flows, and Repository Governance owns branch,
worktree, review, merge, and cleanup policy.

Required standard: `AGENTS.md`, the Command Center, compatibility checklists,
and lane contracts link to those owners and add no competing general flow.

Planned: autonomous sprint selection is governed by the Sprint Backlog and Next Sprint Protocol, not by broad prompt invention.

Prohibited: agents must not infer `continue` as permission to select unrelated work.

## 44. Stop conditions

Implemented: the canonical Stop Conditions in the Next Sprint Protocol govern
path or branch mismatch, unexpected dirty state, stale remote assumptions,
scope conflict, failed required checks, unavailable infrastructure, product
ambiguity, and source-of-truth contradiction.

Required standard: a stop condition is a safety feature, not a failure. Stop, report exact evidence, and wait for founder or reviewer direction when continuing would create risk.

Planned: stop conditions should be copied into sprint records where work has special hazards.

Prohibited: no quiet workaround around forbidden paths, runtime code restrictions, failing checks, or branch mismatches.

## 45. Definition of done

Implemented: current governance requires final diff inspection, required tests/checks, docs updates, clean status, push, PR, PR readiness statement, and exact next task.

Required standard: done means the branch is scoped, reviewed locally, validated, documented, committed, pushed, and ready for the intended human review state.

Planned: environment-blocked checks must remain explicit blockers until they pass.

Prohibited: no "done" claim when validation is skipped, hidden, stale, or blocked without being reported.

## 46. Engineering anti-patterns

Implemented: the repository explicitly warns against speculative abstractions, duplicate architecture, broad redesign, stale MVP language, app-side-only tenancy, and placeholder release posture.

Required standard: engineers should prefer small, mergeable, independently testable increments that harden existing systems.

Planned: anti-pattern examples should be updated when recurring review issues appear.

Prohibited: no mega-branch, no hidden runtime changes in docs branches, no AI output as trusted data, no uncapped input, no cross-tenant shortcuts, and no direct `main` development.

## 47. Decision records

Implemented: `docs/decisions/` exists for architecture and product decisions, including worktree policy references from governance docs.

Required standard: material changes to architecture, tenancy, release policy, lifecycle semantics, AI authority, or deployment posture require an ADR or decision record.

Planned: founder-only choices that block engineering must also be recorded in affected sprint records.

Prohibited: no irreversible architecture decision should live only in a chat transcript or PR comment.

## 48. Scalability boundaries

Implemented: the repo includes search-index work for selected name queries, service transactions for multi-write consistency, and bounded AI estimator apply behavior.

Required standard: scaling changes must be evidence-led and tenant-safe. Performance work cannot weaken correctness, auditability, RLS, or lifecycle integrity.

Planned: supplier integrations, metrics, alerting, code-column search performance, and larger production data volumes need dedicated scale readiness work.

Deferred: advanced dispatch optimization, automated route optimization, and fleet-routing intelligence are outside the current RC1 scope.

## 49. Production-readiness checklist

Implemented: current validation commands include root docs checks, backend unit/integration/lint/build, frontend lint/build, and diff whitespace checks.

Required standard: before production readiness is claimed, verify all of the following:

1. Required CI checks are passing.
2. Live RLS integration tests pass.
3. Migrations are reviewed and deployable.
4. Secrets are configured outside source control.
5. Branch protection and required checks are actually enforced.
6. Customer-visible workflows are click-through verified.
7. Observability, metrics, and alerting are live enough for operations.
8. Known RC1 blockers are resolved or explicitly accepted.
9. Rollback and incident-response expectations are documented.
10. Source-of-truth docs match implemented behavior.

Prohibited: no production-readiness claim that depends on hope, stale handoff text, or unverified external environment state.

## 50. Canonical engineering principles

Implemented: TradeOS already has a coherent foundation: TypeScript API, Next.js frontend, Prisma/Postgres, forced RLS, request-scoped database sessions, shared domain contracts, module services, source-of-truth docs, and review-first AI estimating.

Required standard: every engineering decision should protect these principles:

1. Tenant isolation is non-negotiable.
2. Human review governs consequential AI-assisted changes.
3. Existing services are extended before new systems are invented.
4. Lifecycle vocabulary must be shared and consistent.
5. Financial and customer-facing mutations require service-layer authority.
6. Documentation changes with behavior.
7. Tests prove the risk being changed.
8. Production claims require live evidence.
9. Work happens in one scoped branch and worktree.
10. TradeOS is a contractor operating system, not a collection of demos.

Prohibited: no change may trade away security, correctness, auditability, or contractor trust for local convenience.

## Source references

- `AGENTS.md`
- `docs/TRADEOS_BIBLE.md`
- `docs/bible/VOLUME_1_VISION.md`
- `docs/ARCHITECTURE.md`
- `docs/CURRENT_STATE.md`
- `docs/DOMAIN_MODEL.md`
- `docs/API_REFERENCE.md`
- `docs/RBAC_MATRIX.md`
- `docs/WORKFLOW_LIFECYCLES.md`
- `docs/REPOSITORY_GOVERNANCE.md`
- `docs/ENGINEERING_COMMAND_CENTER.md`
- `docs/DOC_OWNERSHIP.yml`
- `docs/SESSION_HANDOFF.md`
