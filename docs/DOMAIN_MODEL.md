---
status: current
owner: platform
last_verified: 2026-08-15
source_of_truth: true
related_code:
  - app/prisma/schema.prisma
  - app/domain/contracts.ts
  - app/modules/athena-memory
  - app/modules/athena-events
  - app/modules/athena-observability
  - app/modules/assemblies-database
  - app/prisma/migrations/20260814221000_restrict_costbook_assembly_writes/migration.sql
---

# Domain Model

This file defines the canonical business entities as implemented in the repository.

## Organization

The tenant boundary for all application data.

- persistent model: `Organization`
- owns memberships, cost-book records, customers, projects, jobs, activity, document history, settings, and branding
- Settings Console brand asset storage location (bucket/path/content type/size, not the bytes themselves) is tracked per organization in `SettingsAssetUpload`, one row per `(orgId, assetKey)` for the four brand asset fields (`logoUrl`/`darkLogoUrl`/`iconUrl`/`watermarkUrl`); see [modules/settings-and-operations.md](modules/settings-and-operations.md)

## User

An authenticated identity stored in `AppUser`.

- organization access is not implied by user existence
- organization access comes through `OrganizationMembership`

## Authentication control records

`OrganizationInvite`, `AuthRefreshToken`, and `PasswordResetToken` are security-control records, not ordinary tenant-editable entities.

- invitation ownership (`orgId`, email, role, token, inviter, and expiry) is immutable after creation; invite acceptance may update only lifecycle fields such as status and acceptance time
- refresh-token ownership (`orgId`, user, membership, token, and expiry) is immutable after creation; rotation may update only usage, revocation, and replacement metadata
- password-reset-token ownership (`userId`, token, and expiry) is immutable after creation; reset completion may update only consumption metadata

These invariants are enforced in PostgreSQL as well as in application service behavior so a login-lookup transaction cannot reassign an existing auth record across organizations or users.

## Migration history

`public._prisma_migrations` is deployment control-plane state rather than application data. It remains writable by the Prisma migration administrator/table owner, has row-level security enabled, and is intentionally outside the runtime application role's table privileges.

## Customer

A company-scoped account or homeowner record stored in `Customer`.

- customers own the business relationship
- customers can have many projects, service addresses, equipment assets, service agreements, and jobs
- tenant customer listing/search is service-owned: `CrmService.listCustomers` always excludes soft-deleted rows, supports database-side case-insensitive name/email/phone search, and enforces a bounded result count before rows are loaded

## Service Address

A serviceable location for a customer stored in `ServiceAddress`.

- belongs to one customer and one organization
- can be attached to jobs, equipment assets, and service agreements

## Equipment

TradeOS currently has two equipment concepts:

- `CustomerEquipment` is the installed or serviced asset tied to a customer or service address
- `Equipment` in the cost-book area is estimating-rate data used for cost calculations

When product copy says "equipment" in field operations, it usually means `CustomerEquipment`.

## Project

The operational workspace hub stored in `Project`.

- belongs to one organization
- may be linked to one customer
- owns estimates, proposals, contracts, invoices, site visits, files, tasks, jobs, and service agreements

## Job

A first-class scheduled field-execution record stored in `Job`.

- belongs to one organization, project, customer, and service address
- is separate from the project record
- owns assignments and links to site visits, tasks, notes, and equipment

## Estimate

A priced commercial draft stored in `Estimate`.

- belongs to one project and organization
- owns estimate line items
- may feed proposals and invoices
- line items may include an optional `sourceKey` used by reviewed AI-estimator applies to reconcile retries; ordinary manual line items do not need one
- Costbook-backed `EstimateLineItem` rows retain `costItemId` or `assemblyId` as source provenance and persist `unitCost`/`lineCost` as historical pricing snapshots; later Costbook price changes do not silently mutate those persisted line values

## Proposal

A customer-facing commercial document stored in `Proposal`.

- belongs to one project
- may reference one estimate
- owns proposal delivery history
- can produce contracts and support invoices

## Contract

A signable commercial agreement stored in `Contract`.

- belongs to one project and one proposal
- owns contract event history

## Invoice

A billing document stored in `Invoice`.

- belongs to one project
- may reference an estimate and proposal
- owns invoice line items, payments, and delivery history

## Payment

A recorded payment event stored in `Payment`.

- belongs to one invoice and organization
- tracks amount, payment date, method, reference, notes, and status

## Change Order

A scoped commercial amendment stored in `ChangeOrder`.

- belongs to one project
- may reference one estimate
- owns change-order line items

## Site Visit

An intake and field-observation record stored in `SiteVisit`.

- belongs to one project
- may be linked to one job
- stores notes, transcript, intake details, measurements, missing information, and confidence metadata

## Activity Event

A generic tenant-scoped event record stored in `ActivityEvent`.

- keyed by `entityType` and `entityId`
- supports recent activity, notification linkage, and intelligence surfaces

## Athena kernel execution

Project Athena A1 kernel lifecycle/audit state, stored in `AthenaExecution`, `AthenaExecutionTransition`, and `AthenaTelemetryRecordRow`; see [athena/roadmap/A1-ai-kernel-implementation-plan.md](athena/roadmap/A1-ai-kernel-implementation-plan.md).

- `AthenaExecution` is actor-scoped, not merely org-scoped: RLS restricts each row to its `actorUserId` unless the reader is an org admin/dispatcher/owner
- `AthenaExecutionTransition` and `AthenaTelemetryRecordRow` inherit that same actor visibility through the parent `AthenaExecution` row
- none of these tables store a raw user message, model prompt, or model output - only safe summaries, error codes, and structural metadata
- the kernel is feature-flagged off (`ATHENA_KERNEL_ENABLED=false`) by default; see `app/modules/athena-kernel`

