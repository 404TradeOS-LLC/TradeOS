---
status: archived
superseded_by: docs/PRODUCT_SCOPE.md
do_not_use_for_implementation: true
---

# TradeOS North Star

## Product Outcome

TradeOS is the operating system for a field-service contractor.

The first durable platform outcome is a complete, auditable workflow from:

Customer -> Project -> Scheduled Job -> Technician Assignment -> Estimate -> Customer Approval -> Invoice -> Payment

If a feature does not strengthen that workflow, reduce risk around it, or improve the data model that supports it, it is lower priority than RC and beta completion work.

## Engineering Direction

TradeOS is not a demo app and not a collection of disconnected CRUD screens.
It is a multi-tenant operational platform with strict company isolation, role-based access, and durable workflow state.

Engineering should optimize for:

1. Correct workflow state transitions
2. Tenant-safe data access
3. Auditability of contractor actions
4. Reusable backend services before UI expansion
5. Incremental extension of existing modules over rewrites

## Core Platform Rules

### 1. Multi-tenant by default

Every business record must be company scoped directly or inherit company scope through a protected parent relation.

Every authenticated request must continue to rely on:

- JWT verification
- organization membership resolution
- request-scoped PostgreSQL RLS

### 2. Workflow over isolated records

Customers, projects, jobs, estimates, invoices, and payments are one connected lifecycle.
New APIs should prefer explicit transitions and derived totals over loose free-form mutation.

### 3. Activity and audit are first-class

Operational events should generate reusable timeline records.
Important mutations should generate audit history with before and after state.
Destructive behavior should be soft or archived unless there is a stronger reason.

### 4. Reuse the current architecture

Backend modules remain:

```text
app/modules/<name>/
  service.ts
  types.ts
```

Controllers own HTTP and validation.
Services own business rules.
RLS remains the primary tenant boundary.

## Beta Success Criteria

For beta, TradeOS succeeds when an owner can:

1. Create a customer
2. Create a project for that customer
3. Schedule work
4. Assign an in-company technician
5. Build an estimate with correct totals
6. Capture customer approval or decline
7. Generate and send an invoice
8. Record payment and track remaining balance

## Non-goals Right Now

- Frontend redesigns
- Cross-company collaboration models
- Public marketplace integrations
- Speculative abstractions for future workforce or ERP systems

## Working Standard

Each sprint should leave TradeOS more operationally complete, more auditable, and easier to ship.
