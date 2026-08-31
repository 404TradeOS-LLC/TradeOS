---
status: current
owner: platform
last_verified: 2026-08-31
source_of_truth: true
related_code:
  - app/modules/auth
  - app/backend/controllers/auth.controller.ts
  - app/backend/controllers/adminDashboard.controller.ts
  - app/backend/server.ts
  - app/domain/contracts.ts
  - app/prisma/schema.prisma
  - app/backend/routes
  - app/modules/payments
  - app/modules/costbook
  - app/modules/cost-database
  - app/modules/assemblies-database
  - app/modules/estimate-engine
  - app/modules/supplier-integration
  - app/modules/athena-kernel
  - app/modules/athena-tools
  - app/modules/athena-tools/costbook
  - app/modules/athena-events
  - app/modules/athena-observability
  - app/modules/athena-action-engine
  - web/src/app
  - web/src/app/(app)/dashboard
  - web/src/app/(app)/costbook
  - web/src/app/(app)/dispatch
  - web/src/app/(app)/customers
  - web/src/app/(app)/projects
  - web/src/app/customer-portal
  - web/src/app/(app)/portal
  - web/src/app/api/proxy/[...path]/route.ts
  - web/src/proxy.ts
  - web/src/lib/supabase/proxy.ts
  - web/src/lib/api.ts
  - web/src/lib/api-response.ts
  - web/src/lib/clientApi.ts
  - web/src/lib/customer-portal-session.ts
  - web/src/lib/json-response.ts
  - web/src/lib/proxy-origin.ts
  - .github/workflows/verify-repository.yml
---

# Current State

Last reconciled against `origin/main` commit `fcf96a703f80fbaa4122f6a43977118687634122` on 2026-08-30 after PR #412 merged. This document records repository truth, not a guarantee that every merged capability is deployed or exercised in every environment. Production/deployment claims remain tied to the specific evidence noted below.

## Current milestone

TradeOS is in RC1 hardening. The active posture is production readiness, lifecycle consistency, contractor-facing usability, tenant-boundary verification, and retained release evidence rather than MVP planning.

## Implemented product areas

- Auth and tenancy, including local-session refresh hardening, Supabase JWT verification, organization bootstrap/recovery, request-scoped database sessions, and forced PostgreSQL RLS.
- CRM: customers, service addresses, customer equipment, service agreements, notes, and company profile.
- Projects and project workspace, including task and site-visit workflows.
- Estimating: estimate creation, sections/line items, Costbook provenance, custom lines, pricing formulas, tax, duplication, comparison, finalized-estimate behavior, and review-first AI Estimate Assist.
- Proposals, contracts, invoices, recorded payments, and downstream lifecycle flows.
- Jobs and Dispatch: scheduling, assignment, rescheduling, conflict handling, field-status transitions, and dispatcher work queues.
- Owner dashboard: organization work queues, KPI drill-downs, payment-backed revenue, dispatch-backed schedule, task pressure, activity, quick actions, and truthful degraded states.
- Brand Studio and Settings/organization operations.
- Customer portal document views and the public customer magic-link portal approved by ADR-010.
- Knowledge Runtime integration and backend structured estimator orchestration.

## Costbook domain

The canonical Costbook workspace is implemented across `/api/v1/costbook/*` and `/costbook/*` while reusing the established catalog tables and services instead of creating duplicate pricing subsystems.

Implemented Costbook surfaces include:

- workspace summary
- divisions, categories, and subcategories
- materials
- labor rates
- equipment
- Cost Items
- Assemblies and components
- calculation-only pricing preview
- Material price audit/history and Estimate pricing snapshots
- supplier-feed proposal/review flow
- bounded search/filter/sort/cursor pagination across canonical catalog collections

Costbook permissions, organization scope, request-scoped sessions, and forced RLS remain the authority for tenant boundaries. Estimate lines preserve source identifiers plus captured `unitCost`/`lineCost` snapshots so later catalog changes do not rewrite historical estimate pricing.

### S027 production-readiness truth

