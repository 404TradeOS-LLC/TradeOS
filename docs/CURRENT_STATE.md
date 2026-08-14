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
  - web/src/components/costbook/materials-catalog.tsx
  - web/src/components/costbook/equipment-catalog.tsx
  - web/src/components/costbook/hierarchy-catalog.tsx
---

# Current State

Last reconciled against `main` commit `c2121f5c60059bc8f38546dad45755e566eceae0` on 2026-08-14 after merged PR #200 (Athena foundation hardening) and merged PR #183 (C004 equipment catalog reconciliation). Runtime implementation claims remain grounded in the code paths and merged evidence named below. Repository state does not by itself prove production deployment state, which must be verified through the approval-gated deployment workflows and the target platform.

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
- Costbook architecture has been documented as a pricing intelligence domain in [architecture/COSTBOOK_DOMAIN_ARCHITECTURE.md](architecture/COSTBOOK_DOMAIN_ARCHITECTURE.md). C001 provides the workspace foundation: `app/modules/costbook`, `GET /api/v1/costbook/workspace`, `costbook.read`/`costbook.write`/`costbook.manage`, forced-RLS workspace foundation tables, and the `/costbook` web route. C002 adds Materials catalog foundation only: `GET/POST /api/v1/costbook/materials`, `GET/PATCH /api/v1/costbook/materials/:id`, strict validated material DTOs over the existing organization-scoped `Material` model, unit-cost audit writes on update, and `/costbook/materials`. C003 adds Labor Rates foundation. C004 adds the equipment catalog foundation under `/api/v1/costbook/equipment` and `/costbook/equipment` without introducing a duplicate equipment table. C005 completes Division/Category/Subcategory hierarchy CRUD, and merged migration `20260812173000_harden_costbook_hierarchy_rls` adds explicit parent-derived tenant predicates plus bidirectional activity-integrity enforcement. Labor engine, assembly builder, pricing calculations, estimate integration, price-history engine, supplier sync automation, Athena recommendations, and autonomous Costbook writes are still future work.
- Supplier integration feed ingestion is scaffolded around a stub fetcher; queue, review, audit, and scheduling plumbing are real
- Customer portal exists for proposal, contract, invoice, and project views, but hardening is still tracked as RC work
- Structured AI estimator drafts remain review-first; they do not autonomously write estimate line items and do not call external model APIs in the current implementation
- Structured AI estimator apply now uses server-signed review tokens, server-side active target validation, per-estimate apply serialization, and optional estimate-line `sourceKey` duplicate protection for reviewed AI lines; Docker-backed live RLS integration verification passed locally on this branch
- Route-level `requirePermissions` checks were added to `app/backend/controllers/{aiEstimateAssist,crm,estimateEngine,projectTasks,proposals}.controller.ts`, closing a gap where those routes previously relied on org-membership alone (no route-level permission check). Customer and estimate mutation endpoints also now record `ActivityTimelineService` events (see [modules/activity-and-intelligence.md](modules/activity-and-intelligence.md)).

## Recent verified changes

