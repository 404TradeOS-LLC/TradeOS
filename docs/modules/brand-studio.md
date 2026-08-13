---
status: current
owner: platform
last_verified: 2026-08-12
source_of_truth: false
related_code:
  - app/modules/brand-studio
  - app/backend/routes/brandStudio.routes.ts
  - app/modules/documents
  - web/src/app/(app)/brand-studio/page.tsx
  - web/src/components/brand-studio/brand-studio-console.tsx
---

# Brand Studio

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

## Tests

- `app/tests/brand-studio.service.test.ts`
- `app/tests/brand-studio.migration.test.ts`
- `app/tests/document-frame.test.ts`

## Known limitations

- Brand Studio is current for organization branding, but broader website or public-marketing theming is not the scope here

## Deferred work

- deeper asset workflows if public-facing brand surfaces expand

## Last verified date

2026-08-12
