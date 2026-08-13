---
status: current
owner: platform
last_verified: 2026-08-12
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
  - app/backend/routes/costbook.routes.ts
  - app/prisma/migrations/20260811120000_add_costbook_workspace_foundation/migration.sql
  - app/prisma/migrations/20260811130000_restrict_costbook_material_writes/migration.sql
  - app/prisma/migrations/20260812120000_add_costbook_hierarchy_foundation/migration.sql
  - app/prisma/migrations/20260812173000_harden_costbook_hierarchy_rls/migration.sql
  - web/src/app/(app)/costbook/page.tsx
  - web/src/app/(app)/costbook/materials/page.tsx
  - web/src/app/(app)/costbook/divisions/page.tsx
  - web/src/components/costbook/materials-catalog.tsx
  - web/src/components/costbook/hierarchy-catalog.tsx
---

# Current State

Last reconciled against `origin/main` commit `ecd2773b` on 2026-08-12 for merged PR evidence, documentation truth, and source-of-truth status. PR #151's Costbook hierarchy hardening is represented as branch-pending implementation on top of that base until this protected migration merges. Runtime implementation claims remain grounded in the code paths and merged evidence named below. Repository state does not by itself prove production deployment state, which must be verified through the approval-gated deployment workflows and the target platform.

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
- Costbook hierarchy management (C005): full Division/Category/Subcategory CRUD under `/api/v1/costbook/{divisions,categories,subcategories}` and `/costbook/divisions`, with owner/admin-only hierarchy writes, parent-join tenant predicates for Category/Subcategory RLS, cross-organization parent rejection, active-parent guards that reject active children beneath inactive ancestors, and parent-deactivation guards that reject leaving active descendants beneath an inactive Division or Category
- Estimating: estimate creation, line items, duplication, comparison, AI estimate assist, and structured contractor-language draft generation
- Proposals
- Contracts
- Invoices and payment recording
- Change orders
- Jobs and scheduling: job creation, assignment, scheduling, rescheduling, dispatcher coordination, and field-status workflows
- Project tasks
- Activity, notifications, recents, saved views, feature flags, and search-oriented intelligence primitives
- Owner dashboard foundation: morning command-center shell, KPI cards, "Needs attention" decision queues, a Today schedule wired to live dispatch data, deterministic live owner briefing, activity timeline, and quick actions across existing contractor workflows
- Owner dashboard foundation: morning command-center shell, KPI cards, "Needs attention" decision queues, a Today schedule wired to live dispatch data, a live project-task queue with real task activity, deterministic live owner briefing, and quick actions across existing contractor workflows
- Brand Studio
- Settings and organization operations
- Customer portal document views
- Supplier review queue and scheduler plumbing
- Knowledge runtime integration
- Backend structured AI estimator orchestration that stages contractor-language scopes into reviewable estimate drafts using existing costbook and estimate-engine services
- Project Athena A1 kernel lifecycle foundation (`app/modules/athena-kernel`): feature-flagged, non-mutating kernel shell with durable execution/transition/telemetry persistence, RLS-protected tenant and actor isolation, and a kernel-owned `AbortController` for timeout/cancellation. Dark by default behind `ATHENA_KERNEL_ENABLED=false`; see [athena/roadmap/A1-ai-kernel-implementation-plan.md](athena/roadmap/A1-ai-kernel-implementation-plan.md). As of A12, the kernel resolves against a real, populated production tool registry (see below) rather than an empty one, when the flag is on.
- Project Athena A8 event integration foundation (`app/modules/athena-events`): dark, pull-based event infrastructure with canonical event, delivery, retry, dead-letter, and replay persistence behind forced RLS. `ProposalsService.send()` remains a production publisher, joined by A12's `EstimateEngineService.create()`/`finalize()` (`EstimateStarted`/`EstimateCompleted`) and `JobsService.schedule()`/`addAssignment()`/`complete()` (`JobScheduled`/`TechnicianAssigned`/`WorkCompleted`) - all emitted after their respective mutation commits, with publish failures logged and never blocking the response. No subscriber is wired to production, no scheduler/worker route invokes delivery dispatch, and event rows are not authoritative business state.
- Project Athena A10 observability (`app/modules/athena-observability`): a read/derivation layer over existing C011 telemetry and A1/A8 tables - trace lookup/search, reliability/latency/tool/model/cost/event-DLQ metrics, ten threshold-based alert rules with dedup/resolution (`athena_alerts`, forced RLS restricted to `owner`/`admin`, narrower than the existing `current_app_can_administer()`), console/webhook exporters, and batched idempotent retention cleanup. Feature-flagged dark behind `ATHENA_OBSERVABILITY_ENABLED=false`. The one production-reachable telemetry gap found during the coverage audit (the A7 memory-candidate hook had no span) was closed with a `spanType: "memory"` addition to `athena-kernel/service.ts`, carrying only candidate counts. Operator dashboard UI lives at `web/src/app/(app)/athena/**`. Two of the ten alert rules are documented, narrow-scope proxies rather than direct signals (`approval_bypass_attempt`, based on an action-span/approval-span match heuristic; `telemetry_write_failure` is explicitly not implemented, since telemetry write failures are unobservable by design) - see [athena/roadmap/A10-observability-implementation-plan.md](athena/roadmap/A10-observability-implementation-plan.md) for the exact scope and known limitations. No dashboards, exporters, or retention/alert jobs run unless the flag is on and, for background jobs, `ATHENA_OBSERVABILITY_MAINTENANCE_JOBS` is configured.
- Project Athena A12 business tool rollout (`app/modules/athena-tools`): the first production Athena business tools - 19 first-party tools across Estimator, Dispatcher, Office Manager, Field Technician, and Costbook Intelligence, each a thin A9 `defineTool()` wrapper around an existing application service (`EstimateEngineService`, `JobsService`, `CrmService`, `InvoicesService`, `ProjectTasksService`, `CostDatabaseService`, `AssembliesDatabaseService`) - never Prisma directly. All 19 are `risk: "low"` by deliberate design (every mutation is an internal, reversible draft/operational change - a draft estimate, a scheduled job, a technician assignment, a task, a job note - never a sent communication, a finalized invoice, or a changed stored price), since production has no real caller-facing approval-verifier submission surface yet for a `medium`/`high`-risk tool to complete against. `createProductionAthenaToolRegistry()` (`app/modules/athena-tools/registry.ts`) is the first real production tool registry - `athena.controller.ts` now passes it into every `handleRequest()` call, reachable only when `ATHENA_KERNEL_ENABLED=true`. Every tool inherits A10 telemetry/alerts and the A11 risk-engine gate automatically via the kernel's existing plan/step loop, with no tool-authored telemetry or security code. See [athena/roadmap/A12-business-tool-rollout-implementation-plan.md](athena/roadmap/A12-business-tool-rollout-implementation-plan.md) for the full tool catalog, permission/event mapping, and the "how to add a new business tool" guide.

