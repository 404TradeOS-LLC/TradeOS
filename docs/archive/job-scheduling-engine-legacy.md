---
status: archived
superseded_by: docs/modules/jobs-and-scheduling.md
do_not_use_for_implementation: true
---

# TradeOS Job Scheduling Engine

TradeOS now separates the commercial record from field execution:

- `Project` is the customer/commercial container.
- `Job` is the scheduled unit of field work.

This keeps estimates, proposals, contracts, invoices, and customer-facing lifecycle state attached to the project while dispatch, technician assignment, and field execution move through a first-class jobs engine.

## Project vs Job

- One service call can be `1 Project -> 1 Job`.
- One remodel or installation can be `1 Project -> many Jobs`.
- Jobs inherit organization, project, customer, and service-address context, but they own:
  - schedule
  - technician assignments
  - dispatch state
  - field execution state
  - ready-for-invoice readiness

## Models

### `jobs`

Core columns:

- `org_id`
- `project_id`
- `customer_id`
- `service_address_id`
- `job_number`
- `title`
- `description`
- `job_type`
- `status`
- `priority`
- `scheduled_start`
- `scheduled_end`
- `arrival_window_start`
- `arrival_window_end`
- `estimated_duration_minutes`
- `actual_start`
- `actual_end`
- `completed_at`
- `completed_by_id`
- `ready_for_invoice_at`
- `created_by_id`
- `created_at`
- `updated_at`
- `archived_at`

Indexes:

- org + status
- project
- customer
- service address
- scheduled start
- org + archived state
- org + job number unique

Job numbers are company-scoped and generated as:

- `JOB-<year>-<6 digit sequence>`

Generation uses a transaction-scoped advisory lock to avoid collisions under concurrent creates.

### `job_assignments`

Supports multi-technician staffing with history-preserving soft removal.

Columns:

- `org_id`
- `job_id`
- `user_id`
- `assignment_role`
- `is_lead`
- `assigned_at`
- `assigned_by_id`
- `accepted_at`
- `declined_at`
- `removed_at`
- `created_at`
- `updated_at`

Constraints:

- only one active assignment per user per job
- only one active lead assignment per job
- assignment history preserved via `removed_at`

### `job_equipment`

Minimal join table linking existing customer equipment to a job.

### Existing-domain attachments

This sprint keeps convergence intentionally small:

- `project_tasks.job_id` is optional
- `site_visits.job_id` is optional
- notes reuse `comments` with `entity_type = "job"`
- activity reuses `activity_events` with `entity_type = "job"`
- attachments can continue using the existing polymorphic intelligence layer without a second document timeline

## Lifecycle

Canonical job statuses:

- `unscheduled`
- `scheduled`
- `dispatched`
- `traveling`
- `on_site`
- `paused`
- `completed`
- `cancelled`

Supported transitions:

- `unscheduled -> scheduled`
- `scheduled -> dispatched`
- `dispatched -> traveling`
- `traveling -> on_site`
- `on_site -> paused`
- `paused -> on_site`
- `on_site -> completed`
- `scheduled -> cancelled`
- `dispatched -> cancelled` with required reason
- `paused -> cancelled` with required reason

Administrative actions:

- `PUT /api/v1/jobs/:jobId/schedule`
- `POST /api/v1/jobs/:jobId/reschedule`
- `POST /api/v1/jobs/:jobId/reopen`
- `POST /api/v1/jobs/:jobId/ready-for-invoice`

Rules:

- generic status patching is not allowed
- completed jobs must be reopened before rescheduling
- cancelled jobs must be reopened before scheduling again
- archived jobs cannot transition

## Scheduling Rules

Service-layer validation enforces:

- `scheduledEnd > scheduledStart`
- `arrivalWindowEnd > arrivalWindowStart`
- arrival window stays within the scheduled date range
- `estimatedDurationMinutes` must be positive
- cancelled or archived jobs cannot be dispatched
- active technician overlaps are treated as schedule conflicts

Conflict definition for RC1:

- the same active technician is assigned to overlapping scheduled jobs

Conflict handling:

- conflicts return structured `409` responses with `details.code = "schedule_conflict"`
- no silent overwrite
- only `owner` and `admin` may override conflicts
- override requires both `overrideConflict: true` and `overrideReason`
- overrides emit `job.schedule_conflict_overridden`

## Assignments

Supported assignment roles:

- `lead`
- `technician`
- `helper`

Rules:

