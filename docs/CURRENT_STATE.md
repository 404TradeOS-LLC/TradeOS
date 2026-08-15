---
status: current
owner: platform
last_verified: 2026-08-15
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
  - app/modules/assemblies-database
  - app/modules/supplier-integration
  - app/modules/estimate-engine
  - app/backend/controllers/costDatabase.controller.ts
  - app/backend/controllers/assembliesDatabase.controller.ts
  - app/backend/controllers/costbookPricing.controller.ts
  - app/backend/routes/costbook.routes.ts
  - app/prisma/migrations/20260811120000_add_costbook_workspace_foundation/migration.sql
  - app/prisma/migrations/20260811130000_restrict_costbook_material_writes/migration.sql
  - app/prisma/migrations/20260811150000_restrict_costbook_equipment_writes/migration.sql
  - app/prisma/migrations/20260812120000_add_costbook_hierarchy_foundation/migration.sql
  - app/prisma/migrations/20260812173000_harden_costbook_hierarchy_rls/migration.sql
  - app/prisma/migrations/20260814221000_restrict_costbook_assembly_writes/migration.sql
  - web/src/app/(app)/costbook
  - web/src/components/costbook
---

# Current State

Last reconciled against merged `main` commit `3c3037faf5c7c3b4f3660b6f43cc6a3b90372e4e` on 2026-08-15. That commit is the squash result of PR #210 and makes first-class CostItem management canonical on `main`. The continuation branch `feature/costbook-practical-pricing-reconciled` is one clean branch lineage on top of that merged result and contains the next five reconciled Costbook slices described below. Repository state does not by itself prove production deployment state, which remains governed by the deployment workflows and target platform.

## Current milestone

TradeOS is in RC1 hardening. The active posture is production readiness, lifecycle consistency, verification, contractor-facing polish, and reconciliation-first extension of existing domains rather than duplicate implementations.

## Costbook continuation truth

This section is authoritative for the Costbook continuation branch. Where older Costbook planning or historical notes elsewhere in the repository conflict with it, this reconciled implementation state takes precedence for this branch.

- **CostItem management is merged.** PR #210 landed at `3c3037faf5c7c3b4f3660b6f43cc6a3b90372e4e`, reusing `CostItem`, `CostDatabaseService`, relationship-derived pricing, legacy compatibility routes, and existing RLS. Tenant context is explicit for CostItem create/update/subcategory reads, linked catalog references are same-organization validated, lifecycle changes require `costbook.manage`, and an explicitly supplied missing/cross-organization pricing region fails closed with 404.
- **Assembly management is promoted, not rebuilt.** The continuation exposes the existing `Assembly`/`AssemblyItem` service under `/api/v1/costbook/assemblies` and `/costbook/assemblies`, including list/search/templates/detail/unit-cost/component composition/create/edit/deactivate. New components require active same-organization CostItems or child Assemblies and retain cycle protection. Migration `20260814221000_restrict_costbook_assembly_writes` adds DB defense in depth for Costbook-management writes and cross-tenant AssemblyItem relationships.
- **Estimate pricing is snapshot/provenance based.** Existing Estimate integration remains canonical. `costItemId` or `assemblyId` is persisted provenance; `unitCost` and `lineCost` are historical snapshots. Existing-line recalculation uses persisted line costs rather than live Costbook repricing, new lines capture current cost at creation, and duplication/versioning preserves stored source/pricing values. No second Estimate integration or Athena Estimate write path is added.
- **Practical pricing is calculation-only.** `POST /api/v1/costbook/pricing/preview` and `/costbook/pricing` reuse the Estimate Engine's overhead/markup/target-margin/sell-price formulas. There is no saved organization pricing-policy/rules table in this slice.
- **Price history is a read model over real sources.** `GET /api/v1/costbook/price-history` and `/costbook/price-history` distinguish actual `MaterialPriceAudit` catalog changes from persisted Estimate pricing snapshots. Estimate snapshots are historical consumption observations, not catalog price-change events. The route is tenant-scoped, bounded, filterable, and management-only.
- **Supplier synchronization remains governed.** The existing SupplierIntegrationService queue/review/audit/worker/scheduler stays canonical. The added transport reads only trusted server-side `SUPPLIER_PRICE_FEED_ENDPOINTS` mappings, requires HTTPS, validates/bounds responses, keeps credentials server-side, and only enqueues pending price proposals. It never auto-mutates Material prices. Approval remains an owner/admin management action and the existing transactional Material update + `MaterialPriceAudit` path remains authoritative. No supplier-SKU matching layer is claimed.
- **No Athena Costbook writes are introduced.** Athena remains outside this Costbook continuation's mutation scope.

## Implemented modules

