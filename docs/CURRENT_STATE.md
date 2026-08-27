Warning: truncated output (original token count: 20265)
Total output lines: 306

---
status: current
owner: platform
last_verified: 2026-08-25
source_of_truth: true
related_code:
  - app/modules/auth
  - app/backend/controllers/auth.controller.ts
  - app/backend/controllers/adminDashboard.controller.ts
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
  - web/src/app/(app)/dashboard/dashboard-work-queue-resilience.test.ts
  - web/src/app/(app)/dashboard/dashboard-startup.ts
  - web/src/lib/payment-ledger.ts
  - web/src/components/dashboard/needs-attention-card.tsx
  - web/src/components/dashboard/needs-attention-model.ts
  - web/src/components/dashboard/needs-attention-model.test.ts
  - web/src/components/dashboard/owner-dashboard-data.ts
  - web/src/components/dashboard/owner-dashboard-header.tsx
  - web/src/components/dashboard/owner-dashboard-header-model.ts
  - web/src/components/dashboard/owner-dashboard-header-model.test.ts
  - web/src/components/dashboard/owner-dashboard-greeting.tsx
  - web/src/lib/intelligence.ts
  - web/src/lib/api.ts
  - web/src/lib/work-queue-params.ts
  - web/src/lib/work-queue-params.test.ts
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
  - app/modules/athena-action-engine
  - app/prisma/migrations/20260814200000_add_athena_action_idempotency/migration.sql
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

Last reconciled against origin/main commit d8e07606737de561b7cbed4e0be72ce875fae73c on 2026-08-25 after S030 implementation merge and completion reconciliation.

## Current milestone

TradeOS is in RC1 hardening.

The repository is no longer organized around MVP planning documents. The active posture is production readiness, lifecycle consistency, verification, and contractor-facing polish.

## Implemented modules

- Auth and tenancy
- CRM: customers, service addresses, customer equipment, service agreements, notes, company profile
- Projects and project workspace
- Site visit intake: intake saves can capture notes, measurements, and project photos; if a later photo-metadata write fails after earlier metadata rows were persisted, the action compensates those persisted rows before storage cleanup. If metadata compensation itself fails, the corresponding storage object is preserved so surviving metadata never points at an object the action deleted, and cleanup failures do not mask the original intake error.
- Cost book: divisions, categories, subcategories, cost items, labor, materials, equipment, assemblies
- Costbook workspace foundation and materials catalog: unified `/api/v1/costbook/workspace` and `/api/v1/costbook/materials` boundaries, Costbook-specific permission keys, org-scoped workspace foundation tables, organization-scoped material reads/writes, and `/costbook` plus `/costbook/materials` web routes with live catalog data and honest loading/empty/error states
- Costbook equipment catalog foundation (C004, merged via PR #183): organization-scoped equipment list/detail/create/update/delete under `/api/v1/costbook/equipment`, legacy equipment-route permission alignment, owner/admin-managed forced-RLS writes, cent-safe hourly-cost derivation, nullable daily-rate clearing, and `/costbook/equipment` with real-data loading/error/empty/read-only/mutation states. PR #203 adds a bounded 15-second equipment-page load timeout and locks editable form state/transitions while save or delete mutations are pending.
- Costbook hierarchy management (C005): full Division/Category/Subcategory CRUD under `/api/v1/costbook/{divisions,categories,subcategories}` and `/costbook/divisions`, with owner/admin-only hierarchy writes, explicit parent-derived tenant predicates for Category/Subcategory RLS, cross-organization parent rejection, active-child guards beneath inactive ancestors, and parent-deactivation guards that prevent active descendants from being stranded beneath an inactive Division or Category
- Costbook CostItem management: canonical `/api/v1/costbook/cost-items` routes and `/costbook/cost-items` reuse the existing `CostItem` model, `CostDatabaseService`, legacy compatibility routes, and relationship-derived unit-cost formulas. Reads require `costbook.read`, ordinary writes require `costbook.write`, lifecycle activation/deactivation requires `costbook.manage`, strict request validation rejects caller-controlled organization IDs, and service-level checks reject cross-organization Subcategory/LaborRate/Material/Equipment/Subcontractor references before writes. CostItem delete remains soft-deactivate so existing Estimate references are preserved.

## PT-001 estimate-to-invoice value transfer

Estimate-backed invoice creation now consumes the persisted customer-facing
`Estimate.totalPrice` rather than rebuilding the invoice from raw direct
line costs. That total, including persisted tax, is allocated across existing
invoice lines in proportion to each persisted line `lineCost` share of
`Estimate.subtotalCost`, with cent rounding and any residual assigned to the
largest line. Progress invoices scale the same total. Explicit non-empty
`lineItems` continue to override estimate resolution. Custom
line-item invoice creation and existing invoice/payment records are unchanged.
Invoice rows expose the accurate application/API selling-price names `unitPrice`
and `lineTotal` while Prisma intentionally maps them to the existing physical
`unit_cost` and `line_cost` columns for deployment and rollback compatibility.
No database column rename or migration is required for this naming correction.