See module docs in `docs/modules/`.

## Partially implemented or compatibility-layer areas

- Legacy role values `estimator` and `viewer` are still tolerated in stored data but normalize to canonical roles
- Project lifecycle persistence still contains legacy values such as `proposal_sent` and `accepted`; UI and shared contracts normalize these into canonical display states
- Contract persistence still stores `pending_signature`; global lifecycle docs treat that as compatibility storage under canonical contract states
- Costbook architecture has been documented as a pricing intelligence domain in [architecture/COSTBOOK_DOMAIN_ARCHITECTURE.md](architecture/COSTBOOK_DOMAIN_ARCHITECTURE.md). C001 provides the workspace foundation: `app/modules/costbook`, `GET /api/v1/costbook/workspace`, `costbook.read`/`costbook.write`/`costbook.manage`, forced-RLS workspace foundation tables, and the `/costbook` web route. C002 adds Materials catalog foundation only: `GET/POST /api/v1/costbook/materials`, `GET/PATCH /api/v1/costbook/materials/:id`, strict validated material DTOs over the existing organization-scoped `Material` model, unit-cost audit writes on update, and `/costbook/materials`. C003 adds Labor Rates foundation. C005 completes Division/Category/Subcategory hierarchy CRUD and hardens hierarchy persistence with explicit parent-derived organization scope plus bidirectional activity integrity enforcement. Labor engine, equipment workflows, assembly builder, pricing calculations, estimate integration, price-history engine, supplier sync automation, Athena recommendations, and autonomous Costbook writes are still future work.
- Supplier integration feed ingestion is scaffolded around a stub fetcher; queue, review, audit, and scheduling plumbing are real
- Customer portal exists for proposal, contract, invoice, and project views, but hardening is still tracked as RC work
- Structured AI estimator drafts remain review-first; they do not autonomously write estimate line items and do not call external model APIs in the current implementation
- Structured AI estimator apply now uses server-signed review tokens, server-side active target validation, per-estimate apply serialization, and optional estimate-line `sourceKey` duplicate protection for reviewed AI lines; Docker-backed live RLS integration verification passed locally on this branch
- Route-level `requirePermissions` checks were added to `app/backend/controllers/{aiEstimateAssist,crm,estimateEngine,projectTasks,proposals}.controller.ts`, closing a gap where those routes previously relied on org-membership alone (no route-level permission check). Customer and estimate mutation endpoints also now record `ActivityTimelineService` events (see [modules/activity-and-intelligence.md](modules/activity-and-intelligence.md)).

