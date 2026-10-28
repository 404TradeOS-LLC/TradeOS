# Today: field identity and operational scheduling contracts

Status: Field task ownership implemented on `feat/field-task-ownership`, pending
review and migration rehearsal; scheduling contracts remain PROPOSED. Not deployed.
Owner: Billy Showalter, Founder. Date: 2026-10-27.
Parent: Today PR #798. Shared-job task visibility: merged child #800.

This proposal makes priorities 2 and 3 concrete before introducing new schema
or granting technician writes. It does not authorize a migration or change
current production permissions. Existing application code and RLS remain the
implementation truth. Do not mark these capabilities complete from this file.

## 1. Verified starting point

- ProjectTask has nullable `jobId` and free-text `assignedTo`; no user identity
  relation exists. #800 reads shared tasks through active JobAssignments.
- Technician job lifecycle and note updates exist. Task writes still require
  office CRM permission; task RLS's existing write predicate excludes technicians.
- Dispatch owns individual JobAssignments, conflict checks and timezone ranges.
  There is no Crew entity or crew-to-job assignment history to aggregate.
- SiteVisit is a project/job-linked capture record. It has no scheduled start,
  scheduled end, cancellation or explicit scheduled-user assignment contract.
  `createdAt` is capture history, never appointment time.
- No canonical project milestone or structured material/document/customer
  blocker record is available to the Today aggregation. Arbitrary JSON, task
  title keywords, unpaid invoices and passive activity cannot stand in for it.

## 2. Field task identity/write implementation contract

### Identity and migration

Add nullable `ProjectTask.assignedUserId`, a foreign key to an existing active
AppUser. Keep `assignedTo` as a display/legacy field. Existing rows remain
unassigned by identity; never backfill a user ID by matching names or email.
Use an index for assigned user/status/due date and retain project/job indexes.
A deleted user clears the identity, preventing an orphaned write grant.

The existing office create/update workflow gains an explicit user selector.
`crm.write` remains the ordinary task-write gate; explicit identity
administration requires raw owner/admin/dispatcher, preserving legacy estimator
ordinary task writes without widening its user-directory RLS access. The server validates active membership in
the task Project's organization; a technician assignment additionally requires
an active assignment to the linked Job. Reject cross-tenant or inactive users.
The office may clear assignment. Setting a display string never grants access.

### Narrow technician mutation

Proposed endpoint:

`PATCH /api/v1/jobs/:jobId/tasks/:taskId/status`

Accept exactly `status` (existing todo/in_progress/blocked/completed vocabulary)
and mandatory `expectedUpdatedAt`. Derive user, tenant and role from auth.
Reject additional fields; no field title/date/assignee/job/project mutation.

All conditions must hold in both the service predicate and new scoped RLS:

1. Actor is an active authenticated technician in the tenant.
2. Task's assignedUserId is that actor; both Project and Job belong to tenant.
3. Task is attached to this Job, which is not archived, completed or cancelled.
4. JobAssignment for the actor remains active, not removed or declined.
5. Revision matches atomically. Terminal task reopening uses the same explicit
   guarded status operation; no financial or Job lifecycle transition follows.

Use the existing transactional task service and activity writer. Lock the
active assignment row while validating/writing so revocation cannot commit
between validation and task completion. Update status/completedAt/updatedAt
only; server controls timestamps. A technician-only database trigger rejects
changes to all other task columns, even if an internal caller omits validation.
Do not widen `current_app_can_write`, use an admin DB client, or bypass RLS.
Keep create/delete/reassignment office-only. Denied invisible targets return
404; stale revisions return 409 without an activity event or partial update.

### Client and recovery

Return assignedUserId and the saved revision through existing DTOs. Shared
job tasks remain readable with their responsible party; only identity-matched
eligible tasks get a field edit target. The authenticated server is authoritative
for every save. Reuse existing Today pending/offline/error/conflict controls,
without changing the office status endpoint or falling back to an unguarded
mutation. Refresh queues from persisted source truth after confirmed success.

### Required proof before enabling