- A12.1 transactional canonical-event reliability is implemented on PR #191 and remains gated on protected verification before merge. It reuses the existing `athena_events`/`athena_event_deliveries` outbox, adds transactional service wrappers for the six production canonical publishers, preserves the newer savepoint isolation already on `main`, uses conflict-safe idempotent insertion for concurrent same-key publication, and includes a live PostgreSQL rollback plus two-session race test. This does not add A13 work, another event bus, a scheduler, new permissions, or production subscriber execution.
- Athena foundation hardening merged as PR #200 (`c2121f5c60059bc8f38546dad45755e566eceae0`): the registry/router/action/kernel seams described above are now on `main`. The merge does not imply production activation; `ATHENA_KERNEL_ENABLED` and the existing rollout controls remain the authority for runtime enablement.
- Web app-route auth proxy hardening: unauthenticated requests to authenticated web route families now redirect to `/login` from `web/src/proxy.ts`/`web/src/lib/supabase/proxy.ts` before the `(app)` route tree can render or stream protected page content. The matcher now covers `/athena`, `/brand-studio`, `/costbook`, `/customers`, `/dashboard`, `/dispatch`, `/finish-setup`, `/portal`, `/projects`, and `/settings`. This fixes the production-observed behavior where unauthenticated protected routes could return HTTP 200 with a streamed `NEXT_REDIRECT` marker instead of an upfront redirect. Public `/login` and `/signup` remain outside the proxy matcher. Regression coverage in `web/src/lib/supabase/proxy.test.ts` pins both the unauthenticated redirect gate and the protected-route matcher set.
- Web font/build reliability: the root web layout no longer imports `next/font/google`. The existing TradeOS font CSS-variable names remain stable, but they now resolve through installed/system fallback stacks in `globals.css`, removing build-time dependence on Google Fonts and Turbopack's external Google-font loader. This is a presentation/build-reliability change only; component behavior, application routing, backend APIs, auth, RLS, and database behavior are unchanged.
- Project Athena A7 Memory repair: `AthenaMemoryService` now exposes only active, unexpired caller-visible memories; corrected and expired rows are no longer retrievable through `getById`. User/conversation memory remains exact-actor scoped and organization memory remains exact-organization scoped. Contract-recognized `project`/`job` memory now fails closed at both the service and forced-RLS layers until explicit object-scope authorization is implemented, replacing the rejected org-wide-read default. Deterministic write policy, source attribution, correction/supersession, forgetting, retention metadata, the lazy user-memory context provider, and the dormant post-action memory hook remain infrastructure-only; no production memory extraction, business-tool execution, semantic retrieval, or autonomous write path is enabled.
- Project Athena A8 Event integration adds `AthenaEvent`, `AthenaEventDelivery`, and `AthenaEventDeadLetter` persistence plus an idempotent publisher, static subscriber registry, retry/dead-letter handling, and replay helper. Delivery failure reasons are stored as safe reason codes rather than raw exception messages. The implementation remains dark infrastructure: no autonomous Athena action, no proposal-route response contract change, and no production subscriber dispatch loop is enabled.
- C001 Costbook Workspace Foundation: a bounded Costbook module now exposes the unified read-only workspace summary at `GET /api/v1/costbook/workspace`, guarded by `costbook.read` and backed by org-scoped counts from the existing catalog tables. `costbook.read`, `costbook.write`, and `costbook.manage` are shared domain permissions; owner/admin have full Costbook access, dispatcher, technician, and legacy estimator have read-only Costbook access, and viewer has no Costbook permission. Migration `20260811120000_add_costbook_workspace_foundation` adds `costbook_workspaces` and `costbook_workspace_events` with organization scoping, forced RLS, owner/admin-managed writes, and event/workspace organization guardrails. The web app has a `/costbook` route and dashboard/nav links that show live catalog counts and empty/error states. No materials CRUD, labor engine, assemblies builder, pricing calculations, estimate integration, price-history engine, or Athena behavior changed.
- C002 Materials Catalog Foundation: the existing organization-scoped `Material` table is now managed through the unified Costbook boundary. `GET /api/v1/costbook/materials` and `GET /api/v1/costbook/materials/:id` require `costbook.read`; `POST /api/v1/costbook/materials` and `PATCH /api/v1/costbook/materials/:id` require `costbook.write`; strict validation rejects caller-supplied organization IDs, out-of-scope pricing fields, blank/null unit costs, and unit costs outside the existing database precision. The legacy `/api/v1/materials/*` compatibility route group now shares that same Costbook read/write permission boundary. Owner/admin can create and update materials, dispatcher/technician/legacy estimator can view but not write, and viewer has no Costbook access. Same-organization supplier IDs are validated before linking, cross-organization material IDs return 404, supplier price update approve/reject routes require `costbook.write`, and unit-cost changes write the existing material price-audit record. The existing `materials` table already had forced RLS from `20260623180000_enable_org_rls`; migration `20260811130000_restrict_costbook_material_writes` tightens existing material and material-price-audit writes to the owner/admin Costbook boundary without adding a duplicate material table. The web app now has `/costbook/materials`, linked from the Materials count on `/costbook`, with real API data, route loading skeleton, load-error state, empty state, read-only state, and permission-aware create/edit controls. No labor engine, equipment workflow, assembly builder, pricing calculation, estimate integration, price-history engine, supplier sync automation, Athena recommendation, or autonomous write behavior was added.
- C003 Labor Rates Foundation: the existing organization-scoped `labor_rates` table is now managed through the unified Costbook boundary with foundational `role`, optional `description`, `hourlyCost`, `billRate`, and `active` fields added in place. `GET /api/v1/costbook/labor-rates` and `GET /api/v1/costbook/labor-rates/:id` require `costbook.read`; `POST /api/v1/costbook/labor-rates` and `PATCH /api/v1/costbook/labor-rates/:id` require `costbook.write`; and `DELETE /api/v1/costbook/labor-rates/:id` requires `costbook.manage` and soft-deactivates the row through `active=false`. Strict validation rejects caller-supplied organization IDs, blank roles, blank/null numeric values, negative numeric values, and values outside the `numeric(10,2)` precision before writes reach the database. The legacy `/api/v1/labor-rates/*` compatibility route group now shares the same Costbook permission boundary, and forced-RLS writes now align to the owner/admin Costbook boundary through `current_app_can_manage_costbook()`. The web app now has `/costbook/labor-rates`, linked from the Labor Rates count on `/costbook`, with real API data, route loading skeleton, load-error state, empty state, read-only state, edit controls for writers, and deactivate controls for managers. This slice does not add labor burden calculations, pricing engine logic, estimate integration, supplier automation, Athena recommendations, or autonomous writes.
- C004 Costbook Equipment Catalog Foundation (merged via PR #183): the existing organization-scoped `equipment` table is managed through the unified Costbook boundary. `GET /api/v1/costbook/equipment` and `GET /api/v1/costbook/equipment/:id` require `costbook.read`; `POST` and `PATCH` require `costbook.write`; `DELETE` requires `costbook.manage` and remains a hard delete with explicit UI confirmation. Migration `20260811150000_restrict_costbook_equipment_writes` narrows the existing forced-RLS equipment write policy to `current_app_can_manage_costbook()` without duplicating the table or its earlier `ENABLE/FORCE ROW LEVEL SECURITY` setup. Live PostgreSQL integration coverage proves tenant-scoped reads, owner write success, technician create/update denial, and cross-organization write denial. Hourly cost is derived with cent-safe decimal handling from ownership plus operating cost; `dailyRate` is optional and PATCH can clear it to null. The `/costbook/equipment` route exposes real API data with loading, error, empty, read-only, create/edit/delete, and responsive catalog states. This slice does not add equipment utilization, depreciation schedules, pricing-engine integration, supplier automation, or Athena recommendations.
- C005 Costbook Hierarchy Management: the existing `Division`, `Category`, and `Subcategory` tables (previously list + create only, unlike `CostItem`'s full CRUD) are managed through the unified Costbook boundary. `GET/PATCH/DELETE /api/v1/costbook/divisions/:id`, `.../categories/:id`, and `.../subcategories/:id` (plus list/create) require `costbook.read`/`costbook.write`/`costbook.manage` respectively, matching the C003 permission split. Migration `20260812120000_add_costbook_hierarchy_foundation` adds an `isActive` column to all three tables (default `true`) and tightens direct hierarchy writes to `current_app_can_manage_costbook()` (owner/admin). Merged migration `20260812173000_harden_costbook_hierarchy_rls` makes the inherited tenant boundary explicit: Category/Subcategory write predicates verify the authenticated organization through parent joins; active children cannot be created or reactivated beneath inactive ancestors; and a Division/Category cannot be deactivated while it still has active Category/Subcategory descendants. Live PostgreSQL integration coverage independently verifies cross-organization RLS rejection and both directions of activity integrity. Delete remains soft-deactivate only; child rows are never cascade-deleted through the API. The web app has `/costbook/divisions`, an expandable Division → Category → Subcategory tree linked from the Categories count on `/costbook`, with inline create/edit forms and deactivate controls gated on the same Costbook permission summary as materials/labor-rates. This slice does not add labor engine, equipment utilization, assembly builder, pricing calculation, estimate integration, or Athena recommendation behavior.
- Owner dashboard AI-placeholder audit: the disabled `AI Assistant` foundation slot is replaced by a deterministic `Owner Briefing` that reads the existing dispatch summary, org-scoped project-task feed, and current-week recorded-payment ledger. It surfaces schedule pressure, overdue/blocked task pressure, and transaction-backed weekly revenue with direct links to Dispatch, Overdue Tasks, and Revenue This Week. Each read degrades to `Unavailable` independently. The briefing makes no model call, does not call an Athena execution endpoint, performs no autonomous write, and explicitly keeps Athena business-tool execution off until the roadmap's A12 rollout. The old `AIAssistantPlaceholderPanel` export remains only as a compatibility alias to avoid unrelated parent-dashboard churn.
- Dashboard knowledge/lifecycle audit: the existing Knowledge Runtime Coverage card remains backed by live `GET /api/v1/knowledge/stats` data but is no longer a dead-end summary; `/dashboard/knowledge-coverage` now reads the existing stats and trades endpoints to show live trade coverage, assemblies, cost items, indexed keywords, source/runtime health, and load warnings without adding AI execution or writes. The dashboard section previously labeled `Operational queues` was audited and found to be a recent-eight-project lifecycle snapshot, not an organization-wide queue; it is now truthfully labeled `Recent project lifecycle` and states that scope explicitly while preserving direct project navigation. No backend endpoint, RLS policy, schema, lifecycle write, payment path, or Athena behavior changed.
- Revenue This Week is now transaction-backed instead of inferred from invoice paid state: `GET /api/v1/payments/current-week` reads organization-scoped persisted `Payment` rows with status `recorded` under the existing authenticated request/database-session boundary, requires `billing.read`, computes Sunday-to-Sunday boundaries in the organization timezone with explicit UTC fallback, and returns invoice/project/customer context. The dashboard KPI and `/dashboard/revenue-this-week` use the same ledger response, so the total reconciles by construction; the drill-down shows amount, payment date, method, reference, notes, and invoice links. If the ledger read fails, Revenue shows `Unavailable` rather than substituting paid-invoice totals. No payment-write behavior, database schema/RLS policy, public payment processing, or Athena behavior changed.
- Owner-dashboard KPI drill-downs now preserve source-of-truth alignment instead of stopping at summary numbers: Open Estimates links to the exact draft/ready estimate rows already rendered in `NeedsAttentionCard`, Invoices Waiting links to the exact sent/overdue/partially-paid invoice rows there, and Overdue Tasks opens `/dashboard/overdue-tasks`, which reuses the same org-scoped 24-task feed, organization timezone, and calendar-date due-bucket rules as the KPI count. Today’s Jobs and Unscheduled Jobs retain their existing filtered Dispatch drill-downs. Revenue This Week is handled by the transaction-backed payment-ledger drill-down above. No Athena behavior changed.
- Dashboard weather widget (`web/src/lib/weather.ts`) is now real, as a direct follow-up to the UI sprint below: the header's "Weather" tile previously removed as fabricated is back, backed by a live National Weather Service forecast for **today's first scheduled job's project site address** (not a generic company-wide forecast — a rain delay only matters relative to where the crew is actually working). Flow: US Census Bureau geocoder (free, keyless) turns the site address into lat/lon, then `api.weather.gov`'s points → forecast endpoints (free, keyless, requires only a `User-Agent` header) return the most relevant current or next forecast period's temperature, short forecast, and precipitation chance instead of blindly taking the first period row. Both external calls use Next's fetch cache with a 30-minute revalidate. No job scheduled today, no site address on file, or any geocode/NWS failure all degrade to an honest "No forecast for today's job site" state rather than fabricating or crashing — matching this dashboard's existing no-fabrication posture. Entirely `web/`-side (no `app/` backend change, no new env var, no secret — NWS needs no API key); wired into `web/src/app/(app)/dashboard/page.tsx` and `owner-dashboard-header.tsx`.
- Dashboard UX modernization (`web/src/app/(app)/dashboard/page.tsx`, `web/src/components/dashboard/**`, `web/src/components/shared/app-nav.tsx`, `web/src/app/globals.css`): the authenticated app shell now uses a cooler neutral + electric-blue token pass, a clearer split navigation hierarchy, and denser RC1 dashboard composition. The owner dashboard now leads with a review-queue header, keeps the action queue ahead of KPI scan cards, standardizes repeated section framing through `DashboardPanel`, and upgrades schedule/task/quick-action cards to a cleaner, more consistent visual system without introducing new backend endpoints or fabricated workflow data.

## Known blockers and unresolved technical debt

- Supplier feed connectors are not live
- Cost-item and assembly combined name-or-code substring search can still degrade into scan-heavy plans because only `name` columns are trigram-indexed today
- Documentation governance is implemented; ongoing governance work should update `docs/DOC_OWNERSHIP.yml`, `docs/README.md`, and `docs/REPOSITORY_GOVERNANCE.md` together when ownership policy changes
- Production deployment state and environment approvals are not inferred from code and must be verified per environment
- Some older implementation notes and planning artifacts required archiving because they conflicted with the live repository
- Settings brand asset uploads (`uploadSettingsAssetAction`) use the private `project-files` bucket through a server-only Supabase service-role client and authenticated proxy; no service credential or direct public/signed Supabase Storage URL is returned to the browser
- Settings brand asset uploads can leave an orphaned storage object if a user uploads a file but abandons the settings form before pressing "Save changes" — non-blocking, no cleanup logic exists for this yet
- Knowledge Runtime deployment packaging now has two production-path protections: `app/scripts/vendor-knowledge-engine.js` copies the read-only Knowledge Engine data into `app/vendor/knowledge-engine/` during backend build, and `app/vercel.json` includes `vendor/knowledge-engine/**` in the `index.ts` function bundle. `app/modules/knowledge-runtime/loader.ts` checks the process-root vendored path first, then source-layout and compiled-`dist` relative candidates, before falling back to full-repository local/CI discovery. This changes deployment packaging only; knowledge APIs, estimator review behavior, auth, RLS, and write paths are unchanged.

## Recent verified infrastructure facts

- the repository now includes `20260804020000_harden_database_security_boundaries`, which enables RLS on Prisma migration history without forcing it for the table-owning migration administrator, revokes runtime/public migration-history privileges, pins the eight existing RLS helper functions to an empty search path, and replaces three permissive auth-record update checks with guarded policies plus immutable identity triggers
- `app/scripts/sql/provision-app-role.sql` reapplies the `_prisma_migrations` privilege exception after its broad runtime table grant, preserving the boundary on every idempotent role provisioning run
- static migration regression coverage, the PostgreSQL parser check, all 437 backend unit tests, TypeScript lint, and the backend build passed before the security-hardening change merged as PR #65; GitHub Actions also completed the Docker-backed live RLS integration suite successfully
- merging application or migration code does not change the live database by itself; normal production rollout remains manual and Environment-approval-gated through the tracked migration deployment workflow
- migration `20260703090000_add_search_trgm_indexes` enables PostgreSQL `pg_trgm`
- the migration adds GIN trigram indexes on `cost_items.name`, `assemblies.name`, `materials.name`, and `suppliers.name`
- this supports the current case-insensitive substring-search behavior used by cost-item and assembly name search, and it covers representative name-search patterns for materials and future supplier search surfaces
- RLS behavior is unchanged because the indexes only affect query planning, not tenancy enforcement
- verification state: the migration is merged on `main`; the PR notes local migration and `EXPLAIN` verification on a throwaway Postgres 18 cluster, while the repository's own `npm run test:integration` harness was still recommended separately in that PR

## Current verification surface

Backend commands defined in `app/package.json`:

- `npm test`
- `npm run test:integration`
- `npm run lint`
- `npm run build`

Frontend commands defined in `web/package.json`:

- `npm run lint`
- `npm run build`
- `npm test` (framework-free `node --test` against `src/**/*.test.ts`; today this is `web/src/lib/envSecurity.test.ts`, which statically checks that `SUPABASE_SERVICE_ROLE_KEY` never leaks into a `NEXT_PUBLIC_`-prefixed name and never becomes reachable from a `"use client"` import graph)

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
