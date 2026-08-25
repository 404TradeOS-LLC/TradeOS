---
status: verified
owner: platform
last_verified: 2026-08-25
source_of_truth: true
related_docs:
  - docs/architecture/S041_RLS_POLICY_COVERAGE_PLAN.md
  - docs/RBAC_MATRIX.md
  - docs/ARCHITECTURE.md
related_code:
  - app/prisma/schema.prisma
  - app/prisma/migrations/20260623180000_enable_org_rls/migration.sql
  - app/prisma/migrations/20260703190000_add_intelligence_foundation/migration.sql
  - app/prisma/migrations/20260804020000_harden_database_security_boundaries/migration.sql

# S041 — RLS Policy Coverage Inventory

This inventory covers all 73 Prisma-mapped tables in `app/prisma/schema.prisma`
plus the raw-SQL Athena idempotency table. The cumulative migration evidence
enables and forces RLS for each application table; the initial organization-RLS
migration uses explicit statements for identity/inherited tables and a bounded
tenant-table loop for the remaining direct-tenant tables. Later migrations add
the same forced-RLS floor for new tables.

| Classification | Tables | Policy evidence |
| --- | --- | --- |
| control-plane | `organizations`, `organization_settings`, `users`, `organization_memberships`, `organization_membership_audits`, `organization_invites`, `auth_refresh_tokens`, `password_reset_tokens`, `user_totp_credentials`, `settings_asset_uploads`, `brand_profiles`, `brand_assets`, `brand_document_settings`, `costbook_workspaces`, `costbook_workspace_events`, `feature_flags` | Organization-RLS migrations; identity guards and restricted migration-history handling in `20260804020000_harden_database_security_boundaries` |
| Direct tenant costbook | `divisions`, `regions`, `suppliers`, `materials`, `material_price_audits`, `supplier_price_updates`, `labor_rates`, `equipment`, `subcontractors`, `cost_items`, `assemblies` | Organization-RLS tenant-table inventory plus later Costbook migrations; application permission gates are finer than the tenant policy |
| Parent-inherited estimating | `categories`, `subcategories`, `assembly_items`, `customers`, `service_addresses`, `customer_equipment`, `projects`, `estimates`, `estimate_line_items`, `change_orders`, `change_order_line_items`, `proposals`, `site_visits`, `project_tasks`, `project_files` | Explicit parent/inherited policies in organization-RLS migrations and module migrations; route permissions remain required |
| direct-tenant | `jobs`, `job_assignments`, `job_equipment`, `invoices`, `invoice_line_items`, `payments`, `service_agreements`, `contracts`, `proposal_deliveries`, `invoice_deliveries`, `contract_events` | Organization-scoped policy migrations and service-boundary authorization |
| actor-scoped | `activity_events`, `notifications`, `attachments`, `comments`, `tags`, `tag_assignments`, `saved_views`, `recent_items` | Intelligence foundation and organization-RLS policy migrations; actor/organization predicates are documented at the service boundary |
| direct-tenant | `athena_executions`, `athena_execution_transitions`, `athena_telemetry_records`, `athena_generation_runs`, `athena_generation_reviews`, `athena_memories`, `athena_events`, `athena_event_deliveries`, `athena_event_dead_letters`, `athena_alerts`, `athena_approvals`, `athena_audit_events` | Athena migrations explicitly enable and force RLS; policies use organization and actor context as applicable |
| Raw-SQL-owned idempotency | `athena_action_idempotency` | `20260814200000_add_athena_action_idempotency/migration.sql` explicitly creates the table, enables RLS, forces RLS, and applies organization/actor-scoped policies |

## Boundary findings

- No table in the inventory is intentionally outside forced RLS. `_prisma_migrations`
  is migration infrastructure rather than an application model and is handled by
  the security-hardening migration with restricted runtime privileges.
- Generic tenant write policies are a database floor, not a replacement for
  product authorization. S041 therefore gates change-order mutations with
  `billing.write` and supplier mutations with `costbook.manage`.
- The request session preserves raw supported SQL roles because legacy `viewer`
  and `estimator` have intentionally narrower RLS semantics than their
  application compatibility aliases. Cross-organization access continues to be
  denied by request-scoped forced RLS.
