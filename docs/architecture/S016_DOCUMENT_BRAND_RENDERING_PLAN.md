---
status: current
owner: platform
last_verified: 2026-08-24
source_of_truth: false
related_docs:
  - docs/SPRINT_BACKLOG.md
  - docs/CURRENT_STATE.md
  - docs/architecture/S015_COMPLETION_EVIDENCE.md
  - docs/decisions/ADR-006-brand-source-of-truth.md
---

# S016 — Document-brand rendering readiness contract

## Readiness verdict

S016 is eligible for readiness promotion after S015 completed. S014 is DONE
through ADR-006, and the S015 Brand Studio-owned Settings adapter is merged
with completion evidence. No founder, infrastructure, access, or competing
S016 implementation blocker was found. This document promotes readiness only;
it does not authorize implementation in this branch.

## Existing implementation surface

- `app/modules/documents/frame.ts` and `frame.css` define a reusable branded
  HTML document frame and typed `DocumentFrameBrand` input.
- `app/modules/documents/templates.ts` contains estimate, change-order,
  closeout, warranty, and maintenance-guide frame builders.
- Proposal, invoice, and contract PDF generators currently render separate
  legacy PDFKit layouts and accept organization/company display data directly.
- Existing document routes and binary download proxy behavior remain the
  delivery boundary. S016 must preserve their route shapes and content types.
- S015 supplies the canonical branding contract and Settings compatibility
  adapter. S016 consumes canonical values; it does not create another source
  of truth or extend Settings/Brand Studio scope.

## Authorized scope

S016 may add a bounded mapper from canonical BrandProfile and
BrandDocumentSettings values to the existing document frame/generator inputs;
apply persisted organization branding where those surfaces already support it;
converge proposal, invoice, contract, and authenticated portal document
rendering on the approved contract; and add behavioral PDF/HTML smoke,
same-org/cross-org, missing-brand fallback, escaping, asset URL, and binary
response coverage.

## Explicit non-goals and stop conditions

- No new customer identity, public sharing, public marketing theming, or
  unauthenticated document access.
- No schema/migration, storage model, asset lifecycle cleanup, or RBAC/RLS
  redesign. S017 owns asset lifecycle and cleanup.
- No payment/billing semantic change, invoice amount change, contract signature
  semantics, proposal lifecycle change, or portal redesign.
- No new PDF renderer or broad design-system rewrite without a founder
  decision; reuse existing frame/generator seams first.
- Do not trust client-selected organization IDs or caller-provided branding
  when server-derived organization context is available.
- Stop for a founder decision if completion requires a new brand source,
  public-branding policy, new document identity/legal claim, destructive data
  migration, new storage architecture, or changed authorization policy.

## Required evidence

- Canonical branding reaches supported proposal, invoice, contract, and portal
  documents; missing optional branding falls back deterministically.
- HTML escaping and asset URL behavior remain safe; same-organization document
  generation succeeds and cross-organization direct-ID access fails closed
  where the route performs an organization-scoped read.
- Existing document route shapes, content types, lifecycle permissions, and
  persisted business semantics remain unchanged.
- Focused App tests, Web/document smoke coverage, and PostgreSQL/RLS evidence
  where applicable pass before implementation merge.

## Implementation boundary

Likely implementation files are limited to the existing document frame,
templates, proposal/invoice/contract generator seams, service/route adapters,
focused tests, and owning documentation. Do not edit Settings, Brand Studio
storage, Prisma schema, migrations, auth middleware, or unrelated sprint paths
without a newly reconciled S016 contract.