The implementation that older revisions of this document labeled **Unreleased** is merged repository state:

- PR #257 merged the supplier review concurrency repair.
- PR #260 merged the standardized Costbook catalog query contract.
- PR #268/#271 repaired bounded Supabase/Vercel serverless database pooling and TLS compatibility.
- PR #273 merged the bounded request-transaction acquisition wait.
- PR #274 added the real PostgreSQL `connection_limit=1` contention regression and hermetic timeout coverage.
- PR #278 supplied the production deployment/replay evidence referenced by the S027 readiness record.

The S027 readiness record therefore remains `PARTIAL`, **not because those repository/runtime repairs are unreleased**, but because exact authenticated rendered evidence is still missing at **1440 / 1024 / 768 / 390 px**, including keyboard-focus and mutation/error-state coverage. The production replay already reached all nine canonical Costbook routes with `200` API responses and no warning/error/fatal entries in the exact-deployment logs; exact viewport evidence remains the final promotion gate. See `docs/architecture/COSTBOOK_S027_READINESS.md`.

Cold/concurrent Costbook requests in the retained production evidence reached approximately 12.6 seconds in the worst observed case. Treat that as performance follow-up, not as proof of an incomplete response.

### Costbook ↔ Athena boundary

Athena A12 includes three landed **read-only/recommendation-only** Costbook Intelligence tools under `app/modules/athena-tools/costbook`:

- catalog lookup
- margin analysis
- price recommendation

Those adapters call existing `CostDatabaseService` / `AssembliesDatabaseService` methods and shared Estimate formulas. They do not reach Prisma directly, do not define competing pricing math, and do not mutate Costbook or stored pricing state. Athena Costbook writes/autonomous Costbook mutation remain outside the landed architecture and require separate governance.

## Lifecycle normalization status

The bounded lifecycle-normalization sequence through Project, Estimate, Proposal, Contract, Invoice, and Job behavior has landed through the numbered sprint evidence recorded in `docs/SPRINT_BACKLOG.md` and the corresponding architecture/completion records.

Important compatibility truths that remain intentional:

- historical Project aliases remain readable while new writes use canonical Project states;
- Estimate `sent` remains distinct from internal `ready`;
- historical Proposal `rejected` normalizes to canonical `declined`;
- Contract persistence may retain compatibility storage such as `pending_signature` while DTOs expose the canonical lifecycle contract;
- Invoice paid/partial/overdue presentation is derived from persisted Invoice/Payment truth rather than inventing ledger rows;
- destructive historical rewrites are not implied by lifecycle normalization.

## Customer portal and identity

Two portal surfaces are intentionally distinct:

- `/portal/*` is the authenticated staff preview/workspace.
- `/customer-portal/*` is the ADR-010 public customer-scoped magic-link surface.

The public portal uses one-time hashed access tokens redeemed into short-lived hashed sessions, customer/tenant-scoped forced-RLS reads, replay/revocation protection, and a narrowly authorized pending-contract customer-signing transition with explicit customer attribution. It does not claim certificate-backed signing, notarization, or standalone legal identity verification.

Customer-portal server API reads preserve structured backend errors, normalize non-JSON upstream failures into the portal failure path, and reject malformed successful responses explicitly instead of leaking raw parser exceptions.

## Athena implementation state

Athena remains a feature-flagged orchestration layer over existing application services rather than a parallel business-domain implementation.

Landed foundations include:

- kernel lifecycle and execution persistence
- memory infrastructure with scoped visibility rules
- canonical event/outbox persistence and delivery infrastructure
- action engine, approval/risk boundaries, and durable idempotency
- observability/trace/alert derivation
- first-party business tools routed through existing application services
- safe background/retry/correlation semantics
- security audit-event coverage

Athena business tools must preserve service ownership and existing authorization/RLS boundaries. Direct Prisma access from tools, duplicate domain logic, and autonomous Costbook mutation remain outside the intended module boundary.

Repository merge state does not by itself prove Athena is enabled in production; feature flags and deployment configuration remain authoritative.

