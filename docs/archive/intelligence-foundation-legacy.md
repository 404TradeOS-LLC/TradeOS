---
status: archived
superseded_by: docs/modules/activity-and-intelligence.md
do_not_use_for_implementation: true
---

# TradeOS Intelligence Foundation

This sprint adds the first reusable intelligence layer for TradeOS without depending on final visual branding.

## What landed

- `app/modules/intelligence/`
  - centralized shared types for cross-module entity references
  - federated global search service with source adapters
  - generic activity timeline service
  - notification center service
  - attachment service
  - universal comments service
  - tag and tag assignment services
  - saved views service
  - recently viewed service
  - feature flag service with scope evaluation
- `app/backend/routes/intelligence.routes.ts`
  - authenticated APIs under `/api/v1/intelligence/*`
- `app/prisma/migrations/20260703190000_add_intelligence_foundation/`
  - org-scoped foundation tables with forced RLS
- `web/src/components/shared/global-command-palette.tsx`
  - global `Cmd+K` / `Ctrl+K` palette
  - keyboard navigation
  - favorite actions
  - recent items
  - federated search results

## Data model

The foundation uses generic entity references instead of module-specific coupling:

- `entity_type`
- `entity_id`
- `org_id`

That allows the same infrastructure to attach to customers, projects, estimates, invoices, files, tasks, and future modules without separate implementations.

New tables:

- `activity_events`
- `notifications`
- `attachments`
- `comments`
- `tags`
- `tag_assignments`
- `saved_views`
- `recent_items`
- `feature_flags`

## API surface

Current endpoints:

- `GET /api/v1/intelligence/search`
- `GET|POST /api/v1/intelligence/activity`
- `GET|POST|PATCH /api/v1/intelligence/notifications`
- `GET|POST|DELETE /api/v1/intelligence/attachments`
- `GET|POST|PATCH /api/v1/intelligence/comments`
- `GET|POST /api/v1/intelligence/tags`
- `GET|POST|DELETE /api/v1/intelligence/tag-assignments`
- `GET|POST|PATCH|DELETE /api/v1/intelligence/saved-views`
- `GET|POST /api/v1/intelligence/recent-items`
- `GET|POST /api/v1/intelligence/feature-flags`
- `POST /api/v1/intelligence/feature-flags/evaluate`

## Search architecture

`GlobalSearchService` is adapter-based. Each source owns how it fetches and shapes searchable records:

- customers
- projects
- estimates
- invoices
- project files/documents

The interface is ready for more sources:

- contracts
- tasks
- vendors
- materials
- AI knowledge
- notes
- calendar events

This keeps the calling API stable if TradeOS later moves from Prisma-backed federated search to a dedicated index.

## Timeline integration

The first object events now record automatically for:

- customer creation
- project creation
- project status changes
- site visit capture
- project file upload
- notifications
- attachments
- comments

Future modules should call `ActivityTimelineService.record()` as part of business actions, not as UI-only side effects.

## Feature flag precedence

`FeatureFlagsService.evaluate()` checks scopes in this order:

1. `internal`
2. `user`
3. `org`
4. `plan`
5. `beta`
6. `global`
7. default `false`

## Frontend usage

The command palette is mounted once from `web/src/app/providers.tsx`, and the header trigger lives in `web/src/app/(app)/layout.tsx`.

The palette currently provides:

- global shortcut support
- instant action launching
- recent item recall
- live federated search

## Next recommended plug-ins

- move project photo/document uploads onto the generic attachment API
- surface notification center UI from the new backend service instead of document-only mock data
- attach tags and comments into project/customer/invoice detail pages
- let list screens persist saved views through the shared saved view API
- add more search adapters for tasks, proposals, contracts, and knowledge records
