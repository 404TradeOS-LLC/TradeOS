---
status: current
owner: platform
last_verified: 2026-08-25
source_of_truth: true
related_code:
  - app/modules/estimate-engine
  - app/modules/proposals
  - app/modules/proposal-generator
  - web/src/app/(app)/projects
  - app/prisma/migrations/20260824235000_estimate_deliverability_fields/migration.sql
---

# S028 — Estimate-to-proposal workflow verification plan

Status: IN_REVIEW
Dependencies: S008 and S009 are DONE.
Implementation lane: Existing PR #332, fix/estimate-deliverability-gate.

## Objective

Verify and repair the complete authenticated contractor path from a draft estimate through finalized totals, proposal generation, document output, and auditable downstream state.

## In scope

- Custom and Costbook-backed estimate line items.
- Sections, cost types, quantities, unit costs, taxable flags, overhead/tax, and deterministic totals.
- Draft edit, save, reload, and revision-safe behavior.
- Finalize/approval transition and finalized-estimate immutability.
- Proposal creation from an estimate, proposal preview/PDF handoff, and persisted proposal state.
- Organization authorization, forced RLS, direct-object denial, validation, audit/event behavior, and failure/retry handling.
- Focused app/web tests, migration upgrade/fresh-path verification, docs/governance checks, and authenticated browser evidence where available.

## Explicit non-goals

- New payment processing or accounting/ledger semantics.
- New legal-signature or customer-identity architecture.
- Autonomous AI writes or provider/prompt changes.
- S027 Costbook production-readiness work.
- Destructive migration or data rewrite.

## Current implementation evidence

PR #332 is the existing overlapping implementation lane. It is currently behind main and has deterministic failures in app typecheck/unit/build, docs consistency, sprint evidence, and branch currency. Repair it in place or supersede it with one reconciled branch; do not create parallel S028 implementations.

## Security and data contract

Preserve server-derived organization context, existing permissions, forced PostgreSQL RLS, finalized-estimate read-only semantics, review-first AI behavior, and existing proposal authorization. Any migration remains additive, reversible/recoverable, and subject to repository migration governance.

## Acceptance evidence

1. Draft estimate creation and reload preserve all entered fields.
2. Custom and catalog-backed lines calculate correct cost, overhead, tax, subtotal, pre-tax total, and final total.
3. Finalization blocks invalid state transitions and prevents unauthorized edits.
4. Proposal generation carries the verified estimate state and produces a valid document/PDF path.
5. Audit/events are emitted consistently without leaking secrets or cross-tenant data.
6. Focused and broad repository checks pass, including migration/RLS verification and authenticated browser evidence when required.
