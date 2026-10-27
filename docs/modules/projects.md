---
status: current
owner: platform
last_verified: 2026-09-28
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
- nested task update/delete routes require the task's persisted `projectId` to match the route `:id`; a replacement `jobId` on task update must resolve to an active job in the authenticated organization and that same project, otherwise the request returns 404 before mutation

## Permissions

See [RBAC_MATRIX.md](../RBAC_MATRIX.md).

## Lifecycle and statuses

See [WORKFLOW_LIFECYCLES.md](../WORKFLOW_LIFECYCLES.md). Project responses are normalized to the canonical seven-state vocabulary. Existing legacy values remain accepted on reads through `legacyProjectStatusMap`, while new project status mutations and proposal-driven project side effects persist canonical values only.

Proposal workflow side effects are deliberately mapped to the project lifecycle: draft creation, duplication, decline, send, and resend use `estimating`; acceptance uses `awarded`. This preserves the existing lifecycle meaning without continuing to create new `proposal_*` or `accepted` project-status rows.

## Frontend surfaces

- `/projects`
- `/projects/new`
- `/projects/[id]`
- `/projects/[id]/intake`

The default Project detail route has a bounded Project-backed Lead presentation for the two approved pre-estimate states:

- **New Lead** — no Estimate/Site Visit and no downstream Proposal/Contract/Job.
- **Ready to Estimate** — a Site Visit exists, no Estimate exists, and no downstream Proposal/Contract/Job exists.

These states do not create a separate Lead model or qualification field. Once an Estimate exists, normal Project workspace presentation resumes.

`/projects/[id]/intake` is the field capture surface for the current Site Visit contract. Photos, measurements, and notes are the primary mobile inputs; secondary timing/location/transcript/customer/material/safety/verification fields are progressively disclosed. Saving continues through the existing Site Visit action and intake-analysis backend path.

The supported handoff after a captured Site Visit is **Create Estimate** through the existing Project-linked Estimate action. The UI does not claim Site Visit context is automatically transformed into priced line items; the visit remains attached to the Project for estimator review.

Customer-context Project creation reuses the existing Customer and ServiceAddress reads rather than introducing a Project→ServiceAddress relation. When `/projects/new?customerId=...` resolves an authorized Customer, the form shows that existing CRM identity, offers its active saved ServiceAddress rows, and copies the selected formatted address into the existing `Project.siteAddress` string on create. Normal creation opens the newly created Project workspace immediately; the explicit **Create & start estimate** action reuses the existing `intent=estimate` path and Estimate Engine create route. Context-free Project creation and the existing Job create intent remain supported.

Project workspace surfaces also expose the current job and field-coordination workflow for the linked project.

## Tests

- `app/tests/projects.controller.test.ts`
- `app/tests/project-tasks.service.test.ts`
- `app/tests/projectIntake.controller.test.ts`
- `app/tests/project-intake.service.test.ts`

## Known limitations

- project lifecycle persistence still includes historical compatibility values that normalize into canonical display states; S007 prevents new proposal workflow writes from adding those aliases

## Deferred work

- deeper closeout and warranty workflows

## Last verified date

2026-09-28

## Today contextual task saves

Today/Needs You/Work task dialogs use `PATCH /api/v1/projects/:id/tasks/:taskId/status`, a status-only guarded route sharing the existing project-task mutation and transactional activity history. It requires status plus revision, rejects unrelated fields, and fails closed with 404 on older backends; the client never falls back. Controls follow existing `crm.write`, with no new technician access. The optional `expectedUpdatedAt` request precondition is enforced in the database update predicate; a stale or concurrently changed task returns 409 without a saved mutation/activity event. Every update advances the revision, including same-millisecond edits. Existing clients can omit the precondition for backward compatibility. Today requires a valid source revision and sends only status plus that revision; successful confirmed saves refresh the operational queues. Offline, rejected and unconfirmed saves are not treated as resolutions. No schema or RLS changes.

## Assigned-job task visibility (Today follow-up, 2026-10-27)

`GET /api/v1/projects/assigned-job-tasks?limit=50` returns open shared tasks
attached to the authenticated user's actively assigned, non-archived, nonterminal
Jobs. The controller derives organization and user identity from authentication;
unknown query keys and limits outside 1–50 are rejected. The service additionally
filters Project and Job tenant ownership and active (not removed or declined)
JobAssignments, under the existing forced RLS session. This projects the same
tasks already exposed by an authorized Job detail read; it grants no writes.

Technician Today uses this endpoint rather than the organization task queue.
Shared tasks appear in Work, with blocked/overdue tasks in Needs You and due-day
counts using stored calendar dates. Free-text `assignedTo` remains display-only,
not personal authorization. Field rows open `/field?job=…`; the existing Field
workspace now displays Job DTO tasks and directs progress reports to Job notes.
Task status edits retain existing office permissions. Results at the 50-row cap
are explicitly partial; a task-source failure leaves job scheduling usable and
task counts unknown. No schema, RLS policy or mutation authority changed.

## Personal field-task ownership and status updates (2026-10-27)

Implementation on `feat/field-task-ownership` adds nullable
`ProjectTask.assignedUserId` (user FK, no name-based backfill). Shared job tasks
remain readable. Only the authenticated technician personally assigned by user
ID, with an active non-declined JobAssignment on a nonterminal/unarchived Job,
may use `PATCH /api/v1/jobs/:jobId/tasks/:taskId/status`. The strict payload is
status plus mandatory expectedUpdatedAt. The transaction locks Job/assignment
rows, checks tenant/identity/revision, updates atomically and records activity.
Stale saves return 409; invisible/not-assigned records return 404.

The migration removes technicians from the historical broad project-task write
policy (whose generic helper includes technicians), adds a narrowly scoped RLS
update policy, and restricts technician updates to status/timestamps with an
immutable-column trigger. DB-controlled timestamps retain millisecond revision
precision. Technician task create/delete/reassignment remains denied.

Owner/admin/dispatcher may create or revise explicit assignment through the
Project Tasks forms and the existing guarded generic PATCH. The new scoped
`GET /api/v1/projects/:id/task-assignees` returns only permitted active-member
choices and a server-derived capability. Legacy estimator ordinary task writes
are preserved; this new identity-administration capability is not silently
granted. Existing office status/title/note updates do not revalidate historical
assignment eligibility unless identity or Job linkage changes.

Today and Field job details return a server-derived canUpdateStatus flag based
on the actual auth role, not the normalized settings presentation role. Only
explicit nonempty matching identity, revision and capability enable the shared
status editor; older/partial responses fail closed. UI saves use the narrow
Job endpoint and verify record/project/Job/status before showing success.
Assignment changes refresh the source and operational routes. No optimistic
queue dismissal, automatic retry, financial change or production migration.

This is a schema/RLS change requiring governed review and migration rehearsal
before activation. Unit/type/build and hosted PostgreSQL/browser results must
be recorded from the final head; authored tests alone are not certification.
