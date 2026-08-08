---
status: current
owner: platform
last_verified: 2026-08-08
source_of_truth: false
related_code:
  - app/modules/intelligence
  - app/backend/routes/intelligence.routes.ts
  - app/backend/controllers/crm.controller.ts
  - app/backend/controllers/estimateEngine.controller.ts
  - web/src/components/shared/global-command-palette.tsx
  - web/src/components/shared/notification-center.tsx
  - web/src/lib/intelligence.ts
---

# Activity and Intelligence

## Purpose

Provide the shared activity, notification, recent-item, feature-flag, and search-oriented primitives that connect multiple product areas.

## Source code locations

- `app/modules/intelligence/*`
- `app/backend/routes/intelligence.routes.ts`
- `web/src/components/shared/global-command-palette.tsx`
- `web/src/components/shared/notification-center.tsx`

## Core models

- `ActivityEvent`
- `Notification`
- `SavedView`
- `RecentItem`
- `FeatureFlag`

## Routes

- `/api/v1/intelligence/*`

## Permissions

See [RBAC_MATRIX.md](../RBAC_MATRIX.md).

## Emitted activity events

- job workflow changes
- proposal, contract, and invoice history changes
- intelligence-specific activity records
- customer lifecycle changes (`customer.created`, `customer.updated`, `customer.deleted`), from `app/backend/controllers/crm.controller.ts`
- estimate lifecycle changes (`estimate.created`, `estimate.line_item_added`, `estimate.line_item_removed`, `estimate.pricing_mode_updated`, `estimate.finalized`, `estimate.duplicated`), from `app/backend/controllers/estimateEngine.controller.ts`

## Frontend surfaces

- global command palette
- notification center
- project activity feed and related timeline surfaces

## Tests

- `app/tests/intelligence.service.test.ts`

## Implementation notes

- this module's `DOC_OWNERSHIP.yml` grouping is shared with `ai-estimate-assist`/`knowledge-runtime`; a recent internal dead-code cleanup touched `knowledge-runtime/repository.ts` (see `modules/ai-estimate-assist.md`) but did not change anything in `app/modules/intelligence/*` or this module's behavior
- a production fix to `knowledge-runtime`'s Vercel packaging (see `modules/ai-estimate-assist.md`'s Known Limitations) also did not change anything in `app/modules/intelligence/*` or this module's behavior; noted here only because this doc shares the same `DOC_OWNERSHIP.yml` grouping
- the structured AI estimator records non-sensitive activity events for draft generation and reviewed apply actions; it does not create notifications or store complete contractor prompts in activity metadata

## Known limitations

- some older product timelines are still partly derived from record timestamps plus compatibility history

## Deferred work

- broader analytics or recommendation layers beyond the current shared primitives

## Last verified date

2026-08-08
