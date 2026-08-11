---
status: current
owner: platform
last_verified: 2026-08-11
source_of_truth: true
related_code:
  - app/prisma/schema.prisma
  - app/domain/contracts.ts
  - app/modules/athena-memory
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

## Costbook workspace foundation

C001 introduces `CostbookWorkspace` and `CostbookWorkspaceEvent` as organization-scoped foundation records for the future unified Costbook workspace.

- `CostbookWorkspace` belongs to one organization and stores workspace setup state and foundation lifecycle status
- `CostbookWorkspaceEvent` belongs to one organization and one Costbook workspace; database guardrails require the event organization to match the workspace organization
- both tables use forced RLS and do not replace existing `Division`, `Category`, `Subcategory`, `CostItem`, `LaborRate`, `Material`, `Equipment`, `Assembly`, or `AssemblyItem` catalog models
- the C001 workspace foundation does not add pricing calculations, materials CRUD, labor-engine state, estimate integration snapshots, or Athena advisor records

## Costbook material catalog

C002 exposes the existing `Material` model through the unified Costbook boundary.

- `Material` belongs to one organization and stores SKU, name, unit of measure, current unit cost, waste factor, optional supplier link, last price-update timestamp, and timestamps
- material reads remain tenant-scoped by `orgId`; C002 tightens material and material-price-audit writes to the owner/admin Costbook boundary through forced RLS
- Costbook material create/update requests derive organization scope from the authenticated membership; caller-supplied organization IDs are not accepted
- a material may link to a supplier only when that supplier belongs to the same authenticated organization
- material unit-cost changes continue to write `MaterialPriceAudit` rows for audit history, but C002 does not introduce a price-history engine or pricing calculations
- material archive/deactivate is not modeled in C002 because the existing `Material` table has no active/archive state

## Costbook labor-rates foundation

C003 exposes the existing `LaborRate` model through the unified Costbook boundary.

- `LaborRate` belongs to one organization and now stores foundational `role`, optional `description`, `hourlyCost`, `billRate`, `active`, and timestamps alongside older compatibility fields still consumed by legacy labor and cost services
- labor-rate reads remain tenant-scoped by `orgId`; C003 tightens labor-rate writes to the owner/admin Costbook boundary through forced RLS
- Costbook labor-rate create/update requests derive organization scope from the authenticated membership; caller-supplied organization IDs are not accepted
- `DELETE /api/v1/costbook/labor-rates/:id` and the legacy `/api/v1/labor-rates/:id` compatibility route soft-deactivate the row by setting `active` to `false`
- C003 does not add labor burden calculations, pricing rollups, estimate integration, or Athena advisor state

## Costbook equipment foundation

C004 exposes the existing `Equipment` model through the unified Costbook boundary.

- `Equipment` belongs to one organization and stores `name`, `ownershipCostPerHour`, `operatingCostPerHour`, optional `dailyRate`, timestamps, and a derived `hourlyCost` in DTO/view-model surfaces
- equipment reads remain tenant-scoped by `orgId`; C004 tightens equipment writes to the owner/admin Costbook boundary through forced RLS
- Costbook equipment create/update requests derive organization scope from the authenticated membership; caller-supplied organization IDs are not accepted
- `DELETE /api/v1/costbook/equipment/:id` and the legacy `/api/v1/equipment/:id` compatibility route hard-delete the row because the current schema has no `active` or archive state
- C004 does not add advanced equipment-rate analytics, estimate integration, or Athena advisor state

## Core relationships

Canonical relationship flow:

`Organization -> Customer -> Project -> Estimate/Proposal/Contract/Invoice/Job`

Operational sub-relationships:

- `Customer -> ServiceAddress -> Job`
- `Project -> SiteVisit`
- `Project -> ProjectTask`
- `Invoice -> Payment`
- `Job -> JobAssignment`
- `ActivityEvent` may describe changes across multiple entity types
