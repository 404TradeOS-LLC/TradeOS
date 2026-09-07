---
status: current
owner: platform
last_verified: 2026-09-05
source_of_truth: true
related_code:
  - app/prisma/schema.prisma
  - app/prisma/migrations/20260905050000_allow_custom_estimate_line_items
  - app/prisma/migrations/20260831214500_add_costbook_code_trgm_indexes
  - app/domain/contracts.ts
  - app/modules/athena-memory
  - app/modules/athena-events
  - app/modules/athena-observability
  - app/modules/athena-action-engine
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

`OrganizationInvite`, `AuthRefreshToken`, `PasswordResetToken`, `CustomerPortalAccessToken`, and `CustomerPortalSession` are security-control records, not ordinary tenant-editable entities.

- invitation ownership (`orgId`, email, role, token, inviter, and expiry) is immutable after creation; invite acceptance may update only lifecycle fields such as status and acceptance time
- refresh-token ownership (`orgId`, user, membership, token, and expiry) is immutable after creation; rotation may update only usage, revocation, and replacement metadata
- password-reset-token ownership (`userId`, token, and expiry) is immutable after creation; reset completion may update only consumption metadata
- customer portal access-token ownership (`orgId`, customer, token digest, and expiry) is immutable after creation; redemption may update only consumption metadata
- customer portal session ownership (`orgId`, customer, access token, session digest, and expiry) is immutable after creation; portal activity may update only the last-seen timestamp

These invariants are enforced in PostgreSQL as well as in application service behavior so a login-lookup transaction cannot reassign an existing auth record across organizations or users.

## Migration history

`public._prisma_migrations` is deployment control-plane state rather than application data. It remains writable by the Prisma migration administrator/table owner, has row-level security enabled, and is intentionally outside the runtime application role's table privileges.

## Customer

A company-scoped account or homeowner record stored in `Customer`.

- customers own the business relationship
- customers can have many projects, service addresses, equipment assets, service agreements, and jobs
- tenant customer listing/search is service-owned: `CrmService.listCustomers` always excludes soft-deleted rows, supports database-side case-insensitive name/email/phone search, and enforces a bounded result count before rows are loaded
- public customer access is represented by a `CustomerPortalAccessToken` and short-lived `CustomerPortalSession`; neither is a staff membership or canonical role

## Service Address

A serviceable location for a customer stored in `ServiceAddress`.

- belongs to one customer and one organization
- can be attached to jobs, equipment assets, and service agreements
- at most one `ServiceAddress` per customer is marked `isPrimary`; creating or updating an address as primary demotes any other primary address for that customer inside a single database transaction. A production bug in that transaction (`prisma.$transaction` called on the request-scoped client instead of the existing `runInDatabaseTransaction()` helper, which throws inside any real request) was fixed without changing this invariant; see [modules/crm.md](modules/crm.md).

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
- estimate line items may reference zero or one Costbook source (`costItemId` or `assemblyId`): zero is a valid custom line item, while referencing both sources simultaneously is prohibited by the database constraint
- may feed proposals and invoices
- line items may include an optional `sourceKey` used by reviewed AI-estimator applies to reconcile retries; ordinary manual line items do not need one
- lifecycle values are `draft`, `ready`, `sent`, `viewed`, `approved`, `declined`, `expired`, and `superseded`; historical `rejected` normalizes to `declined`, while canonical `sent` remains distinct from `ready`
- Estimate Engine currently enforces draft-only mutations and `draft -> ready` finalization; customer-facing later transitions are separate workflow scope

## Proposal

A customer-facing commercial document stored in `Proposal`.

- belongs to one project
- may reference one estimate
- owns proposal delivery history
- can produce contracts and support invoices
- uses canonical lifecycle states `draft`, `generated`, `sent`, `viewed`, `accepted`, `declined`, and `expired`; historical stored `rejected` rows remain read-compatible and normalize to `declined`, while new decline mutations persist canonical `declined`

## Contract

A signable commercial agreement stored in `Contract`.

- belongs to one project and one proposal
- stores the agreed `contractAmount` and an immutable `snapshotJson` of the accepted proposal when created
- owns contract event history
- customer portal signing may transition only its pending state through the dedicated portal RLS policy; the signed event records the customer and portal session attribution

## Invoice

A billing document stored in `Invoice`.

- belongs to one project
- may reference an estimate and proposal
- stores `subtotal`, `taxPct`, and `taxAmount` so customer documents can itemize the persisted total
- owns invoice line items, payments, and delivery history
- invoice line items store the issued selling-price allocation as `unitPrice`
  and `lineTotal`; estimate and change-order line items retain their separate
  cost-oriented `unitCost`/`lineCost` fields
- the canonical physical invoice-line-item columns are `unit_price` and `line_total`; synchronized `unit_cost`/`line_cost` aliases remain temporarily so old and new backend versions can roll out safely without changing values, indexes, constraints, or RLS policies
- a fully covered eligible `sent` or existing raw `overdue` invoice may be reconciled to persisted `paid` by recorded payment entry; `partially_paid` and new overdue presentation remain derived, and persisted `paid` is authoritative for follow-up exclusion

## Payment

A recorded payment event stored in `Payment`.

- belongs to one invoice and organization
- tracks amount, payment date, method, reference, notes, and status
- only `recorded` payments count toward reconciliation and queue balance derivation; concurrent payment reconciliation serializes on the Invoice row and preserves the Payment/status/audit transaction boundary

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

