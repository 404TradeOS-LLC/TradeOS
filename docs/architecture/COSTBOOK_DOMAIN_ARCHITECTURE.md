---
status: proposed
owner: platform
last_verified: 2026-08-10
source_of_truth: true
related_docs:
  - docs/CURRENT_STATE.md
  - docs/DOMAIN_MODEL.md
  - docs/API_REFERENCE.md
  - docs/RBAC_MATRIX.md
  - docs/modules/cost-book.md
  - docs/modules/estimating.md
  - docs/modules/ai-estimate-assist.md
---

# Costbook Domain Architecture

This document defines the intended Costbook domain architecture for TradeOS. C001
has implemented the Costbook workspace foundation, permission keys, and unified
read-only workspace endpoint. The broader pricing engine, catalog CRUD under the
unified boundary, price history, estimate integration, and Athena advisor remain
future work.

Current implementation truth remains in [CURRENT_STATE.md](../CURRENT_STATE.md)
and [modules/cost-book.md](../modules/cost-book.md).

## Costbook Vision

Costbook becomes the commercial intelligence layer of TradeOS.

It provides the source of truth for:

- materials
- labor
- equipment
- assemblies
- pricing rules
- margins
- historical costs

Costbook powers:

- estimates
- proposals
- invoices
- profitability reporting
- future Athena recommendations

TradeOS already has tenant-scoped estimating catalog primitives. The future
Costbook product domain turns those primitives into a governed pricing system
that helps contractors understand what work costs, what it should sell for, and
where margin is gained or lost.

## Domain Boundaries

Costbook owns:

- pricing data
- cost items
- labor rates
- assemblies
- markup rules
- margin targets
- price history

Costbook does not own:

- customers
- projects
- dispatch
- invoices
- payments

Those adjacent domains consume Costbook pricing intelligence. They do not move
their workflow ownership into Costbook.

## Architecture Relationship

```text
Costbook -> Estimator Engine -> Estimate -> Proposal -> Invoice -> Actual Margin
```

Dependency direction flows from pricing intelligence into downstream commercial
workflows. Costbook owns the source pricing, pricing rules, and historical cost
context. The Estimator Engine consumes Costbook data to build estimate line
items. Estimates preserve snapshots that proposals and invoices can reference
without being rewritten when future Costbook prices change. Actual margin then
feeds reporting and future intelligence loops.

Other systems consume Costbook pricing intelligence; Costbook does not depend on
concrete proposal, invoice, dispatch, customer, or payment workflow logic.

## Core Domain Model

### CostItem

Represents a reusable unit of cost and price.

Fields:

- `id`
- `organizationId`
- `type`
- `name`
- `description`
- `categoryId`
- `unit`
- `currentCost`
- `markupPercent`
- `sellPrice`
- `active`
- timestamps

Examples include:

- materials
- labor
- equipment

### Cost Classification Hierarchy

Groups cost items into contractor-readable pricing areas. TradeOS already models
this as `Division -> Category -> Subcategory -> CostItem`; future Costbook work
should evolve that hierarchy rather than create a parallel category table.

Division fields:

- `id`
- `organizationId`
- `code`
- `name`
- `sortOrder`

Category fields:

- `id`
- `divisionId`
- `code`
- `name`
- `sortOrder`

Subcategory fields:

- `id`
- `categoryId`
- `code`
- `name`
- `sortOrder`

Examples:

- Plumbing
- Electrical
- HVAC
- Roofing
- Concrete

### LaborRate

Represents the true billable labor model for a role.

Fields:

- `id`
- `organizationId`
- `role`
- `wageRate`
- `burdenPercent`
- `overheadPercent`
- `billRate`

True labor cost should account for the wage paid to the worker, payroll burden,
insurance, taxes, benefits, and allocated overhead. Bill rate is not just wage
plus profit; it is the contractor's sellable hourly rate after burden,
overhead, and margin expectations are applied.

### Assembly

Assemblies are a major Costbook differentiator. They let TradeOS model a
complete scope of work as a reusable pricing package instead of requiring an
estimator to add every item from memory.

Example: Water Heater Replacement.

Contains:

- materials
- labor
- equipment
- markup

An assembly should preserve enough structure for estimators to see and adjust
its components while still pricing the job quickly.

### AssemblyItem

Connects an assembly to the CostItems and quantities that make up the assembly.
Assembly items define the composition of reusable work packages while leaving
the underlying CostItem as the source for current cost, unit, type, and pricing
metadata.

### PriceHistory

Pricing history matters because contractor pricing changes continuously.

Requirements:

- never overwrite historical cost
- track changes
- preserve estimate accuracy

Costbook should record price changes over time so TradeOS can explain why an
estimate used a specific cost and sell price at the moment it was created.

## Estimate Integration Strategy

Estimates consume Costbook.

Estimates must not store only price. A price alone loses the reason, source,
and cost basis needed to audit margin later.

Estimate line items should preserve:

- source CostItem
- source Assembly
- cost snapshot
- sell price snapshot
- margin snapshot

