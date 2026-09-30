---
status: current
owner: platform
last_verified: 2026-09-10
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
- `GET /api/v1/intelligence/activity` returns org-scoped activity rows ordered by `occurredAt`/`createdAt`, capped server-side, and now requires `crm.read` whenever the request can include task events (explicit `entityType=task` or omitted `entityType`).

## Permissions

See [RBAC_MATRIX.md](../RBAC_MATRIX.md).

## Emitted activity events

- job workflow changes
- proposal, contract, and invoice history changes
- intelligence-specific activity records
- customer lifecycle changes (`customer.created`, `customer.updated`, `customer.deleted`), from `app/backend/controllers/crm.controller.ts`
- estimate lifecycle changes (`estimate.created`, `estimate.line_item_added`, `estimate.line_item_removed`, `estimate.pricing_mode_updated`, `estimate.finalized`, `estimate.duplicated`), from `app/backend/controllers/estimateEngine.controller.ts`
- project-task lifecycle changes (`task.created`, status transitions such as `task.blocked`/`task.completed`, generic `task.updated`, and `task.deleted`), recorded from `app/backend/controllers/projectTasks.controller.ts`

## Frontend surfaces

- global command palette
- notification center
- project activity feed and related timeline surfaces
- the owner dashboard's "Recent task movement" panel, sourced from `/api/v1/intelligence/activity?entityType=task`

## Tests

- `app/tests/intelligence.service.test.ts`

## Implementation notes

- this module's `DOC_OWNERSHIP.yml` grouping is shared with `ai-estimate-assist`/`knowledge-runtime`; a recent internal dead-code cleanup touched `knowledge-runtime/repository.ts` (see `modules/ai-estimate-assist.md`) but did not change anything in `app/modules/intelligence/*` or this module's behavior
- a production fix to `knowledge-runtime`'s Vercel packaging (see `modules/ai-estimate-assist.md`'s Known Limitations) also did not change anything in `app/modules/intelligence/*` or this module's behavior; noted here only because this doc shares the same `DOC_OWNERSHIP.yml` grouping
- the follow-up Vercel function packaging fix explicitly includes `app/vendor/knowledge-engine/**` in the backend function bundle and teaches the loader to resolve both source-style and compiled `dist/` runtime layouts; this keeps `/api/v1/knowledge/*` available in hosted runtime packaging without creating new activity events, notifications, search behavior, or intelligence write paths
- the structured AI estimator records non-sensitive activity events for draft generation and reviewed apply actions; its authenticated draft path also persists redacted generation metadata, and owner/admin review applies persist append-only review provenance without storing complete contractor prompts in activity metadata
- project-task create/update/delete now record their matching activity row inside the same database transaction as the task mutation, so the API cannot return a task-write failure after the task row has already committed
- the 2026-09-08 Costbook provenance-status work (see `modules/ai-estimate-assist.md`) added a `provenanceStatus` field to Knowledge Runtime records, search results, matcher output, and AI Estimate Assist suggestions/draft line items, and a new candidate-cost-item validation contract in `app/modules/costbook/`; noted here only because this doc shares the same `DOC_OWNERSHIP.yml` grouping — it did not change activity events, notifications, or anything in `app/modules/intelligence/*`
- the 2026-09-08 `knowledge-runtime` trade-inference fix (see `modules/ai-estimate-assist.md` and `docs/reports/KNOWLEDGE_TRADE_INFERENCE_AUDIT_2026-09-08.md`) rewrote `repository.ts`'s trade classifier; noted here only because this doc shares the same `DOC_OWNERSHIP.yml` grouping — it did not change activity events, notifications, or anything in `app/modules/intelligence/*`
- the 2026-09-09 item-level provenance/source metadata contract (see `modules/ai-estimate-assist.md` and `docs/reports/COSTBOOK_ITEM_PROVENANCE_METADATA_2026-09-09.md`) added optional per-item fields to `cost-item.schema.json` and a `resolveItemProvenance()` fallback in `knowledge-runtime/repository.ts`; noted here only because this doc shares the same `DOC_OWNERSHIP.yml` grouping — it did not change activity events, notifications, or anything in `app/modules/intelligence/*`
- the 2026-09-10 provenance follow-up slice (see `modules/ai-estimate-assist.md`) extended the same contract to assemblies, added a generation-pipeline enforcement gate, surfaced source/confidence detail on AI suggestion/draft-line responses and the Estimate Assist UI, and added a required blocking CI job for the provenance validator; noted here only because this doc shares the same `DOC_OWNERSHIP.yml` grouping — it did not change activity events, notifications, or anything in `app/modules/intelligence/*`

## Known limitations

- some older product timelines are still partly derived from record timestamps plus compatibility history

## Deferred work

- broader analytics or recommendation layers beyond the current shared primitives

## Last verified date

2026-09-10
