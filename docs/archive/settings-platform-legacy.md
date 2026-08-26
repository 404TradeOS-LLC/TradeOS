---
status: archived
superseded_by: docs/modules/brand-studio.md
do_not_use_for_implementation: true
---

# TradeOS Settings Platform

## Goal

The TradeOS Settings Platform turns `/settings` into a real operational control center instead of a placeholder page. It is designed to scale across company administration, branding, estimating, AI, security, billing, and platform diagnostics without creating parallel UI systems.

## Frontend architecture

- Route entrypoint: `web/src/app/(app)/settings/page.tsx`
- Main client shell: `web/src/components/settings/settings-console.tsx`
- Settings schema and placeholder data: `web/src/components/settings/settings-schema.tsx`
- Shared settings types/defaults: `web/src/lib/settings.ts`
- Server-side API access: `web/src/lib/api.ts`

## Backend architecture

- Route entrypoint: `app/backend/routes/settings.routes.ts`
- Controller: `app/backend/controllers/settings.controller.ts`
- Module: `app/modules/settings/service.ts`
- Types: `app/modules/settings/types.ts`
- Persistence: `app/prisma/migrations/20260703143000_add_organization_settings/migration.sql`

The route stays thin and server-rendered. It passes environment-aware developer metadata into a dedicated client component that owns:

- responsive sidebar navigation
- searchable settings index
- local draft state
- unsaved change detection
- live save/reset flows
- toast feedback
- section rendering

## Schema approach

Settings are modeled as data-driven sections:

- `SettingsSectionDefinition`
- `SettingsCardDefinition`
- `SettingsFieldDefinition`
- `SettingsAssetDefinition`

This makes it straightforward to:

- add a new settings domain without changing layout code
- attach backend payloads section-by-section later
- index fields for global search
- reuse the same rendering system for text, select, toggle, color, asset, status, preview, and record cards

## Search model

The global search bar builds an index from:

- section titles and descriptions
- field labels and descriptions
- asset labels
- section and field keywords

Search results jump directly to the relevant section/card/field anchor, which gives the platform a scalable navigation pattern as settings grow.

## Persistence model

TradeOS now has a real organization-scoped settings API at `GET/PATCH /api/v1/settings`.

- The persisted source of truth is `organization_settings.settings_json`.
- Writes are admin-scoped through forced PostgreSQL row-level security.
- Reads are org-scoped for authenticated members.
- Overlapping identity/pricing fields are synchronized back onto `organizations` so existing proposal/document flows immediately benefit.

## Remaining backend rollout

1. Persist uploaded brand assets through existing storage patterns instead of object URLs.
2. Expose live diagnostics for Knowledge Engine, Billing, Audit Log, Backups, and Developer.
3. Replace placeholder lists for Team, Roles, Sessions, API Keys, and Integrations with live data.
4. Add richer versioning/history if settings-level audit trails become product-critical.

## Notes

- The current page is intentionally prepared for future routing and backend growth, but it does not redesign the rest of the TradeOS app shell.
- The page uses the existing TradeOS UI primitives and keeps business-specific structure out of `components/ui`.
