---
status: current
owner: platform
last_verified: 2026-07-14
source_of_truth: false
related_code:
  - app/backend/routes/projects.routes.ts
  - app/modules/project-tasks
  - app/modules/project-intake
  - web/src/app/(app)/projects
  - web/src/components/projects
---

# Projects

## Purpose

Own the project workspace, project detail route, files, site visits, project tasks, and project-linked job coordination that tie the commercial and field workflows together.

## Source code locations

- `app/backend/routes/projects.routes.ts`
- `app/modules/project-tasks/*`
- `app/modules/project-intake/*`
- `web/src/app/(app)/projects/**`
- `web/src/components/projects/**`

## Core models

- `Project`
- `ProjectFile`
- `SiteVisit`
- `ProjectTask`

Operational relationship:

- projects are the workspace hub
- jobs remain separate first-class execution records linked to projects, customers, and service addresses

## Routes

- `GET|POST /api/v1/projects`
- `GET /api/v1/projects/tasks`
- `GET|PATCH /api/v1/projects/:id`
- `PATCH /api/v1/projects/:id/status`
- project site-visit, file, and task sub-routes under `/api/v1/projects/:id/*`

Task route details:

- `GET /api/v1/projects/tasks` returns an org-scoped task list with project/customer/job context for dashboard and operational queue surfaces; it reuses `app/modules/project-tasks/service.ts` and the existing request auth + org/RLS middleware path rather than creating a dashboard-only task store
- `GET /api/v1/projects/:id/tasks` remains the per-project task list for the project workspace

## Permissions

See [RBAC_MATRIX.md](../RBAC_MATRIX.md).

## Lifecycle and statuses

See [WORKFLOW_LIFECYCLES.md](../WORKFLOW_LIFECYCLES.md).

## Frontend surfaces

- `/projects`
- `/projects/new`
- `/projects/[id]`
- `/projects/[id]/intake`

Project workspace surfaces also expose the current job and field-coordination workflow for the linked project.

## Tests

- `app/tests/projects.controller.test.ts`
- `app/tests/project-tasks.service.test.ts`
- `app/tests/projectIntake.controller.test.ts`
- `app/tests/project-intake.service.test.ts`

## Known limitations

- project lifecycle persistence still includes compatibility values that normalize into canonical display states

## Deferred work

- deeper closeout and warranty workflows

## Last verified date

2026-07-14
