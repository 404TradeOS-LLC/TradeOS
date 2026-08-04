---
status: current
owner: platform
last_verified: 2026-07-14
source_of_truth: false
related_code:
  - app/modules/settings
  - app/modules/admin-dashboard
  - app/modules/supplier-integration
  - app/modules/supplier-database
  - app/backend/routes/settings.routes.ts
  - app/backend/routes/adminDashboard.routes.ts
  - app/backend/routes/supplierIntegration.routes.ts
  - app/backend/routes/supplierDatabase.routes.ts
  - web/src/app/(app)/settings/page.tsx
  - web/src/components/settings/settings-console.tsx
---

# Settings and Operations

## Purpose

Own the organization settings control center, internal admin summaries, supplier records, and supplier review queue operations.

## Source code locations

- `app/modules/settings/*`
- `app/modules/admin-dashboard/*`
- `app/modules/supplier-integration/*`
- `app/modules/supplier-database/*`
- `web/src/app/(app)/settings/page.tsx`

## Core models

- `OrganizationSettings`
- `Supplier`
- `SupplierPriceUpdate`
- `MaterialPriceAudit`

## Routes

- `/api/v1/settings/*`
- `/api/v1/admin/*`
- `/api/v1/suppliers/*`
- `/api/v1/supplier-integrations/*`

## Permissions

See [RBAC_MATRIX.md](../RBAC_MATRIX.md).

Important current rule:

- supplier review and approval are tighter than ordinary queue submission behavior

## Frontend surfaces

- `/settings`
- internal admin HTML surface at `/admin`

## Tests

- `app/tests/admin-dashboard.service.test.ts`
- `app/tests/admin-dashboard.members.test.ts`
- `app/tests/supplier-database.service.test.ts`
- `app/tests/supplier-integration.service.test.ts`
- `app/tests/supplier-integration.scheduler.test.ts`
- `app/tests/supplier-integration.worker.test.ts`

## Implementation notes

- `admin-dashboard`'s `CreateOrganizationInput` and `supplier-integration`'s `SupplierPriceUpdateStatus`/`SupplierFeedQuote` are file-local types; their `export` keyword was removed after confirming no other module imports them by name
- Settings Console brand asset uploads (`logoUrl`/`darkLogoUrl`/`iconUrl`/`watermarkUrl`) go through a server-only Supabase service_role client (`web/src/lib/supabase/admin.ts`, requires `SUPABASE_SERVICE_ROLE_KEY` — never `NEXT_PUBLIC_`-prefixed, never sent to the browser), not the anon/publishable client used elsewhere. The `project-files` bucket is private; there are no `anon`/`authenticated` Storage RLS policies on `storage.objects` at all, since the service_role key bypasses Storage RLS entirely and authorization is enforced in `uploadSettingsAssetAction`/`removeSettingsAssetAction` before any Storage call (session + org membership + the `team.manage`/`company.manage`/`settings.manage` role gate). Storage location metadata (bucket/path/content type/size) is persisted in the application's own `settings_asset_uploads` table (forced RLS, admin-only write, `app/prisma/migrations/20260728120000_add_settings_asset_uploads`), not inferred from a URL string. The backend accepts only the `project-files` bucket, the authenticated organization's exact generated brand-asset namespace, passive raster content types (PNG/JPEG/WebP/GIF/ICO), and files up to 6 MB, preventing a crafted metadata request from redirecting the service-role read proxy to another object. Reads go through `web/src/app/api/brand-assets/[orgId]/[assetKey]/route.ts`, a server-side proxy that verifies the caller's session org matches the requested org before streaming bytes with `nosniff` and a restrictive CSP; the normal UI receives only the stable app-owned proxy URL. Replacing an asset uploads a fresh, server-generated object name, persists the new metadata row, and only then deletes the previous object, so a failure between those steps leaves an orphaned object rather than a broken active asset.

## Known limitations

- live supplier feed fetching is still stubbed
- internal admin surfaces are operational tooling, not contractor-facing product routes
- Settings Console's brand asset fields (`logoUrl`/`darkLogoUrl`/`iconUrl`/`watermarkUrl`, persisted via `organization.logoUrl` and `organizationSettings.settingsJson`) are not currently rendered into any generated document or customer portal page. The live PDF generators (`app/modules/invoices/pdf.ts`, `app/modules/contracts/pdf.ts`, `app/modules/proposal-generator/service.ts`) are pdfkit-based and draw only a `companyName` text header — none of them call `.image()` or reference a logo/brand field, and the portal pages under `web/src/app/(app)/portal/**` don't render one either. The one place in the codebase that does treat a logo as a real `<img>` (`app/modules/documents/frame.ts` / `templates.ts`) has no live caller outside `app/tests/document-frame.test.ts`. A prior commit fixing this module's asset-upload persistence bug described the affected fields as driving "customer-facing PDF and portal branding" — that description is not accurate as of this writing; persisting these fields correctly is still a real, worthwhile fix (the previous blob-URL behavior broke on reload), it just has no visible customer-facing effect yet because nothing consumes the fields downstream.

## Deferred work

- real supplier feed connectors
- additional operational reporting beyond current queue and admin summaries

## Last verified date

2026-07-14
