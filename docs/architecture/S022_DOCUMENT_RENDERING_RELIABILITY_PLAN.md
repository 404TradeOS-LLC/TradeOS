# S022 Readiness Contract — Document Rendering Reliability

Status: READY

## Objective

Verify deterministic proposal, contract, and invoice rendering across
representative lifecycle, branding, and missing-data states without changing
the established document architecture.

## Dependencies and baseline

S016, S019, S020, and S021 are DONE with merged implementation and completion
evidence. The existing PDF generators, authenticated portal document routes,
canonical Brand Studio resolver, lifecycle DTOs, and payment/signature
semantics are the implementation baseline.

## Required evidence

- Proposal, contract, and invoice PDFs render deterministically for valid,
  missing-brand, lifecycle, and customer-data states.
- Unsupported or legacy status values do not produce broken labels or unsafe
  output; canonical lifecycle presentation remains intact.
- Same-organization authenticated access succeeds and cross-organization,
  unauthenticated, malformed-ID, and unauthorized access fail closed.
- Missing assets, optional contact/trust fields, long text, special characters,
  and empty/partial data do not break PDF generation or response headers.
- Existing route/content-type contracts, organization context, forced RLS,
  signature evidence, payment semantics, and branding ownership remain intact.

## Explicit non-goals

No new renderer, public document links, frozen document persistence,
e-signature provider, identity model, payment/accounting change, schema
migration, remote asset-fetching path, arbitrary font loading, or unrelated
numbered sprint work.

## Validation contract

Run focused proposal/contract/invoice PDF and HTML tests, authenticated
same-org/cross-org access coverage, malformed and missing-data cases, App
typecheck/lint/build/integration, applicable Web checks, docs/governance
checks, and exact-head GitHub verification.
