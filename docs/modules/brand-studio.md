---
status: current
owner: platform
last_verified: 2026-08-16
source_of_truth: false
related_code:
  - app/modules/brand-studio
  - app/backend/routes/brandStudio.routes.ts
  - app/modules/documents
  - web/src/app/(app)/brand-studio/page.tsx
  - web/src/components/brand-studio/brand-studio-console.tsx
---

# Brand Studio

## Private SettingsAssetUpload to PDFKit logo bridge — pending acceptance

The backend PDF reader uses only organization-scoped current `SettingsAssetUpload(orgId, logoUrl)` metadata, the private `project-files` bucket, and a server-only Supabase credential. Arbitrary BrandAsset URLs and untrusted request-body image bytes are excluded. It checks bucket, generated name and organization prefix, expected MIME, size, actual signature/dimensions, no redirects and bounded read. The existing text company name remains on any failure. This is a protected runtime dependency requiring reviewed environment configuration and tenant PDF validation before production acceptance.

## Trusted logo bytes in PDF renderers — bridge implemented; staging acceptance pending

PDFKit supports bounded PNG/JPEG image byte input only, not direct URL fetching. This proposed primitive does not read Brand Studio storage by itself or loosen organization scoping. The authoritative active upload remains the private `SettingsAssetUpload` record and only an authenticated storage owner may provide bytes to the renderer. PR #873 implements the private organization-scoped Storage loader; it still requires a protected staging-only backend key and uploaded same-tenant test logo. Without either, PDFs retain text-only branding. Issue #870 remains open for staging and visual validation.

PNG pixel-stream pre-validation (`isDecodablePngImage`, `app/modules/documents/pdf-logo.ts`): header/magic-byte validation is not enough for PNGs. PDFKit (png-js) inflates IDAT asynchronously and throws inflate/filter errors inside the zlib callback — outside any try/catch around `doc.image` and outside the document's error listener — so a header-valid PNG with corrupt pixel data would hang or crash the PDF generation instead of falling back to text. The pre-validation parses the PNG chunks, verifies every chunk CRC, inflates IDAT synchronously with the output bounded to the expected scanline size, and checks every scanline filter byte is 0..4; anything else is rejected and the renderer falls back to text. The proposal signature path uses it (DES-10-F7 signature display). The organization-logo path (`drawValidatedPdfLogo`) now applies the same pre-validation to PNG logo bytes before `doc.image`, so a corrupt-pixel logo fails closed to text branding instead of hanging or crashing the render — the follow-up from PR #1094, closed in the org-logo pre-validation fix (issue #870 area).

## Purpose

Own organization-scoped branding data and shared document-frame presentation settings used across proposals, contracts, and invoices.

## Source code locations

- `app/modules/brand-studio/*`
- `app/modules/documents/*`
- `app/backend/routes/brandStudio.routes.ts`
- `web/src/app/(app)/brand-studio/page.tsx`

## Core models

- `BrandProfile`
- `BrandAsset`
- `BrandDocumentSettings`

## Routes

- `/api/v1/brand-studio/*`

## Permissions

See [RBAC_MATRIX.md](../RBAC_MATRIX.md).

## Frontend surfaces

- `/brand-studio`

## Document-frame defaults

The shared document frame defines safe fallback CSS custom properties for its palette and typography so the stylesheet renders deterministically even before organization branding is injected. `renderDocumentFrameHtml()` still injects the organization's configured colors and font families at runtime and those values override the fallbacks. The fallback font stacks include a generic `sans-serif` family and do not change persisted Brand Studio settings or document data.

## Platform defaults — TradeOS master logo package

