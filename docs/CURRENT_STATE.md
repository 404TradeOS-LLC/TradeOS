---
status: current
owner: platform
last_verified: 2026-08-14
source_of_truth: true
related_code:
  - app/modules/auth
  - app/backend/controllers/auth.controller.ts
  - app/backend/server.ts
  - app/domain/contracts.ts
  - app/prisma/schema.prisma
  - app/prisma/migrations/20260703090000_add_search_trgm_indexes/migration.sql
  - app/prisma/migrations/20260804020000_harden_database_security_boundaries/migration.sql
  - app/scripts/sql/provision-app-role.sql
  - app/backend/routes
  - app/modules/payments
  - app/backend/routes/payments.routes.ts
  - web/src/app
  - web/src/app/(app)/dashboard/overdue-tasks/page.tsx
  - web/src/app/(app)/dashboard/revenue-this-week/page.tsx
  - web/src/app/(app)/dashboard/knowledge-coverage/page.tsx
  - web/src/lib/payment-ledger.ts
  - web/src/components/dashboard/needs-attention-card.tsx
  - web/src/components/dashboard/owner-dashboard-data.ts
  - web/src/components/dashboard/owner-dashboard-header.tsx
  - web/src/components/dashboard/owner-kpi-card.tsx
  - web/src/components/dashboard/owner-today-schedule.tsx
  - web/src/components/dashboard/owner-briefing-panel.tsx
  - web/src/components/dashboard/ai-assistant-placeholder-panel.tsx
  - web/src/components/dashboard/owner-activity-feed.tsx
  - web/src/components/dashboard/owner-quick-actions.tsx
  - web/src/components/estimate-assist/ai-estimate-assist.tsx
  - web/src/app/(app)/dispatch/page.tsx
  - web/src/components/dispatch
  - app/modules/jobs/dispatchRules.ts
  - web/src/app/(app)/customers/page.tsx
  - web/src/app/(app)/customers/[id]/page.tsx
  - web/src/components/customers/customer-directory.tsx
  - web/src/components/shared/page-header.tsx
  - web/src/components/shared/status-badge.tsx
  - web/src/components/shared/global-command-palette.tsx
  - web/src/components/ui/card.tsx
  - web/src/components/ui/select-field.tsx
  - web/src/lib/document-workflow.ts
  - web/src/lib/weather.ts
  - web/src/app/actions/settings.ts
  - web/src/lib/storage.ts
  - web/src/lib/settingsAssetUpload.ts
  - web/src/lib/envSecurity.test.ts
  - web/scripts/preview-smoke-check.mjs
  - web/.env.example
  - .github/workflows/verify-repository.yml
  - web/src/proxy.ts
  - web/src/lib/supabase/proxy.ts
  - web/src/lib/supabase/proxy.test.ts
  - web/next.config.ts
  - app/backend/middleware/productionHardening.ts
  - app/.env.example
  - app/modules/athena-kernel
  - app/prisma/migrations/20260809120000_add_athena_kernel_execution/migration.sql
  - app/modules/athena-memory
  - app/prisma/migrations/20260810130000_add_athena_memory/migration.sql
  - app/modules/athena-events
  - app/prisma/migrations/20260810180000_add_athena_events/migration.sql
  - app/modules/athena-observability
  - app/prisma/migrations/20260811020000_add_athena_observability/migration.sql
  - app/backend/controllers/athenaObservability.controller.ts
  - app/backend/routes/athenaObservability.routes.ts
  - web/src/app/(app)/athena
  - web/src/lib/athena-access.ts
  - app/modules/costbook
  - app/modules/cost-database
  - app/backend/controllers/costDatabase.controller.ts
  - app/backend/routes/costbook.routes.ts
  - app/prisma/migrations/20260811120000_add_costbook_workspace_foundation/migration.sql
  - app/prisma/migrations/20260811130000_restrict_costbook_material_writes/migration.sql
  - app/prisma/migrations/20260811150000_restrict_costbook_equipment_writes/migration.sql
  - app/prisma/migrations/20260812120000_add_costbook_hierarchy_foundation/migration.sql
  - app/prisma/migrations/20260812173000_harden_costbook_hierarchy_rls/migration.sql
  - web/src/app/(app)/costbook/page.tsx
  - web/src/app/(app)/costbook/materials/page.tsx
  - web/src/app/(app)/costbook/equipment/page.tsx
  - web/src/app/(app)/costbook/divisions/page.tsx
  - web/src/app/(app)/costbook/cost-items/page.tsx
  - web/src/components/costbook/materials-catalog.tsx
  - web/src/components/costbook/equipment-catalog.tsx
  - web/src/components/costbook/hierarchy-catalog.tsx
  - web/src/components/costbook/cost-item-catalog.tsx
