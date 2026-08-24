---
status: current
owner: platform
last_verified: 2026-08-24
source_of_truth: true
related_docs:
  - docs/decisions/ADR-006-brand-source-of-truth.md
  - docs/SPRINT_BACKLOG.md
  - docs/modules/brand-studio.md
  - docs/modules/settings-and-operations.md
  - docs/CURRENT_STATE.md
---

# S015 — Brand profile/settings adapter

## Readiness

S015 is promoted to `READY` by the governance-only readiness promotion that
adds this contract. Its dependency, S014, is `DONE` through founder-decision
PR #301 and accepted ADR-006. This document authorizes exactly one subsequent
S015 implementation lane; it does not contain implementation changes.

Before implementation begins, refresh `origin/main`, rerun the canonical
selector, and confirm that no S015 implementation PR, branch, or worktree has
appeared.

## Product contract

Brand Studio is the canonical organization-brand source. Settings remains the
existing organization control surface and compatibility entry point. Existing
Settings callers and stored `OrganizationSettings.settingsJson` values must
continue to work while branding fields are migrated incrementally.

The adapter must provide:

1. Settings reads that resolve branding from `BrandProfile` and
   `BrandDocumentSettings` first, then use non-destructive legacy Settings and
   organization-row fallbacks when the canonical record is absent or a field
   is not populated.
2. Settings writes that preserve the existing `PATCH /api/v1/settings`
   request/response shape, persist branding fields through the canonical Brand
   Studio records, and retain unrelated operational Settings fields in
   `OrganizationSettings.settingsJson`.
3. Migration-safe lazy adoption of non-empty legacy branding values into the
   canonical records inside the existing request-scoped transaction boundary.
   No destructive historical rewrite, background job, or production migration
   is authorized by S015.
4. Compatibility synchronization for existing organization shell consumers
   (`Organization.name`, `phone`, `email`, `address`, and `logoUrl`) without
   making those columns a second source of truth for document branding.
5. Stable empty/default behavior: missing or incomplete branding continues to
   use the existing Brand Studio and document-frame defaults.

Submitted Settings branding values are explicit user intent. A saved empty
value may clear the corresponding canonical compatibility field; a read-only
fallback must never overwrite a populated canonical value with a stale legacy
empty value. The adapter must distinguish absent legacy keys from intentional
empty values where the current full-snapshot Settings form requires it.

## Canonical field mapping

| Settings compatibility field | Canonical destination | Read fallback / normalization |
| --- | --- | --- |
| `companyName` | `BrandProfile.companyDisplayName` | organization `name` |
| `logoUrl` | `BrandProfile.logoUrl` | organization `logoUrl`, then empty |
| `darkLogoUrl` | `BrandProfile.logoDarkUrl` | empty |
| `iconUrl` | `BrandProfile.iconUrl` | empty |
| `watermarkUrl` | `BrandProfile.watermarkUrl` | empty |
| `brandPrimary` | `BrandProfile.primaryColor` | empty/default preview color |
| `brandSecondary` | `BrandProfile.secondaryColor` | empty/default preview color |
| `accentColor` | `BrandProfile.accentColor` | empty/default preview color |
| `typography` | `BrandProfile.typographyStyle` | Brand Studio default |
| `pdfAppearance` | `BrandProfile.defaultDocumentTheme` | Brand Studio default |
| `proposalStyle` | `BrandProfile.proposalStyle` | Brand Studio default |
| `invoiceStyle` | `BrandProfile.invoiceStyle` | Brand Studio default |
| `contractStyle` | `BrandProfile.contractStyle` | Brand Studio default |
| `emailSignature` | `BrandProfile.emailSignature` | empty |
| `website` | `BrandProfile.websiteUrl` | empty |
| `phone` | `BrandProfile.phone` and organization `phone` | empty |
| `licenseNumber` | `BrandProfile.licenseNumber` | empty |
| `insuranceProvider` + `insurancePolicy` | `BrandProfile.insuranceSummary` | deterministic combined legacy text |
| `address` | scalar compatibility alias for `BrandProfile.addressLine1` and organization `address` | empty |

Address compatibility is intentionally preservation-based rather than a lossy
flattening/parser contract. The legacy Settings `address` string reads and
writes only the canonical `addressLine1` component; `addressLine2`, `city`,
`state`, and `postalCode` remain unchanged by that scalar route and are exposed
through the structured Brand Studio surface. An empty Settings `address`
clears only `addressLine1`. Legacy organization-address adoption follows the
same rule and occurs only when the canonical line is empty. This fixed
projection is deterministic, preserves partial canonical addresses, and makes
full structured-address clearing an explicit Brand Studio operation.

S015 must not invent mappings for AI, Costbook, notification, security,
membership, labor, markup, tax, or other operational Settings fields. The
existing `BrandDocumentSettings` controls remain owned by the Brand Studio
route and are not duplicated inside the Settings JSON blob.