Disposable PostgreSQL: valid personal update; other person/same Job denied;
same-name legacy assignee denied; unassigned Job denied; removed/declined
assignment denied; wrong tenant denied; inactive member denied; archived or
terminal Job denied; title/date/identity tampering denied in SQL; office legacy
writes preserved; concurrent save has exactly one winner and audit event;
revocation race serializes safely. Browser: assigned field task update, reload,
Needs You resolution, rejected/stale/offline recovery and no edit affordance
for shared tasks assigned to someone else. Migration/backward compatibility
rehearsal is mandatory. No production data backfill or migration is authorized.

## 3. Recommended scheduling and exception contracts

| Capability | Persisted source proposed | Scope and reuse |
|---|---|---|
| Crews | Tenant-owned Crew plus membership history and JobCrewAssignment snapshot | Expand assignment through existing Dispatch service; individual JobAssignments and conflict checks remain authoritative. Preserve historical crew label/membership for scheduled work. |
| Scheduled visits | Nullable SiteVisit scheduledStart/scheduledEnd, explicit planned/completed/cancelled state, VisitAssignment | Preserve existing capture workflow; unscheduled legacy records remain unscheduled. Use existing timezone and conflict services. |
| Milestones | ProjectMilestone with due date, open/achieved/cancelled state and optional Job/user link | Project remains owner; field access requires linked assigned work. No synthetic milestone from a task title. |
| Blockers | JobBlocker with explicit kind, priority, responsible user, open/cleared state and source details | Material/document/customer exceptions arise only from saved blockers or existing canonical exception services. Reuse Job access, activity and source workspace. |

These are proposed domain entities, not approvals to introduce a new parallel
dispatch engine. Implement one capability at a time after domain review.
Do not place an opaque schedule or approval authority in JSON fields.

### Read aggregation

Provide bounded, tenant-scoped read contracts returning stable IDs, source
links, assigned-user identity, status, due/start/end times, updatedAt and
explicit pagination/coverage metadata. Enforce membership and RLS on every
query. Owner/office sees permitted organization work; technicians see only
active assigned source work. Counts and rows use the same predicates and
local-day UTC boundaries. Incomplete coverage produces unknown totals.

Crew KPI counts distinct persisted Crew IDs scheduled today, never distinct
people relabeled as crews. Timeline contains actual scheduled start/end times;
unscheduled work stays outside the time grid. No working map or weather widget
without a supported reliable provider. Job/person overlap detection remains in
Dispatch; crew expansion cannot hide a person-level scheduling conflict.

### Attention lifecycle

Only explicit unresolved exceptions, overdue commitments and persisted
conflicts enter Needs You. An ordinary visit or upcoming milestone belongs to
Work/Coming Up. Each item exposes its responsible person, source record,
priority, due date and revision. Clearing a blocker or completing a source
record uses the source's authorized mutation and transactional audit, then
refreshes the dashboard. Passive activity is history, not a resolution queue.

### Required proof and rollout

- Live PostgreSQL tenant/role/isolation tests for each new table and join.
- Existing data stays usable; capture dates are never reinterpreted.
- DST/local-day, overnight assignments, cancelled/completed records, pagination,
  source-local failure, count reconciliation and overlapping-person tests.
- Browser journeys at 390/768/1024/1440, both themes, real record navigation and
  guarded updates; fixtures remain restricted to test/nonproduction tenants.
- Additive migration first, compatible API next, then capability-gated UI.
  Reverse UI/API exposure without deleting customer records. Destructive
  rollback and production migration execution require their own authorization.

## 4. Decisions and release boundary

Recommended decision: adopt explicit user identity for personal field task
writes, keep shared-job reads, and retain Dispatch as the single assignment/
conflict authority. Reject name-based authorization and synthetic schedule data.

The founder/domain reviewer must accept the new identity/write and scheduling
semantics before activation. AGENTS.md makes new schema, authorization and RLS
changes PR-only/human-decision work. Required checks and a reviewed migration
are still necessary; a generic instruction to continue is not a recorded
ADR-009 protected-merge exception. Implementation can proceed in reviewed PRs,
but none of these unimplemented capabilities is production-certified here.

The implementation and final-head verification record in owning module/API docs
supersede proposal wording for field tasks only. Scheduling sections remain
proposals and do not represent implemented sources.