An organization that has not set its own brand renders the TradeOS master logo package as its default. The package is committed verbatim at `docs/brand/tradeos-master-logo-package/` and served from `web/public/brand/` (byte-identical copies, hash-enforced by `web/src/app/brand-source.test.ts`). Both Brand Studio preview builders (`web/src/lib/brand-studio.ts` and `app/modules/brand-studio/service.ts`, `TRADEOS_BRAND_DEFAULTS`) resolve an unset logo/icon/watermark/cover to the package files and unset colors to copper `#C98460` / charcoal `#222426` / warm ivory `#F7F5F1`. The defaults are display fallbacks only: nothing is persisted into the organization's profile, explicit profile values and uploaded assets always win, clearing an upload returns the slot to the platform default, and the setup checklist and completion score still measure the organization's own branding. The favicon derives from the organization's own logo before falling back to the package mark; mono/print variants derive only from organization-owned art (the package ships its own one-color masters). Fresh-organization documents therefore render with the TradeOS lockup and palette until the organization brands itself.

The warranty frame (`renderWarrantyFrameHtml`, S069) renders its effective date only from an explicitly supplied warranty `startsAt`: when no start was recorded the frame shows "Not recorded" for both the "Effective" field and the "Coverage in force" metric. It never substitutes the warranty record's creation date — that would publish a coverage date staff did not supply. The same rule holds for the recorded expiry: the frame renders an "Expires" field from the warranty `endsAt` exactly as stored, and shows "Not recorded" when no end was recorded — never an invented date.

## Document rendering integration

S016 consumes the canonical `BrandProfile` and `BrandDocumentSettings` through
the existing server-derived organization context for proposal, invoice, and
contract PDF generation. The shared resolver applies canonical company
identity, safe validated colors, contact details, and configured trust-signal
visibility; missing optional branding falls back deterministically, including
compatibility contact values from the organization shell or legacy settings
snapshot. A caller cannot replace persisted organization branding by supplying
a company name when authenticated `orgId` context is available. No schema,
asset lifecycle, storage, authorization, or public-branding behavior changes.

## Implementation notes

S015 owns the compatibility boundary between this canonical Brand Studio
source and the legacy Settings surface. The implementation contract is
documented in [S015_BRAND_PROFILE_SETTINGS_ADAPTER_PLAN.md](../architecture/S015_BRAND_PROFILE_SETTINGS_ADAPTER_PLAN.md):
canonical BrandProfile/BrandDocumentSettings values win, legacy Settings values
are adopted lazily and non-destructively, and existing organization scoping,
permissions, fallbacks, and route shapes remain intact.

- Fixed a production defect (found via static audit after a matching bug crashed `PATCH /api/v1/settings` in production, see [settings-and-operations.md](settings-and-operations.md)): `updateProfile`, `createAsset`, and `updateDocumentSettings` called `prisma.$transaction(...)` directly on the request-scoped `prisma` proxy, which throws inside any real authenticated request because `databaseSession` middleware already runs the request inside a `Prisma.TransactionClient` that has no `$transaction` method. All three now use the existing `runInDatabaseTransaction()` helper, matching the convention already used elsewhere (`jobs`, `athena-events`, `athena-memory`, `costbook`). No route contract, permission, or schema change.

- Document download filenames are sanitized for the `Content-Disposition` header: `sanitizeDownloadFilename` (`app/modules/documents/format.ts`) replaces every character outside printable ASCII with `-`, applied by the invoice, contract, proposal, proposal-generator, and customer-portal PDF controllers before `setHeader`. This fixes a production 500: a project name containing an em-dash (for example "Condo Two — Renovation & Punch List") made Node reject the header value (`ERR_INVALID_CHAR`) after the PDF had rendered successfully. Rendering, branding, routes, permissions, and schema are unchanged; only the header filename is ASCII-folded.

## Tests

- `app/tests/brand-studio.service.test.ts`
- `app/tests/brand-studio.migration.test.ts`
- `app/tests/document-frame.test.ts`
- `app/tests/documents.branding.test.ts`

## Known limitations

- Brand Studio is current for organization branding, but broader website or public-marketing theming is not the scope here

## Deferred work

- deeper asset workflows if public-facing brand surfaces expand

## Last verified date

2026-08-24 (S016 document-rendering integration branch)

## S022 rendering boundary

S022 continues to resolve document branding from the canonical Brand Studio profile and document settings. Rendering sanitizes colors, font families, and asset URLs as before; the first slice adds deterministic document formatting and introduces no remote asset fetching, arbitrary fonts, or second branding source.