## Recent verified changes

- Web font/build reliability: the root web layout no longer imports `next/font/google`. The existing TradeOS font CSS-variable names remain stable, but they now resolve through installed/system fallback stacks in `globals.css`, removing build-time dependence on Google Fonts and Turbopack's external Google-font loader. This is a presentation/build-reliability change only; component behavior, application routing, backend APIs, auth, RLS, and database behavior are unchanged.
- Project Athena A7 Memory repair: `AthenaMemoryService` now exposes only active, unexpired caller-visible memories; corrected and expired rows are no longer retrievable through `getById`. User/conversation memory remains exact-actor scoped and organization memory remains exact-organization scoped. Contract-recognized `project`/`job` memory now fails closed at both the service and forced-RLS layers until explicit object-scope authorization exists, replacing the rejected org-wide-read default. Deterministic write policy, source attribution, correction/supersession, forgetting, retention metadata, the lazy user-memory context provider, and the dormant post-action memory hook remain infrastructure-only; no production memory extraction, business-tool execution, semantic retrieval, or autonomous write path is enabled.
- Project Athena A8 Event integration adds `AthenaEvent`, `AthenaEventDelivery`, and `AthenaEventDeadLetter` persistence plus an idempotent publisher, static subscriber registry, retry/dead-letter handling, and replay helper. Delivery failure reasons are stored as safe reason codes rather than raw exception messages. The implementation remains dark infrastructure: no autonomous Athena action, no proposal-route response contract change, and no production subscriber dispatch loop is enabled.
- C001 Costbook Workspace Foundation: a bounded Costbook module exposes the unified read-only workspace summary at `GET /api/v1/costbook/workspace`, guarded by `costbook.read` and backed by org-scoped counts from the existing catalog tables. `costbook.read`, `costbook.write`, and `costbook.manage` are shared domain permissions; owner/admin have full Costbook access, dispatcher, technician, and legacy estimator have read-only Costbook access, and viewer has no Costbook permission. Migration `20260811120000_add_costbook_workspace_foundation` adds `costbook_workspaces` and `costbook_workspace_events` with organization scoping, forced RLS, owner/admin-managed writes, and event/workspace organization guardrails. The web app has a `/costbook` route and dashboard/nav links that show live catalog counts and empty/error states.
- C002 Materials Catalog Foundation: the existing organization-scoped `Material` table is managed through the unified Costbook boundary. The Costbook material routes use `costbook.read`/`costbook.write`, validate tenant-owned supplier linkage, preserve material price-audit history, and keep forced-RLS writes aligned to the owner/admin Costbook boundary.
- C003 Labor Rates Foundation: the existing organization-scoped `labor_rates` table is managed through the unified Costbook boundary with foundational `role`, optional `description`, `hourlyCost`, `billRate`, and `active` fields. Delete soft-deactivates through `active=false`; the legacy route shares the same Costbook permission boundary.
- C005 Costbook Hierarchy Management: the existing `Division`, `Category`, and `Subcategory` tables are managed through the unified Costbook boundary. Migration `20260812120000_add_costbook_hierarchy_foundation` adds `isActive` to all three tables and narrows direct hierarchy writes to `current_app_can_manage_costbook()` (owner/admin). Branch-pending migration `20260812173000_harden_costbook_hierarchy_rls` makes inherited tenant scope explicit in Category/Subcategory write policies; rejects active-child creation/reactivation below inactive ancestors; and rejects deactivating a Division while active Categories remain or a Category while active Subcategories remain. Live PostgreSQL integration coverage independently proves cross-organization RLS rejection and both directions of activity integrity. Delete remains soft-deactivate only; child rows are never cascade-deleted through the API.
- Owner dashboard AI-placeholder audit: the disabled `AI Assistant` foundation slot is replaced by a deterministic `Owner Briefing` that reads existing dispatch, task, and payment-ledger data with honest unavailable states and no model/Athena writes.
- Dashboard knowledge/lifecycle audit: Knowledge Runtime coverage has a live drill-down, and the recent project lifecycle surface is labeled truthfully rather than presented as an organization-wide queue.
- Revenue This Week is transaction-backed from persisted `Payment` rows rather than inferred from invoice paid state.
- Owner-dashboard KPI drill-downs preserve the same source data used by their summary counts.
- Dashboard weather is backed by the first scheduled job site's geocoded National Weather Service forecast and fails closed to an honest no-forecast state.
- UI/UX modernization kept backend/auth/RLS/deployment boundaries stable while improving dashboard, customer, dispatch, responsive, and accessibility behavior.
- Production authentication/RLS recovery fixed bootstrap membership visibility, orphaned-user finish-setup routing, Supabase JWT CommonJS compatibility, and related live-RLS regression coverage.
- Knowledge Runtime production packaging vendors the required read-only Knowledge Engine data inside the backend deployment root and web callers degrade gracefully when knowledge retrieval fails.
- The authenticated app proxy now lives at `web/src/proxy.ts`, and production CORS uses an explicit frontend/preview/local allowlist rather than unrestricted `cors()`.