- Auth and tenancy
- CRM: customers, service addresses, customer equipment, service agreements, notes, company profile
- Projects and project workspace
- Site visit intake
- Cost book: workspace, materials, labor rates, equipment, Division/Category/Subcategory hierarchy, CostItems, Assemblies, practical pricing preview, and price-history read model
- Estimating: estimate creation, CostItem/Assembly line-item pricing snapshots, duplication, comparison, AI estimate assist, and structured contractor-language draft generation
- Proposals
- Contracts
- Invoices and payment recording
- Change orders
- Jobs and scheduling: job creation, assignment, scheduling, rescheduling, dispatcher coordination, and field-status workflows
- Project tasks
- Activity, notifications, recents, saved views, feature flags, and search-oriented intelligence primitives
- Owner dashboard foundation with live operational queues, schedule, task, payment-ledger, knowledge, weather, and navigation surfaces
- Brand Studio
- Settings and organization operations
- Customer portal document views
- Supplier records plus supplier price-proposal review queue, scheduler/worker plumbing, and trusted configurable feed transport
- Knowledge runtime integration
- Backend structured AI estimator orchestration that stages contractor-language scopes into reviewable estimate drafts using existing Costbook and Estimate Engine services
- Project Athena A1-A12 foundations remain present and governed by their existing feature flags, security, approval, audit, event, observability, and tool boundaries; this Costbook continuation does not expand Athena Costbook writes

See module docs in `docs/modules/` for detailed contracts.

## Partially implemented or compatibility-layer areas

- Legacy role values `estimator` and `viewer` are still tolerated in stored data but normalize to canonical roles.
- Project lifecycle persistence still contains legacy values such as `proposal_sent` and `accepted`; UI/shared contracts normalize these for display.
- Contract persistence still stores `pending_signature`; lifecycle docs treat it as compatibility storage.
- Costbook practical pricing is a preview calculator, not persisted organization-wide pricing policy.
- Costbook price history is a read model over `MaterialPriceAudit` plus Estimate snapshots, not a generic history-event persistence system.
- Supplier feeds require trusted operator configuration per supplier and already-resolved TradeOS `materialId` values; supplier SKU/product matching is not implemented.
- Customer portal exists for proposal, contract, invoice, and project views, with remaining RC hardening tracked separately.
- Structured AI estimator drafts remain review-first; they do not autonomously write Costbook catalog prices.

## Recent verified changes

- **PR #210 / CostItem management:** merged at `3c3037faf5c7c3b4f3660b6f43cc6a3b90372e4e`. Canonical `/api/v1/costbook/cost-items` routes and `/costbook/cost-items` reuse the existing model/service/formulas, enforce `costbook.read`/`write`/`manage`, reject caller-controlled org scope and cross-org references, preserve nullable-link clearing and soft deactivation, and include focused plus live PostgreSQL RLS coverage.
- **Costbook practical continuation (PR #216 draft):** re-anchored directly onto the #210 merged main result and intentionally reuses existing Assembly, Estimate formula, MaterialPriceAudit, and SupplierIntegration systems. It adds first-class Assembly management, Estimate snapshot verification, pricing preview, price-history reads, and trusted supplier feed transport without Athena Costbook writes or automatic supplier price application.
- Athena approval read normalization on PR #207 conditionally and atomically transitions overdue approvals still persisted as `pending` to `expired` before organization-scoped list/detail reads; it does not change this Costbook work.
- A12.1 transactional canonical-event reliability remains merged from PR #191 and keeps its existing transaction semantics; this Costbook continuation does not alter those event contracts.
- Athena foundation hardening from PR #200 remains merged and feature-flag governed; repository presence does not imply production activation.
- Web auth-proxy, font/build reliability, dashboard, dispatch, customer, weather, settings-asset, knowledge-runtime packaging, and production auth repairs remain part of the broader RC1 repository state and are unaffected by the Costbook continuation.

## Known blockers and unresolved technical debt

- Persisted organization-wide Costbook pricing policies/rules are not implemented; current practical pricing is calculation-only.
- Supplier-specific SKU/product matching and provider-specific adapter semantics beyond the trusted generic feed contract remain future work.
- CostItem/Assembly combined name-or-code substring search can still degrade into scan-heavy plans because current trigram indexes are name-focused; optimize only from measured query plans.
- Production deployment state and environment approvals are not inferred from code and must be verified per environment.
- Supplier feed transport existing in code does not mean every Supplier is configured; absent mapping remains an honest unconfigured/no-op state.
- No Athena Costbook write expansion is considered complete or ready merely because the non-Athena Costbook workflows exist.

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

Current CI workflows include `.github/workflows/verify-repository.yml` for backend/frontend verification and live integration/migration rehearsal plus the separate docs-consistency and security checks. Database rollout remains approval-gated; merging migration code alone does not apply it to production.

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