## Athena action idempotency

**Unreleased (PR #214):** the durable A6 action-idempotency implementation described below exists on PR #214 and must not be treated as shipped on `main` or available in production until that PR is merged and deployed.

PR #214 introduces `athena_action_idempotency` as an internal control record for dedup-eligible production actions:

- each reservation is uniquely scoped by organization, tool id, tool version,
  and caller-supplied idempotency key;
- the current authenticated actor is stored from the PostgreSQL session rather
  than trusted caller input, and forced RLS restricts visibility/mutation to
  that exact actor and organization;
- lifecycle is deliberately narrow: `reserved` while the owning request is in
  progress, then `completed` with canonical input hash plus the original safe
  action/result envelopes;
- reservation and completion run through the same request-scoped transaction as
  the underlying Athena tool/application-service mutation, so a transaction
  rollback also removes an uncommitted reservation;
- the record is execution-control state, not authoritative customer, project,
  estimate, dispatch, invoice, pricing, Costbook, or approval state;
- the in-memory A6 idempotency implementation remains a test/local fixture and
  is not the production controller dependency.

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

## Costbook hierarchy management

C005 exposes the existing `Division`, `Category`, and `Subcategory` models through the unified Costbook boundary, completing the CRUD gap C001-C004 left (those models previously had only list + create; `CostItem` already had full CRUD).

- `Division` belongs to one organization directly (`orgId`); `Category` and `Subcategory` inherit organization scope through their parent join (`Category.divisionId -> Division.orgId`, `Subcategory.categoryId -> Category.divisionId -> Division.orgId`), matching how `CostItem` already inherits scope through `Subcategory`
- all three models gained an `isActive` boolean (default `true`) in C005 — previously only `CostItem` had a soft-delete flag anywhere in this hierarchy
- Costbook hierarchy create/update requests derive organization scope from the authenticated membership; caller-supplied organization IDs are not accepted, and a category/subcategory create rejects a parent id that does not belong to the authenticated organization
- category and subcategory database write policies also carry explicit authenticated-organization predicates through their parent joins, so write isolation does not depend on nested row visibility alone
- the database rejects any create/reactivation that would leave an active `Category` under an inactive `Division`, or an active `Subcategory` under an inactive `Category` or `Division`; these active-parent invariants apply even when application-layer code is bypassed
- delete is soft-deactivate only (`isActive = false`); child `Category`/`Subcategory`/`CostItem` rows are never cascade-deleted through the Costbook API, even though the underlying Prisma relations define `onDelete: Cascade` for a true hard delete
- C005 tightens `divisions_write_policy`/`categories_write_policy`/`subcategories_write_policy` from the generic app-wide write boundary to the Costbook-specific owner/admin boundary, matching C002/C003; legacy `estimator` loses direct database write access to these three tables
- C005 does not add pricing calculations, estimate integration, or Athena advisor state

## Costbook assemblies and historical pricing

PR #216 does not add replacement catalog entities. It promotes the existing `Assembly` and `AssemblyItem` models under the canonical Costbook workflow and strengthens database checks so parent Assembly, referenced CostItem, and referenced child Assembly remain in the authenticated organization. Estimate lines continue to persist `costItemId` or `assemblyId` provenance together with `unitCost` and `lineCost`; those persisted values are historical pricing snapshots and are not rewritten when current Costbook prices later change. `MaterialPriceAudit` remains the catalog price-change record; Estimate snapshots are a separate read-model input rather than price-change events.

Cost Item and Assembly lookup semantics remain unchanged: both services support case-insensitive substring search across `name` and `code`. PostgreSQL `pg_trgm` GIN indexes cover both searched fields, including additive `code` indexes, so code substring matching has an index path without changing organization scope, RLS, catalog ownership, or DTO behavior.

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

## AI generation metadata

S025 introduces tenant-owned `AthenaGenerationRun` metadata and append-only
`AthenaGenerationReview` provenance. These records identify the organization,
actor, execution correlation, model usage, status, and retention expiry; they
do not persist raw prompts, model output, tool arguments, or tool results by
default. Business mutations remain owned by existing review-first services.


## S028 estimate deliverability

The S028 lane preserves the existing Estimate and Proposal entities while adding additive estimate metadata for tax percentage/amount and line-item section, cost type, and taxable semantics. These fields remain organization-scoped through the existing relationships and do not introduce a new identity, payment, or accounting model.

## S030 dispatcher workspace

S030 uses the existing Job and JobAssignment entities as the dispatcher work queue; it does not introduce a replacement dispatch model.

- Job remains organization-owned through orgId and retains the existing project, customer, service-address, scheduling, lifecycle, and archive relationships.
- JobAssignment is the active technician relationship when both removedAt and declinedAt are null. Declined assignments remain provenance/history but are not active dispatch ownership, technician job access, queue assignment, or conflict participation.
- Dispatcher mutations continue to use the established manager authorization and owner/admin conflict-override rules. The browser surface calls the authenticated same-origin proxy; it does not hold backend bearer credentials.
- The S030 RLS hardening migration aligns the forced jobs and job_equipment policies with the active-assignment invariant. It changes existing policy predicates only and does not add entities or alter tenant ownership.
- S030 does not introduce persisted derived lifecycle states, route optimization, GPS, notifications, billing behavior, or concurrency semantics.