## Existing implementation baseline

- `app/modules/brand-studio/service.ts` already owns normalized Brand Studio
  profile/document-settings reads and writes.
- `app/modules/settings/service.ts` currently reads and writes the full legacy
  Settings snapshot and synchronizes selected organization shell columns.
- `app/backend/routes/settings.routes.ts` and
  `app/backend/routes/brandStudio.routes.ts` expose the existing API shapes;
  S015 should not add a second branding route or change authentication.
- `BrandProfile`, `BrandAsset`, and `BrandDocumentSettings` already exist in
  the Prisma schema and migrations. Existing migration tests and
  `app/tests/rls.integration.ts` cover their forced-RLS organization boundary.
- Existing Settings and Brand Studio frontend surfaces are separate. S015
  may update bounded Settings data bindings, but it must not redesign either
  surface or implement document rendering.

## Authorized implementation surface

Expected files, subject to final implementation evidence:

- `app/modules/settings/service.ts`
- `app/modules/settings/types.ts` and/or a small adapter module under
  `app/modules/brand-studio/` or `app/modules/settings/`
- `app/modules/brand-studio/service.ts` only where a shared canonical resolver
  is required
- `app/tests/settings.service.test.ts`
- `app/tests/brand-studio.service.test.ts` and a focused adapter test when
  needed
- `app/tests/rls.integration.ts` only to extend existing organization/RLS
  evidence for the adapter path
- the smallest affected Settings API/client types and Settings component
  bindings under `web/src/` if the existing UI cannot consume the canonical
  response without a bounded compatibility adjustment
- owner documentation required by `docs/DOC_OWNERSHIP.yml`

No schema or Prisma migration is expected. If implementation proves that a
schema/data migration, new RLS policy, permission change, or separate storage
model is necessary, stop and prepare a decision packet rather than expanding
S015.

## Authorization and RLS contract

| Surface | Reads | Writes | Organization enforcement | Required evidence |
| --- | --- | --- | --- | --- |
| `GET /api/v1/settings` | authenticated organization member | none | server-derived org context plus request-scoped forced RLS | same-org read and cross-org denial |
| `PATCH /api/v1/settings` | owner/admin permission gate | existing `team.manage`/`company.manage`/`settings.manage` gate | server-derived org context; never trust a client org ID | permitted-role write, denial for roles lacking the existing gate, cross-org denial |
| Brand Studio profile/document settings | authenticated member reads | existing org-admin gate | existing `brand_profiles`/`brand_document_settings` forced RLS | canonical row isolation and mutation denial |

The adapter must pass the authenticated `orgId` from request context to every
canonical read/write, use the existing `runInDatabaseTransaction()` pattern,
and never accept an organization selector from the request body. No RBAC/RLS
redesign is in scope.

## Required implementation tests

Behavioral tests must cover:

- canonical BrandProfile values win over stale legacy Settings and
  organization-row values;
- a legacy-only organization is lazily adopted without losing unrelated
  Settings JSON fields;
- absent legacy keys do not clear canonical values;
- explicit Settings clears are deterministic and do not repopulate from stale
  fallback data on the next read;
- all mapped aliases round-trip through the existing Settings API shape;
- organization shell compatibility fields stay synchronized where existing
  consumers require them;
- Brand Studio defaults remain stable when fields are missing or malformed;
- same-organization reads/writes succeed, cross-organization access is denied,
  every currently permitted role can write, and roles lacking the existing
  permission fail closed under existing auth and forced-RLS tests;
- repeated adapter saves do not create duplicate canonical profiles or
  document-settings rows.

Required validation includes the focused app tests, existing brand/settings
migration tests, PostgreSQL-backed RLS integration, `git diff --check`,
`npm run pr:preflight -- --base origin/main`, `npm run pr:test`,
`npm run docs:test`, `npm run docs:check -- --base origin/main`, and the
repository's required app/web lint, build, unit, and integration lanes.

## Explicit non-goals and stop conditions

S015 must not introduce payment/billing changes, document-rendering changes,
public marketing theming, a new asset-storage model, destructive data
migration, auth/customer identity changes, permission widening, RBAC/RLS
redesign, new route families, broad Settings/Brand Studio redesign, or any
other numbered sprint.

Stop for founder/architecture review if the adapter requires a new source of
truth, a new persisted status or data model, an irreversible migration,
permission widening, a new identity boundary, or a public branding policy.

## Completion evidence required

After implementation merge, a separate governance-only evidence PR must record
the implementation PR and merge SHA, shipped adapter behavior, migration/RLS
and authorization evidence, tests, explicit non-goals, and deferred work. Only
that merged evidence may change S015 from `IN_REVIEW` to `DONE`.