## Athena memory

Project Athena A7 durable assistant memory is stored in `AthenaMemory` rows behind `AthenaMemoryService`.

- every memory is tenant-scoped and carries scope, subject, source attribution, confidence, retention, lifecycle status, visibility, actor audit fields, and timestamps
- caller-facing retrieval exposes only active, unexpired records
- corrections supersede prior rows instead of overwriting them in place
- forgetting clears stored value/metadata while preserving minimal audit identity/status
- `user` and `conversation` scopes are exact-actor only; `organization` scope is exact-organization
- `project` and `job` scope values are contract-recognized but fail closed in A7 until explicit object-scope authorization exists at both the service and RLS layers
- Athena memory is not authoritative business state and does not replace projects, jobs, customers, estimates, invoices, payments, dispatch, or costbook records

## Athena events

Project Athena A8 event integration state is stored in `AthenaEvent`, `AthenaEventDelivery`, and `AthenaEventDeadLetter` rows behind `app/modules/athena-events`.

- `AthenaEvent` is the canonical tenant-scoped event envelope for dark Athena infrastructure, including event type/version, entity reference, actor reference, correlation id, idempotency key, occurrence time, and safe JSON payload
- `AthenaEventDelivery` tracks one subscriber delivery attempt stream per event/subscriber, including status, retry timing, attempt count, replay metadata, and safe failure reason code
- `AthenaEventDeadLetter` records exhausted delivery attempts with the event payload snapshot and safe failure reason code for future operator replay
- the original A8 rollout wired proposal send as the first production publisher; A12 additionally publishes `EstimateStarted`/`EstimateCompleted` from `EstimateEngineService` and `JobScheduled`/`TechnicianAssigned`/`WorkCompleted` from `JobsService`
- No production subscriber, scheduler, autonomous Athena action, or business-state authority is introduced by these tables

## Athena observability

Project Athena A10 observability adds one new table, `AthenaAlert`, plus indexes on the existing A1/A8 tables above (no new telemetry/execution/event tables - A10 is a read/derivation layer, not a second persistence system); see [athena/roadmap/A10-observability-implementation-plan.md](athena/roadmap/A10-observability-implementation-plan.md).

- `AthenaAlert` holds only derived operator-alert lifecycle state (rule id, dedupe key, severity, active/resolved status, safe summary/metadata, first/last-seen timestamps) - never a copy of the underlying telemetry/event data it was evaluated from
- unique on `(orgId, dedupeKey)` so re-evaluating the same rule updates the existing row instead of creating duplicates
- RLS is forced and deliberately narrower than the codebase's usual `current_app_can_administer()` (which also admits `dispatcher`): only `owner`/`admin` may read or write `athena_alerts`, matching the HTTP layer's `requireRoles(req, ["owner", "admin"])` gate
- writes are service-owned (the alert evaluator/exporter/retention jobs run as an authenticated org session scoped to one `{orgId, userId}` membership pair via the existing `runWithBackgroundDatabaseSession` pattern), never tied to the alert's own "actor"
- observability is feature-flagged off (`ATHENA_OBSERVABILITY_ENABLED=false`) by default; see `app/modules/athena-observability`

## Athena approvals and audit trail

Project Athena production-readiness hardening adds two new entity families:

- `AthenaApproval` stores the exact action-binding required to authorize a
  medium- or high-risk Athena action: org, requesting user, action id, tool id
  and version, risk level, idempotency key, canonical input hash, plan id, step
  id, status, expiration, and review metadata.
- `AthenaAuditEvent` stores safe internal Athena lifecycle events such as
  request receipt, context gathering, tool consideration, action attempts,
  approval requests, completion, and failure.

`AthenaApproval` is requester-readable but reviewable only by operator roles at
the API layer, with database RLS now also restricting row updates to
`owner`/`admin`/`dispatcher`. `AthenaAuditEvent` is tenant-scoped and inherits
the same request-scoped session model as the rest of Athena's runtime tables.

## Costbook workspace foundation

`CostbookWorkspace` and `CostbookWorkspaceEvent` are organization-scoped workspace foundation records.

- they do not replace the existing catalog entities
- workspace status is separate from pricing previews, price-history reads, supplier-review state, and Estimate pricing snapshots

## Costbook catalog entities

`Material`, `LaborRate`, `Equipment`, `Division`, `Category`, `Subcategory`, and `CostItem` remain the canonical Costbook catalog entities. The unified Costbook API is an application boundary over those existing tables rather than a duplicate schema.

`MaterialPriceAudit` is the authoritative catalog price-change audit record for material unit-cost changes. Historical `EstimateLineItem` pricing is a separate consumption snapshot and is not a catalog-change event.

## Costbook assemblies

`Assembly` and `AssemblyItem` remain the canonical reusable composition models.

- `Assembly` belongs directly to one organization and may be active/inactive or marked as a reusable template
- `AssemblyItem` belongs to one parent Assembly and references exactly one source: either a `CostItem` or a child `Assembly`
- service validation requires newly attached CostItems/child Assemblies to be active and in the same authenticated organization as the parent
- recursive unit-cost calculation preserves cycle detection while permitting legitimate DAG reuse
- migration `20260814221000_restrict_costbook_assembly_writes` narrows Assembly writes to the Costbook management RLS boundary and adds database-level tenant validation for parent/source relationships
- the database constraint `assembly_items_exactly_one_source_check` rejects rows that reference both sources or neither source
- AssemblyItem RLS validates same-organization parent Assembly, referenced CostItem, and referenced child Assembly, providing defense in depth beneath controller/service validation

No new pricing-policy, generic price-history, or supplier-sync persistence entity is introduced by the practical Costbook continuation.
