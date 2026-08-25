# Estimate Deliverability Audit

Status: implementation in progress on `fix/estimate-deliverability-gate`  
Canonical fixture: `Estimate Deliverability Test Customer` / `Condo Remodel Deliverability Test`  
Last reconciled: 2026-08-24

## Product truth

The pre-repair estimate flow could create a draft and add Costbook-backed lines, but a normal contractor could not complete a messy remodel estimate: custom lines, sections, line edits, tax, and reliable tax-aware profitability were absent. The deployed alias `https://app.404tradeos.com` currently redirects unauthenticated dashboard requests to `/login`, while `/projects` returned a deployed 404 even though the route exists in source. No authenticated production browser evidence was available in this audit.

## Defect register

| ID | Severity | Reproduction | Root cause | Repair / regression |
| --- | --- | --- | --- | --- |
| ED-001 | P1 | Open an estimate and try to add a one-off demolition or disposal item | Add contract required a Costbook ID | Custom description, unit, unit cost, section, cost type, and taxable fields; API/controller test |
| ED-002 | P1 | Change quantity or unit cost after reload | No line-item update route or editor | Permissioned `PATCH /estimates/:id/line-items/:lineItemId`, draft guard, UI editor, persistence test |
| ED-003 | P1 | Organize a condo remodel into demolition and finish scope | No section or cost-type fields | Additive nullable-safe migration with defaults; grouped builder UI |
| ED-004 | P1 | Apply tax to only relevant material/disposal scope | No tax fields or formula | Estimate tax rate/amount, taxable line flags, proportional taxable-price allocation, formula regression |
| ED-005 | P1 | Set overhead, reload, and verify displayed margin | UI used direct subtotal while backend priced overhead-loaded cost | DTO exposes cost-after-overhead/pre-tax price; builder and comparison use the same basis |
| ED-006 | P1 | Use a line-item URL with a line from another estimate | Nested route did not validate the parent ID | Service now validates the supplied parent estimate before mutation; controller regression |
| ED-007 | P1 | Preview a customer-ready proposal PDF | Estimate-backed PDFs omitted saved proposal overrides and preview used attachment disposition | Generator now renders saved proposal scope/pricing/terms fields; preview requests inline PDF; authenticated PDF-content assertion remains |
| ED-008 | P1 (environment) | Navigate deployed `/projects` | Live alias returned 404 while source route exists | Deployment/alias reconciliation remains required before production gate |
| ED-009 | P1 (evidence) | Run the real workflow ten times | No estimate-specific authenticated browser harness or storage state was available | Added golden browser harness; run requires an approved authenticated storage state |

## Calculation contract

1. Each line stores a two-decimal `lineCost = round2(quantity * unitCost)` snapshot.
2. Direct job cost is the sum of persisted line costs.
3. Overhead is applied to direct job cost before markup or target-margin pricing.
4. Taxable selling price is the pre-tax selling price allocated by taxable direct-cost share; `taxAmount = round2(taxableSellingPrice * taxPct / 100)`.
5. Customer total is pre-tax selling price plus tax. Margin and markup are reported against cost after overhead and pre-tax selling price, respectively.
6. Existing Costbook-backed lines remain snapshots and are not repriced when Costbook values change.

## Authorization and data safety

All new mutations use the existing `crm.write` permission, organization context, draft-state guard, and forced RLS tables. The new migration only adds fields and constraints; it does not change RLS policies or accept client-supplied organization IDs. Nested line mutations validate both the authenticated organization and the URL parent estimate.

## Verification status

- Source and governance reconciliation: complete; this is a separate estimate-deliverability override and does not replace active S025 work.
- Read-only browser/API/schema/calculation/costbook/adversarial audits: complete.
- Local dependency install: blocked by the execution environment's npm registry/cache failure; no app or web test command could be executed locally.
- Authenticated deployed browser workflow: pending approved storage state and a deployed build containing this branch.
- Ten-run reliability gate: not yet claimable; it must be run after deployment with the golden harness.

## Remaining non-blocking / follow-up gaps

- Finalized estimates remain immutable; revise them by duplicating a version into a draft, consistent with existing lifecycle rules.
- Proposal PDFs now receive saved scope, assumptions, exclusions, timeline, payment schedule, terms, and price overrides; authenticated PDF-content verification remains part of the deployment gate.
- Project/customer cross-organization foreign-key validation and concurrent estimate version allocation require a separate security/data-integrity slice.
