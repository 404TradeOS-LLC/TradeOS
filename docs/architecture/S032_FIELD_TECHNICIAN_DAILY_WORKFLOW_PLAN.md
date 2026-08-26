---
status: READY
owner: platform
last_verified: 2026-08-26
source_of_truth: true
related_code:
  - app/modules/jobs/service.ts
  - app/backend/controllers/jobs.controller.ts
  - app/backend/routes/jobs.routes.ts
  - web/src/app/(app)/dispatch
  - web/src/lib/api.ts
related_docs:
  - docs/SPRINT_BACKLOG.md
  - docs/modules/jobs-and-scheduling.md
  - docs/API_REFERENCE.md
  - docs/RBAC_MATRIX.md
  - docs/WORKFLOW_LIFECYCLES.md
  - docs/CURRENT_STATE.md
---

# S032 — Field Technician Daily Workflow

Status: READY  
Dependencies: S012 DONE; S030 DONE  
Founder decision required: NO under the existing Job lifecycle, assignment,
authentication, organization, and forced-RLS contracts.

## Objective

Give an authenticated technician a usable, responsive daily workspace for the
jobs already assigned to that technician. The workspace must expose the
minimum job briefing needed to execute the visit, the existing permitted field
status actions, job notes, and completion feedback without creating a second
Jobs backend or changing lifecycle policy.

## Existing foundation verified

- `JobsService.list()` and `getById()` scope technician reads to active,
  non-declined assignments inside the authenticated organization.
- The existing service exposes `startTravel`, `arrive`, `pause`, `resume`, and
  `complete`, with field-worker and assigned-job checks routed through the
  canonical lifecycle contract.
- Existing job detail DTOs include schedule, arrival window, service address,
  equipment, notes, and recent activity; the Athena field context tool already
  demonstrates the minimized technician-facing context shape.
- Existing `POST /api/v1/jobs/:jobId/notes` persists organization-scoped job
  notes with actor attribution.
- S012 and S030 verify lifecycle semantics and dispatcher/API/RLS foundations;
  S032 consumes those contracts rather than reimplementing them.

## Bounded implementation contract

In scope:

- Add a technician-facing responsive daily workspace using the existing
  authenticated app shell and Jobs routes. A dedicated `/field` surface is an
  implementation detail of this contract; it must not create a new backend
  route family or role.
- Show the technician's assigned work for the current organization day, with
  explicit loading, empty, error, and partial-data states.
- Show a selected job's title, status, schedule/arrival window, customer and
  project context needed for the visit, service address, equipment, existing
  notes, and recent activity without exposing unrelated organization data.
- Provide only permitted field actions for the current status: start travel,
  arrive, pause with a reason, resume, and complete. Refresh rendered job state
  after each mutation and surface deterministic API errors.
- Add a plain-text job-note flow using the existing notes endpoint, with clear
  save/error feedback and no silent loss of entered text.
- Add focused web/API contract coverage for technician filtering, action
  visibility, mutation refresh/error behavior, note submission, and responsive
  empty/loading/error states.
- Update documentation ownership files required by changed paths and record
  completion evidence after merge.

## Security and lifecycle invariants

- Preserve authenticated organization context and forced PostgreSQL RLS.
- A technician may see or mutate only jobs with that technician's active,
  non-declined assignment. Cross-organization IDs, forged job IDs, inactive or
  declined assignments, and missing authentication fail closed.
- Preserve `scheduled -> dispatched -> traveling -> on_site -> completed`,
  `on_site <-> paused`, the required pause reason, activity attribution, and
  canonical `WorkCompleted` event behavior.
- Do not grant technicians dispatch, scheduling, rescheduling, cancellation,
  reopen, assignment-management, or ready-for-invoice actions.
- Render only the existing technician-safe context needed for the visit.

## Explicit non-goals

- No new Job statuses, roles, permissions, migrations, tables, RLS policies, or
  persistence models.
- No GPS, routing, maps, time tracking, payroll/overtime, offline sync,
  background queue, push notification, customer messaging, photo/file upload,
  voice transcription, change-order creation, or inventory/material usage.
- No dispatcher, owner dashboard, customer portal, Athena, billing, S033,
  S034, S037, or S027 redesign/work.
- No production/browser evidence is claimed unless an authorized session and
  environment actually provide it; S027 remains independent.

## Required validation

Run `git diff --check`, repository PR preflight, docs tests, backend
Jobs/controller tests, frontend unit tests, app/web lint and builds, and the
GitHub PostgreSQL/RLS integration lane when available. Adversarial coverage
must include wrong organization, forged job identifier, unassigned,
declined/removed assignment, insufficient role, malformed mutation, stale
status, repeated action, missing request context, and failed note submission.

## Completion evidence

Record implementation and merge SHAs, rendered behavior, API/RLS authorization
evidence, tests/CI, review findings, non-goals, and environment-dependent
browser evidence in `docs/architecture/S032_COMPLETION_EVIDENCE.md` before
marking S032 `DONE`.