## Security and tenant-boundary posture

Current repository architecture uses authenticated request context plus organization membership authorization, request-scoped database sessions, and forced PostgreSQL RLS as layered tenant protection. Route/service permission checks remain defense in depth rather than a substitute for database isolation.

Security-sensitive maintenance already landed includes:

- local refresh-token rotation/revocation hardening
- Supabase JWT claim/lifetime validation
- organization bootstrap/RLS lookup repairs
- tenant-boundary regression coverage
- protected storage/server-action session checks
- bounded database transaction acquisition under serverless contention
- safe audit/security event capture
- exact-origin enforcement for cookie-backed `POST`/`PUT`/`PATCH`/`DELETE` calls through the generic authenticated Next.js API proxy before the HttpOnly session is read or translated into a backend bearer token; safe read methods remain unchanged
- browser-side same-origin API response handling normalizes non-JSON proxy/upstream failures into `ClientApiError` with the HTTP status preserved and treats malformed successful responses as explicit API contract failures rather than leaking raw parser exceptions
- server-only staff API response handling preserves structured backend error status/details, normalizes non-JSON upstream failures into `ApiClientError`, and treats malformed successful responses as explicit API contract failures rather than leaking raw parser exceptions

The authenticated-proxy origin check closes the same-site sibling-origin CSRF gap that `SameSite=Lax` cookies do not cover by themselves without changing backend JWT, membership, permission, or RLS policy.

This document does not treat a passing unit test or route-level organization predicate as equivalent to RLS evidence where the repository requires PostgreSQL-backed verification.

## Deployment and beta-evidence posture

Repository state and production state are separate evidence domains.

Known retained deployment evidence includes the S027 production Costbook replay described above and later production/auth fixes recorded by their owning PRs. Exact release-candidate browser evidence, environment configuration, credentials/storage states, and retained multi-viewport artifacts must be proven through the approved deployment/evidence workflows rather than inferred from merged code.

Customer magic-link portal implementation is merged, but its merge alone does not constitute beta-readiness evidence. The same applies to other product flows that still require authenticated rendered verification.

## Current verification surface

Backend commands defined in `app/package.json` include:

- `npm test`
- `npm run test:integration`
- `npm run lint`
- `npm run build`

Frontend commands defined in `web/package.json` include:

- `npm test`
- `npm run lint`
- `npm run build`

Repository governance additionally uses documentation consistency, dependency review, branch-currency/live-reconciliation checks, and PostgreSQL-backed integration/migration rehearsals where applicable.

## Known blockers and unresolved technical debt

- S027 exact authenticated rendered evidence at 1440 / 1024 / 768 / 390 px remains incomplete; repository/runtime repairs are merged and production replay is already evidenced.
- Persisted organization-wide Costbook pricing-policy/rule governance is not implemented; `/costbook/pricing` remains calculation-only preview behavior.
- Supplier feeds remain review-first and do not auto-apply prices; supplier-SKU matching and provider-specific connector depth remain future work.
- Cost-item and Assembly combined name-or-code substring search can still become scan-heavy because current trigram coverage is stronger for name search than code search.
- Athena Costbook writes/autonomous pricing mutation are not implemented.
- Production environment values, Preview isolation, authenticated RC storage states, and multi-viewport browser artifacts must be verified externally rather than inferred from repository state.
- Settings brand-asset uploads use a shipped S017 orphan reconciler: stale generated, non-current objects can remain in private Storage until an authorized operator runs the dry-run-by-default cleanup after the 24-hour grace period. No automatic cleanup scheduler exists by design.

## Canonical sequencing

Numbered-sprint eligibility and ordering are owned by `docs/SPRINT_BACKLOG.md` and the repository reconciliation protocol. `CURRENT_STATE.md` describes implementation truth; it does not override the backlog, readiness plans, ADRs, or completion-evidence records.

## Module documentation

See `docs/modules/` for the maintained domain/module records and `docs/architecture/` for readiness plans, ADRs, and completion evidence.