- assigned users must have an active membership in the same org
- assigned users must be active app users
- this sprint restricts assignments to org members whose membership role is `technician`
- duplicate active assignments are blocked
- one active lead per job is enforced in SQL
- technicians can accept or decline only their own assignments

## RBAC Matrix

### Owner

- full access to all jobs, schedules, assignments, overrides, reopen actions, and invoice-readiness actions

### Admin

- same operational access as owner

### Dispatcher

- create and edit jobs
- schedule and reschedule
- assign and remove technicians
- dispatch and cancel
- mark ready for invoice
- view all org jobs
- cannot override schedule conflicts in RC1
- cannot reopen completed jobs

### Technician

- can view only jobs actively assigned to them
- can view the assigned team for those jobs
- can read job notes, tasks, site visits, equipment summary, and recent activity for assigned jobs
- can accept or decline their own assignments
- can move assigned jobs through:
  - `traveling`
  - `on_site`
  - `paused`
  - `completed`
- cannot create jobs
- cannot reassign staff
- cannot view unassigned jobs

## API Routes

### Jobs

- `POST /api/v1/jobs`
- `GET /api/v1/jobs`
- `GET /api/v1/jobs/:jobId`
- `PATCH /api/v1/jobs/:jobId`
- `DELETE /api/v1/jobs/:jobId`

List filters:

- `status`
- `priority`
- `projectId`
- `customerId`
- `technicianId`
- `scheduledFrom`
- `scheduledTo`
- `archived`
- `search`
- `page`
- `pageSize`

### Scheduling

- `PUT /api/v1/jobs/:jobId/schedule`
- `POST /api/v1/jobs/:jobId/reschedule`
- `GET /api/v1/schedule`
- `GET /api/v1/schedule/conflicts`

### Assignments

- `GET /api/v1/jobs/:jobId/assignments`
- `POST /api/v1/jobs/:jobId/assignments`
- `PATCH /api/v1/jobs/:jobId/assignments/:assignmentId`
- `DELETE /api/v1/jobs/:jobId/assignments/:assignmentId`
- `POST /api/v1/jobs/:jobId/assignments/:assignmentId/accept`
- `POST /api/v1/jobs/:jobId/assignments/:assignmentId/decline`

### Lifecycle

- `POST /api/v1/jobs/:jobId/dispatch`
- `POST /api/v1/jobs/:jobId/start-travel`
- `POST /api/v1/jobs/:jobId/arrive`
- `POST /api/v1/jobs/:jobId/pause`
- `POST /api/v1/jobs/:jobId/resume`
- `POST /api/v1/jobs/:jobId/complete`
- `POST /api/v1/jobs/:jobId/cancel`
- `POST /api/v1/jobs/:jobId/reopen`
- `POST /api/v1/jobs/:jobId/ready-for-invoice`

## Activity Events

Implemented canonical job events:

- `job.created`
- `job.updated`
- `job.scheduled`
- `job.rescheduled`
- `job.schedule_conflict_overridden`
- `job.assignment_added`
- `job.assignment_accepted`
- `job.assignment_declined`
- `job.assignment_removed`
- `job.dispatched`
- `job.travel_started`
- `job.arrived`
- `job.paused`
- `job.resumed`
- `job.completed`
- `job.cancelled`
- `job.reopened`
- `job.ready_for_invoice`

Each event records the actor, job, org, timestamp, and metadata. Cancellation and override paths persist the human reason in the event description.

## Mobile-Ready Job Detail Contract

`GET /api/v1/jobs/:jobId` is designed to support a technician phone/tablet view with a single payload containing:

- job identity and job number
- status and priority
- schedule and arrival window
- customer name and direct contact fields
- service address
- job description and type
- assigned team
- linked equipment summary
- job-scoped tasks/checklist
- job-scoped notes
- linked site visits
- recent activity
- completion fields and invoice-readiness state

The response intentionally avoids unrelated company-wide data.

## Known Limitations

- no calendar UI or drag-and-drop dispatch board yet
- no route optimization or travel-time estimation
- no GPS tracking or technician location services
- no external SMS/email/push dispatch notifications
- no recurring service-agreement job generation yet
- project-level tasks and site visits remain valid; job linking is optional during the migration period
- schedule overrides are restricted to owner/admin in RC1

## Future UI Integration

The backend is now ready for a future scheduling UI to layer on:

- week/day calendar views
- dispatcher board interactions
- richer technician acceptance UX
- recurring job generation
- route/travel assistance

Those should reuse the current `jobs`, `job_assignments`, and `/api/v1/schedule*` contracts rather than inventing a second scheduling model.
