---
status: archived
superseded_by: docs/PRODUCT_SCOPE.md
do_not_use_for_implementation: true
---

# Beta Feature Cutline

## Purpose

This document defines what must be real for beta versus what may be scaffolded or deferred.

Beta is not feature-complete TradeOS.
Beta is the first credible contractor workflow release.

## Must Be Real In Beta

### Identity and tenant safety

- Email/password auth
- JWT auth
- role enforcement
- company-scoped isolation
- request-scoped RLS

### CRM and operations

- Customers
- Service addresses
- Projects
- Job scheduling
- Technician assignment
- Notes and activity history

### Commercial workflow

- Estimates with calculated totals
- Customer approval and decline
- Invoice creation from approved estimates
- Payment recording
- Balance due tracking

### Platform quality

- Audit trail for important mutations
- Tests for tenant isolation and core workflow
- Lint and build passing
- API documentation for new backend routes

## Acceptable Scaffolding In Beta

- TOTP 2FA storage and endpoint scaffolding
- Signature placeholder storage instead of full e-sign provider integration
- Storage adapter interfaces where binary upload infrastructure is not yet finalized
- Future-ready multi-technician assignment models with single-technician primary UX/backend behavior

## Explicitly Deferred Beyond Beta

- Advanced dispatch optimization
- Route planning
- Payroll
- Full accounting system
- Inventory management
- Deep vendor integrations
- Public customer portal hardening
- Automated collections

## Cutline Decision Rule

If a feature request appears during beta work, ask:

1. Does it complete or protect the core contractor workflow?
2. Does it improve tenant safety, auditability, or operational correctness?
3. Is it required for RC credibility?

If the answer is no, defer it.

## Beta Release Standard

The backend is beta-ready when the workflow from customer to payment is executable end to end with correct access control, reliable totals, timeline visibility, and audit history.