---

# Current State

Last reconciled against `main` commit `ff0d986e07ae3e9b2886f4102efb92dd724f3eb4` on 2026-08-14, after merged PR #191 (`57f4fe6d37538c755529b099ae79bc425e4d055d`) and the Costbook equipment/hierarchy reconciliation already on main. This change set adds the reconciled CostItem management slice without changing schema, migrations, RLS policy definitions, Estimate mutation semantics, or Athena behavior. Runtime implementation claims remain grounded in the code paths and merged evidence named below. Repository state does not by itself prove production deployment state, which must be verified through the approval-gated deployment workflows and the target platform.

## Current milestone

TradeOS is in RC1 hardening.

The repository is no longer organized around MVP planning documents. The active posture is production readiness, lifecycle consistency, verification, and contractor-facing polish.

## Implemented modules

- Auth and tenancy
- CRM: customers, service addresses, customer equipment, service agreements, notes, company profile
- Projects and project workspace
- Site visit intake
- Cost book: divisions, categories, subcategories, cost items, labor, materials, equipment, assemblies
- Costbook workspace foundation and materials catalog: unified `/api/v1/costbook/workspace` and `/api/v1/costbook/materials` boundaries, Costbook-specific permission keys, org-scoped workspace foundation tables, organization-scoped material reads/writes, and `/costbook` plus `/costbook/materials` web routes with live catalog data and honest loading/empty/error states
- Costbook equipment catalog foundation (C004, merged via PR #183): organization-scoped equipment list/detail/create/update/delete under `/api/v1/costbook/equipment`, legacy equipment-route permission alignment, owner/admin-managed forced-RLS writes, cent-safe hourly-cost derivation, nullable daily-rate clearing, and `/costbook/equipment` with real-data loading/error/empty/read-only/mutation states. PR #203 adds a bounded 15-second equipment-page load timeout and locks editable form state/transitions while save or delete mutations are pending.
- Costbook hierarchy management (C005): full Division/Category/Subcategory CRUD under `/api/v1/costbook/{divisions,categories,subcategories}` and `/costbook/divisions`, with owner/admin-only hierarchy writes, explicit parent-derived tenant predicates for Category/Subcategory RLS, cross-organization parent rejection, active-child guards beneath inactive ancestors, and parent-deactivation guards that prevent active descendants from being stranded beneath an inactive Division or Category
- Costbook CostItem management: the existing `CostItem` model and `CostDatabaseService` are exposed through canonical `/api/v1/costbook/cost-items` list/detail/create/update/soft-deactivate/unit-cost routes and `/costbook/cost-items`. The same implementation remains behind legacy `/api/v1/cost-database/cost-items/*` compatibility routes. Reads require `costbook.read`, ordinary writes require `costbook.write`, lifecycle activation/deactivation requires `costbook.manage`, request bodies cannot supply organization IDs, and service-level parent/catalog reference checks reject cross-organization Subcategory/LaborRate/Material/Equipment/Subcontractor links. CostItem delete remains soft-deactivate so existing Estimate references are preserved.
- Estimating: estimate creation, line items, duplication, comparison, AI estimate assist, and structured contractor-language draft generation
- Proposals
- Contracts
- Invoices and payment recording
- Change orders
- Jobs and scheduling: job creation, assignment, scheduling, rescheduling, dispatcher coordination, and field-status workflows
- Project tasks
- Activity, notifications, recents, saved views, feature flags, and search-oriented intelligence primitives
- Owner dashboard foundation: morning command-center shell, review-queue header, KPI scan, "Needs attention" decision queues, a Today schedule wired to live dispatch data, a live project-task queue with real task activity, deterministic live owner briefing, activity timeline, and quick actions across existing contractor workflows
- Brand Studio
- Settings and organization operations
- Customer portal document views
- Supplier review queue and scheduler plumbing
- Knowledge runtime integration
- Backend structured AI estimator orchestration that stages contractor-language scopes into reviewable estimate drafts using existing costbook and estimate-engine services
- Project Athena A1 kernel lifecycle foundation (`app/modules/athena-kernel`): feature-flagged, non-mutating kernel shell with durable execution/transition/telemetry persistence, RLS-protected tenant and actor isolation, and a kernel-owned `AbortController` for timeout/cancellation. Dark by default behind `ATHENA_KERNEL_ENABLED=false`; see [athena/roadmap/A1-ai-kernel-implementation-plan.md](athena/roadmap/A1-ai-kernel-implementation-plan.md). As of A12, the kernel resolves against a real, populated production tool registry (see below) rather than an empty one, when the flag is on.
- Project Athena A8 event integration foundation (`app/modules/athena-events`): dark, pull-based event infrastructure with canonical event, delivery, retry, dead-letter, and replay persistence behind forced RLS. `ProposalsService.send()` remains a production publisher, joined by A12's `EstimateEngineService.create()`/`finalize()` (`EstimateStarted`/`EstimateCompleted`) and `JobsService.schedule()`/`addAssignment()`/`complete()` (`JobScheduled`/`TechnicianAssigned`/`WorkCompleted`). A12.1 makes durable persistence of those six canonical events atomic with the corresponding estimate, proposal, schedule, assignment, and completion mutations: required event-persistence failure rolls the business mutation back. Subscriber delivery, retry, dead-letter, and replay remain asynchronous after commit. No subscriber is wired to production, no scheduler/worker route invokes delivery dispatch, and event rows are not authoritative business state.
- Project Athena A10 observability (`app/modules/athena-observability`): a read/derivation layer over existing C011 telemetry and A1/A8 tables - trace lookup/search, reliability/latency/tool/model/cost/event-DLQ metrics, ten threshold-based alert rules with dedup/resolution (`athena_alerts`, forced RLS restricted to `owner`/`admin`, narrower than the existing `current_app_can_administer()`), console/webhook exporters, and batched idempotent retention cleanup. Feature-flagged dark behind `ATHENA_OBSERVABILITY_ENABLED=false`. The one production-reachable telemetry gap found during the coverage audit (the A7 memory-candidate hook had no span) was closed with a `spanType: "memory"` addition to `athena-kernel/service.ts`, carrying only candidate counts. Operator dashboard UI lives at `web/src/app/(app)/athena/**`. Two of the ten alert rules are documented, narrow-scope proxies rather than direct signals (`approval_bypass_attempt`, based on an action-span/approval-span match heuristic; `telemetry_write_failure` is explicitly not implemented, since telemetry write failures are unobservable by design) - see [athena/roadmap/A10-observability-implementation-plan.md](athena/roadmap/A10-observability-implementation-plan.md) for the exact scope and known limitations. No dashboards, exporters, or retention/alert jobs run unless the flag is on and, for background jobs, `ATHENA_OBSERVABILITY_MAINTENANCE_JOBS` is configured.
- Project Athena A12 business tool rollout (`app/modules/athena-tools`): the first production Athena business tools - 19 first-party tools across Estimator, Dispatcher, Office Manager, Field Technician, and Costbook Intelligence, each a thin A9 `defineTool()` wrapper around an existing application service (`EstimateEngineService`, `JobsService`, `CrmService`, `InvoicesService`, `ProjectTasksService`, `CostDatabaseService`, `AssembliesDatabaseService`) - never Prisma directly. All 19 are `risk: "low"` by deliberate design (every mutation is an internal, reversible draft/operational change - a draft estimate, a scheduled job, a technician assignment, a task, a job note - never a sent communication, a finalized invoice, or a changed stored price), since production has no real caller-facing approval-verifier submission surface yet for a `medium`/`high`-risk tool to complete against. `createProductionAthenaToolRegistry()` (`app/modules/athena-tools/registry.ts`) is the first real production tool registry - `athena.controller.ts` now passes it into every `handleRequest()` call, reachable only when `ATHENA_KERNEL_ENABLED=true`. Every tool inherits A10 telemetry/alerts and the A11 risk-engine gate automatically via the kernel's existing plan/step loop, with no tool-authored telemetry or security code. See [athena/roadmap/A12-business-tool-rollout-implementation-plan.md](athena/roadmap/A12-business-tool-rollout-implementation-plan.md) for the full tool catalog, permission/event mapping, and the "how to add a new business tool" guide.
- Athena foundation hardening (merged via PR #200, merge commit `c2121f5c60059bc8f38546dad45755e566eceae0`): shared Athena contracts now expose a central `app/modules/athena/contracts.ts` facade; registered tools normalize discovery metadata (`name`, `category`, `outputSchema`) while preserving legacy raw-registration compatibility; router execution goes through an explicit strategy-plus-fallback seam; kernel context snapshots stay immutable during provider enrichment; successful action execution returns the executed tool result at the Athena response boundary; and action approval/executor metadata is validated through the hardened A6 contract path. This is merged repository state, not proof that Athena is enabled in production.

See module docs in `docs/modules/`.

## Partially implemented or compatibility-layer areas

- Legacy role values `estimator` and `viewer` are still tolerated in stored data but normalize to canonical roles
- Project lifecycle persistence still contains legacy values such as `proposal_sent` and `accepted`; UI and shared contracts normalize these into canonical display states
- Contract persistence still stores `pending_signature`; global lifecycle docs treat that as compatibility storage under canonical contract states
- Costbook architecture is documented as a pricing intelligence domain in [architecture/COSTBOOK_DOMAIN_ARCHITECTURE.md](architecture/COSTBOOK_DOMAIN_ARCHITECTURE.md). C001-C005 provide the workspace, Materials, Labor Rates, Equipment, and Division/Category/Subcategory management foundations. The reconciled CostItem slice promotes the already-existing CostItem CRUD/unit-cost implementation into the unified Costbook API/UI and hardens its explicit tenant/reference checks without creating another model or pricing engine. Assemblies already have organization-scoped legacy CRUD, item composition, template behavior, and relationship-derived unit-cost calculation, and existing Estimate/structured AI-estimator paths already consume active organization-scoped CostItems or Assemblies. What remains before new pricing infrastructure is a first-class `/costbook/assemblies` management surface, followed by dedicated Estimate ↔ Costbook provenance/historical-price verification. Broader markup/rules, price-history expansion, supplier sync automation, Athena recommendations, and autonomous Costbook writes remain future work.
- Supplier integration feed ingestion is scaffolded around a stub fetcher; queue, review, audit, and scheduling plumbing are real
- Customer portal exists for proposal, contract, invoice, and project views, but hardening is still tracked as RC work
- Structured AI estimator drafts remain review-first; they do not autonomously write estimate line items and do not call external model APIs in the current implementation
- Structured AI estimator apply uses server-signed review tokens, server-side active target validation, per-estimate apply serialization, and optional estimate-line `sourceKey` duplicate protection for reviewed AI lines. These existing paths prove CostItems/Assemblies are already consumed, but they do not by themselves prove every historical pricing/provenance edge case for contractor-driven Estimate editing.
- Route-level `requirePermissions` checks were added to `app/backend/controllers/{aiEstimateAssist,crm,estimateEngine,projectTasks,proposals}.controller.ts`, closing a gap where those routes previously relied on org-membership alone (no route-level permission check). Customer and estimate mutation endpoints also now record `ActivityTimelineService` events (see [modules/activity-and-intelligence.md](modules/activity-and-intelligence.md)).

## Recent verified changes

- CostItem management reconciliation on PR #210 reuses the existing `CostItem` model, `CostDatabaseService`, relationship-derived cost formulas, and legacy routes. It adds canonical `/api/v1/costbook/cost-items` routes and `/costbook/cost-items`, explicit `costbook.read`/`write`/`manage` enforcement, strict no-org-id request validation, same-organization parent/catalog reference validation, nullable pricing-input clearing, soft deactivation, focused service regression coverage, and live PostgreSQL CostItem RLS coverage. It does not add schema/migrations, new RLS policies, pricing rules, Estimate mutation changes, or Athena behavior.
- Athena approval read normalization on PR #207 conditionally and atomically transitions overdue approvals that are still persisted as `pending` to `expired` before organization-scoped approval list/detail reads. The predicate remains organization-scoped and pending-state-only, so concurrent terminal changes and rows from other organizations are preserved. This is an approval lifecycle/read consistency repair only: no schema, migration, permission, scheduler, or roadmap scope changes are introduced.
- A12.1 transactional canonical-event reliability merged as PR #191 at `57f4fe6d37538c755529b099ae79bc425e4d055d`. It reuses the existing `athena_events`/`athena_event_deliveries` outbox, adds transactional service wrappers for the six production canonical publishers, preserves savepoint isolation, uses conflict-safe idempotent insertion for concurrent same-key publication, and includes a live PostgreSQL rollback plus two-session race test. This does not add A13 work, another event bus, a scheduler, new permissions, or production subscriber execution.
- Athena foundation hardening merged as PR #200 (`c2121f5c60059bc8f38546dad45755e566eceae0`): the registry/router/action/kernel seams described above are now on `main`. The merge does not imply production activation; `ATHENA_KERNEL_ENABLED` and the existing rollout controls remain the authority for runtime enablement.
- Web app-route auth proxy hardening: unauthenticated requests to authenticated web route families now redirect to `/login` from `web/src/proxy.ts`/`web/src/lib/supabase/proxy.ts` before the `(app)` route tree can render or stream protected page content. The matcher now covers `/athena`, `/brand-studio`, `/costbook`, `/customers`, `/dashboard`, `/dispatch`, `/finish-setup`, `/portal`, `/projects`, and `/settings`. This fixes the production-observed behavior where unauthenticated protected routes could return HTTP 200 with a streamed `NEXT_REDIRECT` marker instead of an upfront redirect. Public `/login` and `/signup` remain outside the proxy matcher. Regression coverage in `web/src/lib/supabase/proxy.test.ts` pins both the unauthenticated redirect gate and the protected-route matcher set.
- Web font/build reliability: the root web layout no longer imports `next/font/google`. The existing TradeOS font CSS-variable names remain stable, but they now resolve through installed/system fallback stacks in `globals.css`, removing build-time dependence on Google Fonts and Turbopack's external Google-font loader. This is a presentation/build-reliability change only; component behavior, application routing, backend APIs, auth, RLS, and database behavior are unchanged.
- Project Athena A7 Memory repair: `AthenaMemoryService` now exposes only active, unexpired caller-visible memories; corrected and expired rows are no longer retrievable through `getById`. User/conversation memory remains exact-actor scoped and organization memory remains exact-organization scoped. Contract-recognized `project`/`job` memory now fails closed at both the service and forced-RLS layers until explicit object-scope authorization is implemented, replacing the rejected org-wide-read default. Deterministic write policy, source attribution, correction/supersession, forgetting, retention metadata, the lazy user-memory context provider, and the dormant post-action memory hook remain infrastructure-only; no production memory extraction, business-tool execution, semantic retrieval, or autonomous write path is enabled.
- Project Athena A8 Event integration adds `AthenaEvent`, `AthenaEventDelivery`, and `AthenaEventDeadLetter` persistence plus an idempotent publisher, static subscriber registry, retry/dead-letter handling, and replay helper. Delivery failure reasons are stored as safe reason codes rather than raw exception messages. The implementation remains dark infrastructure: no autonomous Athena action, no proposal-route response contract change, and no production subscriber dispatch loop is enabled.
- C001 Costbook Workspace Foundation: a bounded Costbook module exposes the unified read-only workspace summary at `GET /api/v1/costbook/workspace`, guarded by `costbook.read` and backed by org-scoped counts from the existing catalog tables. `costbook.read`, `costbook.write`, and `costbook.manage` are shared domain permissions; owner/admin have full Costbook access, dispatcher, technician, and legacy estimator have read-only Costbook access, and viewer has no Costbook permission. Migration `20260811120000_add_costbook_workspace_foundation` adds `costbook_workspaces` and `costbook_workspace_events` with organization scoping, forced RLS, owner/admin-managed writes, and event/workspace organization guardrails. The web app has a `/costbook` route and dashboard/nav links that show live catalog counts and empty/error states.
- C002 Materials Catalog Foundation: the existing organization-scoped `Material` table is managed through the unified Costbook boundary. `GET /api/v1/costbook/materials` and `GET /api/v1/costbook/materials/:id` require `costbook.read`; `POST /api/v1/costbook/materials` and `PATCH /api/v1/costbook/materials/:id` require `costbook.write`; strict validation rejects caller-supplied organization IDs, out-of-scope pricing fields, blank/null unit costs, and unit costs outside the existing database precision. Same-organization supplier IDs are validated before linking, cross-organization material IDs return 404, and unit-cost changes write the existing material price-audit record. The existing `materials` table is reused under forced RLS.
- C003 Labor Rates Foundation: the existing organization-scoped `labor_rates` table is managed through the unified Costbook boundary. `GET` requires `costbook.read`, `POST/PATCH` require `costbook.write`, and `DELETE` requires `costbook.manage` and soft-deactivates through `active=false`. The legacy labor route group shares the same permissions and forced-RLS write boundary.
- C004 Costbook Equipment Catalog Foundation (merged via PR #183): the existing organization-scoped `equipment` table is managed through the unified Costbook boundary. `GET` requires `costbook.read`; `POST/PATCH` require `costbook.write`; `DELETE` requires `costbook.manage`. Migration `20260811150000_restrict_costbook_equipment_writes` narrows the existing forced-RLS equipment write policy to `current_app_can_manage_costbook()` without duplicating the table. Live PostgreSQL integration coverage proves tenant-scoped reads, owner write success, technician create/update denial, and cross-organization write denial. The `/costbook/equipment` route exposes real API data with loading, error, empty, read-only, create/edit/delete, and responsive catalog states.
- C005 Costbook Hierarchy Management: the existing `Division`, `Category`, and `Subcategory` tables are managed through the unified Costbook boundary. Ordinary editable fields require `costbook.write`; lifecycle `isActive` changes and delete/deactivation require `costbook.manage`. Migrations `20260812120000_add_costbook_hierarchy_foundation` and `20260812173000_harden_costbook_hierarchy_rls` add soft lifecycle state, explicit parent-derived tenant predicates, and bidirectional active-parent/active-child integrity. Live PostgreSQL integration coverage independently verifies cross-organization RLS rejection and both directions of activity integrity. Issue #153 is closed as completed because PR #184 landed the lifecycle permission split and PR #183's protected integration run verified the combined C004/C005 migration sequence.
- Owner dashboard AI-placeholder audit: the disabled `AI Assistant` foundation slot is replaced by a deterministic `Owner Briefing` that reads the existing dispatch summary, org-scoped project-task feed, and current-week recorded-payment ledger. It surfaces schedule pressure, overdue/blocked task pressure, and transaction-backed weekly revenue with direct links to Dispatch, Overdue Tasks, and Revenue This Week. Each read degrades to `Unavailable` independently. The briefing makes no model call, does not call an Athena execution endpoint, and performs no autonomous write.
- Dashboard knowledge/lifecycle audit: the existing Knowledge Runtime Coverage card remains backed by live `GET /api/v1/knowledge/stats` data; `/dashboard/knowledge-coverage` shows live trade coverage, assemblies, cost items, indexed keywords, source/runtime health, and load warnings without adding AI execution or writes.
- Revenue This Week is transaction-backed from organization-scoped persisted `Payment` rows with status `recorded`, and the dashboard KPI and drill-down use the same ledger response. If the ledger read fails, Revenue shows `Unavailable` rather than substituting paid-invoice totals.
- Owner-dashboard KPI drill-downs preserve source-of-truth alignment for open estimates, invoices waiting, overdue tasks, today’s jobs, unscheduled jobs, and current-week recorded revenue.
- Dashboard weather (`web/src/lib/weather.ts`) is backed by National Weather Service data for today's first scheduled job's project site, using a Census geocode and NWS forecast with honest no-data/failure behavior.
- Dashboard UX modernization improves information hierarchy, responsive work queues, shared statuses, accessibility, and loading states without changing backend/auth/database behavior.
- Fixed the production bootstrap/login RLS visibility gap by running the already-provisioned identity lookup inside the required request/session flag sequence; live RLS regression coverage pins the behavior.
- Verified the finish-setup recovery flow in production for an orphaned Supabase identity and added the missing login routing/finish-setup handling required for identities without application-side membership records.
- Knowledge Runtime data is vendored into the backend deployable root at build time so `/api/v1/knowledge/*` works with Vercel's `app` Root Directory; dashboard/AI Estimate pages degrade gracefully if knowledge reads fail.
- Supabase JWT verification is pinned to the CommonJS-compatible `jose` v4 line and covered by a real RS256/JWKS regression test.
- The owner dashboard is a live contractor command center with task, dispatch, payment-ledger, project, knowledge, and deterministic briefing inputs; it does not use Athena for autonomous actions.
- AI Estimate Assist surfaces resolved-target `matchMethod` along with match score for clearer review provenance.
- Shared rounding uses `app/modules/estimate-engine/formulas.ts` rather than duplicate private helpers.
- Dead frontend/auth helper code identified during hardening was removed; live shared UI and Supabase peer dependencies were retained.
- Settings brand assets are persisted to private storage through server-only service-role access plus authenticated application metadata/proxy endpoints; abandoned uploads can still leave orphaned storage objects and remain tracked technical debt.
- Dispatcher Workspace (`/dispatch`) reuses the existing jobs/job-assignment domain and adds a read-only dispatch summary plus organization-timezone-aware attention rules; it does not change canonical lifecycle states or Athena behavior.
- Web frontend deployment foundation includes Vercel Preview/production deployments, environment-contract documentation, protected-route proxy placement under `web/src/proxy.ts`, and an explicit backend CORS allowlist. Repository state does not prove every live environment variable is correct.

## Known blockers and unresolved technical debt

- First-class Costbook assembly management is the next catalog-management dependency. Legacy assembly CRUD/composition and estimating consumption already exist; the gap is the unified Costbook API/UI workflow and its permission/tenant UX alignment.
- After assembly management, Estimate ↔ Costbook provenance and historical-pricing behavior should be explicitly verified so later Costbook price changes never silently mutate already-created Estimate lines and source/provenance remains reviewable.
- Supplier feed connectors are not live.
- Cost-item and assembly combined name-or-code substring search can still degrade into scan-heavy plans because only `name` columns are trigram-indexed today.
- Documentation governance is implemented; ongoing governance work should update `docs/DOC_OWNERSHIP.yml`, `docs/README.md`, and `docs/REPOSITORY_GOVERNANCE.md` together when ownership policy changes.
- Production deployment state and environment approvals are not inferred from code and must be verified per environment.
- Some older implementation notes and planning artifacts required archiving because they conflicted with the live repository.
- Settings brand asset uploads use the private `project-files` bucket through a server-only Supabase service-role client and authenticated proxy; no service credential or direct public/signed Supabase Storage URL is returned to the browser.
- Settings brand asset uploads can leave an orphaned storage object if a user uploads a file but abandons the settings form before pressing "Save changes" — non-blocking, no cleanup logic exists for this yet.
- Knowledge Runtime deployment packaging vendors read-only Knowledge Engine data into `app/vendor/knowledge-engine/` during backend build and includes that tree in the Vercel function bundle; this changes deployment packaging only, not APIs, estimator review behavior, auth, RLS, or write paths.

## Recent verified infrastructure facts

- the repository includes `20260804020000_harden_database_security_boundaries`, which enables RLS on Prisma migration history without forcing it for the table-owning migration administrator, revokes runtime/public migration-history privileges, pins RLS helper functions to an empty search path, and replaces permissive auth-record update checks with guarded policies plus immutable identity triggers
- `app/scripts/sql/provision-app-role.sql` reapplies the `_prisma_migrations` privilege exception after its broad runtime table grant, preserving the boundary on every idempotent role provisioning run
- merging application or migration code does not change the live database by itself; normal production rollout remains manual and Environment-approval-gated through the tracked migration deployment workflow
- migration `20260703090000_add_search_trgm_indexes` enables PostgreSQL `pg_trgm` and adds GIN trigram indexes on `cost_items.name`, `assemblies.name`, `materials.name`, and `suppliers.name`; indexes affect planning only, not tenancy enforcement

## Current verification surface

Backend commands defined in `app/package.json`:

- `npm test`
- `npm run test:integration`
- `npm run lint`
- `npm run build`

Frontend commands defined in `web/package.json`:

- `npm run lint`
- `npm run build`
- `npm test`

Current CI workflows:

- `.github/workflows/verify-repository.yml` runs backend lint, unit tests, build, integration tests, and frontend unit tests/lint/build
- `.github/workflows/deploy-migrations.yml` runs tracked database rollout logic for migration changes

## Module documentation

- [modules/auth-and-tenancy.md](modules/auth-and-tenancy.md)
- [modules/crm.md](modules/crm.md)
- [modules/cost-book.md](modules/cost-book.md)
- [modules/estimating.md](modules/estimating.md)
- [modules/proposals.md](modules/proposals.md)
- [modules/contracts.md](modules/contracts.md)
- [modules/invoices-and-payments.md](modules/invoices-and-payments.md)
- [modules/projects.md](modules/projects.md)
- [modules/jobs-and-scheduling.md](modules/jobs-and-scheduling.md)
- [modules/activity-and-intelligence.md](modules/activity-and-intelligence.md)
- [modules/brand-studio.md](modules/brand-studio.md)
- [modules/customer-portal.md](modules/customer-portal.md)
- [modules/ai-estimate-assist.md](modules/ai-estimate-assist.md)
- [modules/settings-and-operations.md](modules/settings-and-operations.md)