## Known blockers and unresolved technical debt

- Supplier feed connectors are not live
- Cost-item and assembly combined name-or-code substring search can still degrade into scan-heavy plans because only `name` columns are trigram-indexed today
- Documentation governance is implemented; ongoing governance work should update `docs/DOC_OWNERSHIP.yml`, `docs/README.md`, and `docs/REPOSITORY_GOVERNANCE.md` together when ownership policy changes
- Production deployment state and environment approvals are not inferred from code and must be verified per environment
- Some older implementation notes and planning artifacts required archiving because they conflicted with the live repository
- Settings brand asset uploads use the private `project-files` bucket through a server-only Supabase service-role client and authenticated proxy; no service credential or direct public/signed Supabase Storage URL is returned to the browser
- Settings brand asset uploads can leave an orphaned storage object if a user uploads a file but abandons the settings form before pressing "Save changes" — non-blocking, no cleanup logic exists for this yet
- Knowledge Runtime deployment packaging includes the vendored read-only data and Vercel bundle inclusion required by the production loader.

## Recent verified infrastructure facts

- `20260804020000_harden_database_security_boundaries` protects Prisma migration history and auth-record invariants while preserving the migration administrator boundary.
- `app/scripts/sql/provision-app-role.sql` reapplies the migration-history privilege exception after runtime grants.
- merging application or migration code does not change the live database by itself; normal production rollout remains manual and Environment-approval-gated through the tracked migration deployment workflow
- migration `20260703090000_add_search_trgm_indexes` enables PostgreSQL `pg_trgm` and GIN trigram name indexes without changing RLS behavior

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

- `.github/workflows/verify-repository.yml` runs backend schema/audit/type/unit/Athena/build, live migration/integration/RLS, and frontend audit/unit/lint/build verification
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