This is required because:

- material prices change
- historical estimates must remain accurate
- proposals and invoices must remain explainable after Costbook changes
- profitability reporting needs the original cost basis, not only current cost

Snapshots preserve the commercial truth of the estimate at creation time while
allowing Costbook to keep evolving.

## Pricing Engine

Pricing rules belong to Costbook.

Pricing philosophy:

```text
Direct Costs
+
Labor Cost
+
Equipment
+
Overhead
+
Profit Target
=
Sell Price
```

Costbook should provide the rules, targets, and calculations needed to turn true
cost into sell price. The Estimator Engine should consume the result and
preserve the snapshot, not duplicate Costbook's pricing authority.

## Margin Intelligence

Future Costbook margin intelligence should support:

- gross profit
- margin percentage
- margin erosion
- profitability tracking

The long-term goal is to help contractors see whether the work they sell is
actually profitable after labor, materials, equipment, overhead, and price
changes are accounted for.

## Permissions Model

Costbook permissions:

- `costbook.read`
- `costbook.write`
- `costbook.manage`

Future permission candidates:

- `costbook.import`
- `costbook.approve`

Role expectations:

Owner/Admin: full control.

Estimator/dispatcher/technician: read Costbook workspace and catalog summary data.

Technician: read-only Costbook access in C001.

In C001, owner/admin have all three implemented Costbook permissions, dispatcher
technician, and legacy estimator have `costbook.read`, and viewer has no
Costbook permission.

## API Boundary

C001 implemented route:

- `GET /api/v1/costbook/workspace`

Future Costbook API ownership:

Materials:

- `GET /api/v1/costbook/items`
- `POST /api/v1/costbook/items`

Assemblies:

- `GET /api/v1/costbook/assemblies`
- `POST /api/v1/costbook/assemblies`

Pricing:

- `POST /api/v1/costbook/calculate`

The future routes define the intended unified API boundary. They are not
implemented by C001.

## Database Migration Strategy

C001 adds `costbook_workspaces` and `costbook_workspace_events` as organization-scoped
foundation tables with forced RLS. Future database rollout should remain phased
and must reuse the implemented Costbook schema where it already exists. The
current schema already includes `divisions`, `categories`, `subcategories`,
`cost_items`, `labor_rates`, `materials`, `equipment`, `assemblies`,
`assembly_items`, and estimate line-item references to `cost_items` and
`assemblies`. Future migrations should extend those tables or add narrow
companion tables only when the existing schema cannot represent the approved
requirement.

Phase 1:

- evolve existing `divisions`, `categories`, and `subcategories` if the
  approved Costbook workspace needs additional classification metadata
- evolve existing `cost_items` and `labor_rates` if new pricing fields are
  approved
- add `pricing_rules` only if pricing rules cannot remain as estimate-level or
  existing Costbook-service configuration

Phase 2:

- evolve existing `assemblies` and `assembly_items` for approved builder
  behavior
- preserve the current org-scoped assembly model unless a separate architecture
  decision approves another template mechanism

Phase 3:

- add `price_history` or extend existing audit/history tables where current
  material price auditing is not sufficient
- add missing estimate snapshot fields only where current `estimate_line_items`
  references, `unit_cost`, and `line_cost` snapshots do not preserve the
  approved commercial truth

Any future table that stores tenant-owned Costbook data must follow TradeOS RLS
and migration policy, including organization scoping, forced row-level security
where applicable, and live integration coverage for new RLS-protected tables.

## Athena Integration

Athena integration is future-only.

Athena may eventually:

- identify margin erosion
- recommend price updates
- compare historical profitability

Requirements:

- Memory
- Events
- Business tools
- Observability

Athena must remain review-first and must not silently rewrite Costbook data,
estimates, pricing rules, or margin targets. Costbook remains the domain owner;
Athena may recommend or orchestrate through approved tools after the required
foundation and permissions exist.

## Implementation Roadmap

### C001 Costbook Foundation

Implemented:

- `app/modules/costbook`
- `GET /api/v1/costbook/workspace`
- `/costbook` web route
- dashboard and app-navigation links
- `costbook.read`, `costbook.write`, and `costbook.manage`
- `costbook_workspaces` and `costbook_workspace_events`

Not implemented by C001:

- materials CRUD
- labor engine
- assembly builder
- pricing calculations
- estimate integration
- price history
- Athena Costbook advisor

### C002 Materials Catalog

Create the managed materials catalog experience and APIs.

### C003 Labor Engine

Define labor roles, burden, overhead, and bill-rate calculations.

### C004 Assembly Builder

Let contractors compose reusable work packages from materials, labor, equipment,
and markup rules.

### C005 Estimate Integration

Connect Costbook sources and snapshots into estimate line items without losing
historical accuracy.

### C006 Margin Intelligence

Track gross profit, margin percentage, margin erosion, and actual-versus-estimated
commercial performance.

### C007 Athena Costbook Advisor

Introduce review-first Athena recommendations after Costbook tools, events,
memory, and observability are in place.
