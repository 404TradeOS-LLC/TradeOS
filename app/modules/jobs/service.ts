import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { prisma } from "../../db/client";
import { runInDatabaseTransaction } from "../../db/requestSession";
import { ActivityTimelineService } from "../intelligence/service";
import { getDefaultAthenaEventService } from "../athena-events/service";
import { jobStatuses, JobStatus } from "../../domain/contracts";
import {
  AddJobAssignmentInput,
  CreateJobInput,
  DispatchSummaryDTO,
  JobActivityDTO,
  JobAssignmentDTO,
  JobDTO,
  JobEquipmentDTO,
  JobListFilters,
  JobNoteDTO,
  JobPriority,
  JobSiteVisitDTO,
  JobSummaryDTO,
  JobTaskDTO,
  JobTransitionInput,
  PaginatedJobsDTO,
  ReopenJobInput,
  ScheduleConflictDTO,
  ScheduleConflictResultDTO,
  ScheduleJobInput,
  UpdateJobAssignmentInput,
  UpdateJobInput,
} from "./types";
import {
  TERMINAL_JOB_STATUSES,
  IN_PROGRESS_JOB_STATUSES,
  getOrgDayBoundaryUtc,
  getRollingWindowUtc,
  isJobOverdue,
  isJobUnassigned,
  jobNeedsAttention,
  resolveOrgTimezone,
} from "./dispatchRules";
import { JOB_ACTION_RULES, isAllowedJobAction, isAllowedJobStatusTransition } from "./lifecycle";
import type { JobAction } from "./lifecycle";

const activityService = new ActivityTimelineService();

// A8 event reference (C003's AthenaEventReference shape, duplicated here
// rather than imported to keep this module's import boundary free of any
// athena-tool-registry/athena-tool-sdk dependency - see the
// athena-tool-registry import-boundary test).
export interface AthenaJobEventRef {
  type: string;
  id: string;
}

const MANAGER_ROLES = new Set(["owner", "admin", "dispatcher"]);
const OVERRIDE_ROLES = new Set(["owner", "admin"]);
const REOPEN_ROLES = new Set(["owner", "admin"]);
const TECHNICIAN_FIELD_ROLES = new Set(["technician", "owner", "admin", "dispatcher"]);
const ACTIVE_SCHEDULE_STATUSES: JobStatus[] = ["scheduled", "dispatched", "traveling", "on_site", "paused"];

const jobDetailInclude = {
  project: true,
  customer: true,
  serviceAddress: true,
  assignments: {
    where: { removedAt: null },
    include: { user: true },
    orderBy: [{ isLead: "desc" }, { createdAt: "asc" }],
  },
  equipmentLinks: {
    include: { equipment: true },
    orderBy: { createdAt: "asc" },
  },
  tasks: {
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  },
  siteVisits: {
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.JobInclude;

// Lightweight include used by JobsService.list — the dispatcher-workspace
// list view needs project/customer names and active-assignment info, but not
// the full detail payload (equipment, tasks, site visits, notes, activity)
// that jobDetailInclude pulls for a single job's detail page.
const jobListInclude = {
  project: {
    select: { id: true, name: true, siteAddress: true },
  },
  customer: {
    select: { id: true, name: true },
  },
  assignments: {
    where: { removedAt: null },
    select: {
      userId: true,
      user: { select: { id: true, fullName: true, email: true } },
    },
  },
} satisfies Prisma.JobInclude;

export class JobsService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly activities = activityService
  ) {}

  async list(filters: JobListFilters): Promise<PaginatedJobsDTO> {
    const pageSize = clamp(filters.pageSize, 25, 1, 100);
    const page = clamp(filters.page, 1, 1, 10_000);
    // Captured once for the whole call - both for the where-clause's own
    // needsAttention predicate and for judging every returned row against
    // the same instant, rather than drifting row-to-row or disagreeing with
    // which rows were actually selected.
    const now = new Date();
    const where = buildJobWhere(filters, now);

    const [total, rows] = await Promise.all([
      this.db.job.count({ where }),
      this.db.job.findMany({
        where,
        include: jobListInclude,
        orderBy: [
          { archivedAt: "asc" },
          { scheduledStart: "asc" },
          { createdAt: "desc" },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((row) => toDispatchAwareJobSummaryDTO(row, now)),
      page,
      pageSize,
      total,
    };
  }

  async listSchedule(filters: JobListFilters): Promise<PaginatedJobsDTO> {
    return this.list({
      ...filters,
      archived: false,
    });
  }

  /**
   * Read-only dispatch-attention aggregate for the Dispatcher Workspace
   * overview. Deliberately count()-only (never findMany) so this stays cheap
   * to poll. orgId is passed explicitly and applied to every where clause,
   * matching this file's existing pattern (see buildJobWhere /
   * scopedJobAccessWhere) of scoping tenant queries explicitly even though
   * the request-scoped Prisma transaction already enforces org isolation via
   * RLS. No assertManager call is required — this mirrors read actions like
   * getById that don't gate on an elevated role, since it's an aggregate
   * read, not a mutation.
   *
   * IMPORTANT: none of the count() queries below filter by actor/assignment
   * — but the jobs table's own RLS select policy still silently narrows
   * every one of them to only jobs the caller is assigned to, for any role
   * other than owner/admin/dispatcher (see jobs_select_policy in
   * prisma/migrations/20260714120000_add_job_scheduling_engine, and the live
   * proof in tests/rls.integration.ts's "scopes the dispatch summary..."
   * test, where a viewer session's counts come back as 0). `actor.role` is
   * accepted here only to honestly label that narrowing in the response
   * (`scope`), not to add another application-level filter — the same
   * MANAGER_ROLES set used elsewhere in this file already matches the DB
   * policy's admin/owner/dispatcher check.
   */
  async getDispatchSummary(orgId: string, actor: { role: string }): Promise<DispatchSummaryDTO> {
    const now = new Date();

    const settingsRow = await this.db.organizationSettings.findUnique({
      where: { orgId },
      select: { settingsJson: true },
    });
    const { timezone, isFallback } = resolveOrgTimezone(readOrgTimezoneSetting(settingsRow?.settingsJson));

    const { startUtc: todayStart, endUtc: todayEnd } = getOrgDayBoundaryUtc(now, timezone);
    const { startUtc: weekStart, endUtc: weekEnd } = getRollingWindowUtc(now, timezone, 7);

    const terminalStatuses = [...TERMINAL_JOB_STATUSES];
    const inProgressStatuses = [...IN_PROGRESS_JOB_STATUSES];

    // archivedAt: null on every query below, matching buildJobWhere's default
    // list() behavior (archivedAt: filters.archived ? { not: null } : null,
    // i.e. archived jobs are hidden unless explicitly requested). A job's
    // archivedAt is set independently of its status (JobsService.archive()
    // never forces a terminal status), so without this an archived-but-
    // non-terminal-status job would inflate these counts while being
    // correctly absent from the work-queue list below them — a real
    // "misleading totals" mismatch between the KPI strip and the list.
    const [activeJobs, unscheduledJobs, scheduledToday, overdueActionable, needsAttention] = await Promise.all([
      this.db.job.count({
        where: { orgId, archivedAt: null, status: { notIn: terminalStatuses } },
      }),
      this.db.job.count({
        where: { orgId, archivedAt: null, status: "unscheduled" },
      }),
      this.db.job.count({
        where: {
          orgId,
          archivedAt: null,
          status: { notIn: terminalStatuses },
          scheduledStart: { gte: todayStart, lt: todayEnd },
        },
      }),
      this.db.job.count({
        where: {
          orgId,
          archivedAt: null,
          status: { in: inProgressStatuses },
          scheduledStart: { lt: now },
        },
      }),
      // A single OR'd count covering all three attention predicates
      // (overdue / unassigned-and-active / unscheduled) — NOT a sum of three
      // separate counts, which would double-count jobs matching more than
      // one predicate. See dispatchRules.jobNeedsAttention's own doc comment
      // for the same warning. buildNeedsAttentionWhere is the single shared
      // definition of this OR clause - buildJobWhere's ?needsAttention=true
      // list filter reuses the exact same function, so the summary count
      // and the work-queue list can never silently diverge on what "needs
      // attention" means.
      this.db.job.count({
        where: {
          orgId,
          archivedAt: null,
          ...buildNeedsAttentionWhere(now),
        },
      }),
    ]);

    return {
      activeJobs,
      unscheduledJobs,
      scheduledToday,
      overdueActionable,
      needsAttention,
      timezone: { source: isFallback ? "utc_fallback" : "organization", value: timezone },
      todayRangeUtc: { start: todayStart.toISOString(), end: todayEnd.toISOString() },
      weekRangeUtc: { start: weekStart.toISOString(), end: weekEnd.toISOString() },
      generatedAt: now.toISOString(),
      scope: { source: MANAGER_ROLES.has(actor.role) ? "organization" : "assigned_only", role: actor.role },
    };
  }

  async getById(orgId: string, jobId: string, actor: { userId: string; role: string }): Promise<JobDTO> {
    const row = await this.db.job.findFirst({
      where: {
        id: jobId,
        ...scopedJobAccessWhere(orgId, actor),
      },
      include: jobDetailInclude,
    });
    if (!row) throw new ApiError(404, `Job ${jobId} not found`);

    const [notes, recentActivity] = await Promise.all([
      this.db.comment.findMany({
        where: { orgId, entityType: "job", entityId: row.id },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      this.activities.list({ orgId, entityType: "job", entityId: row.id, limit: 25 }),
    ]);

    return toJobDTO(row, notes, recentActivity);
  }

  async create(input: CreateJobInput): Promise<JobDTO> {
    assertManager(input.actor.role);
    return runInDatabaseTransaction(this.db, async (tx) => {
      await this.assertJobContext(tx, input.orgId, input.projectId, input.customerId, input.serviceAddressId);
      const technicianIds = uniqueValues(input.technicianIds);
      await this.assertAssignableTechnicians(tx, input.orgId, technicianIds);
      validateScheduleRange(input.scheduledStart ?? null, input.scheduledEnd ?? null, input.arrivalWindowStart ?? null, input.arrivalWindowEnd ?? null);
      validateDuration(input.estimatedDurationMinutes ?? null);

      const jobNumber = await this.generateJobNumber(tx, input.orgId);
      const status = input.scheduledStart && input.scheduledEnd ? "scheduled" : "unscheduled";
      const conflicts = await this.collectConflicts(tx, {
        orgId: input.orgId,
        technicianIds,
        scheduledStart: input.scheduledStart ?? null,
        scheduledEnd: input.scheduledEnd ?? null,
      });
      this.assertConflictsAllowed(conflicts, input.actor.role, input.overrideConflict, input.overrideReason);

      const row = await tx.job.create({
        data: {
          orgId: input.orgId,
          projectId: input.projectId,
          customerId: input.customerId,
          serviceAddressId: input.serviceAddressId,
          jobNumber,
          title: input.title.trim(),
          description: input.description?.trim() ?? "",
          jobType: input.jobType.trim(),
          status,
          priority: input.priority ?? "medium",
          scheduledStart: input.scheduledStart ?? null,
          scheduledEnd: input.scheduledEnd ?? null,
          arrivalWindowStart: input.arrivalWindowStart ?? null,
          arrivalWindowEnd: input.arrivalWindowEnd ?? null,
          estimatedDurationMinutes: input.estimatedDurationMinutes ?? null,
          createdById: input.actor.userId,
        },
        include: jobDetailInclude,
      });

      if (technicianIds.length > 0) {
        await tx.jobAssignment.createMany({
          data: technicianIds.map((userId, index) => ({
            orgId: input.orgId,
            jobId: row.id,
            userId,
            assignmentRole: index === 0 ? "lead" : "technician",
            isLead: index === 0,
            assignedById: input.actor.userId,
          })),
        });
      }

      await this.syncJobEquipment(tx, input.orgId, row.id, input.customerId, input.serviceAddressId, input.equipmentIds ?? []);

      await this.recordJobEvent(tx, {
        orgId: input.orgId,
        jobId: row.id,
        eventType: "job.created",
        title: `Job created: ${row.jobNumber}`,
        actorUserId: input.actor.userId,
        metadata: {
          projectId: input.projectId,
          customerId: input.customerId,
          serviceAddressId: input.serviceAddressId,
          status,
          scheduledStart: row.scheduledStart?.toISOString() ?? null,
          scheduledEnd: row.scheduledEnd?.toISOString() ?? null,
        },
      });

      if (conflicts.length > 0) {
        await this.recordJobEvent(tx, {
          orgId: input.orgId,
          jobId: row.id,
          eventType: "job.schedule_conflict_overridden",
          title: `Schedule conflict overridden for ${row.jobNumber}`,
          actorUserId: input.actor.userId,
          description: input.overrideReason?.trim(),
          metadata: { conflicts },
        });
      }

      const created = await tx.job.findFirst({
        where: { id: row.id },
        include: jobDetailInclude,
      });
      if (!created) throw new ApiError(500, `Job ${row.id} disappeared after creation`);
      return this.hydrateJobDTO(tx, input.orgId, created);
    });
  }

  async update(jobId: string, input: UpdateJobInput): Promise<JobDTO> {
    assertManager(input.actor.role);
    return runInDatabaseTransaction(this.db, async (tx) => {
      const existing = await this.findJobOrThrow(tx, jobId, input.orgId, input.actor, true);
      if (existing.archivedAt) throw new ApiError(409, `Job ${jobId} is archived`);

      const projectId = input.projectId ?? existing.projectId;
      const customerId = input.customerId ?? existing.customerId;
      const serviceAddressId = input.serviceAddressId ?? existing.serviceAddressId;
      await this.assertJobContext(tx, input.orgId, projectId, customerId, serviceAddressId);
      await this.syncJobEquipment(tx, input.orgId, existing.id, customerId, serviceAddressId, input.equipmentIds);

      const row = await tx.job.update({
        where: { id: existing.id },
        data: {
          projectId,
          customerId,
          serviceAddressId,
          title: input.title?.trim() ?? undefined,
          description: input.description?.trim() ?? undefined,
          jobType: input.jobType?.trim() ?? undefined,
          priority: input.priority ?? undefined,
        },
        include: jobDetailInclude,
      });

      await this.recordJobEvent(tx, {
        orgId: input.orgId,
        jobId: row.id,
        eventType: "job.updated",
        title: `Job updated: ${row.jobNumber}`,
        actorUserId: input.actor.userId,
        metadata: {
          previousProjectId: existing.projectId,
          nextProjectId: row.projectId,
          previousCustomerId: existing.customerId,
          nextCustomerId: row.customerId,
          previousServiceAddressId: existing.serviceAddressId,
          nextServiceAddressId: row.serviceAddressId,
          previousPriority: existing.priority,
          nextPriority: row.priority,
        },
      });

      return this.hydrateJobDTO(tx, input.orgId, row);
    });
  }

  async archive(jobId: string, input: JobTransitionInput): Promise<void> {
    assertManager(input.actor.role);
    await runInDatabaseTransaction(this.db, async (tx) => {
      const existing = await this.findJobOrThrow(tx, jobId, input.orgId, input.actor, false);
      if (existing.archivedAt) return;
      await tx.job.update({
        where: { id: existing.id },
        data: { archivedAt: new Date() },
      });
      await this.recordJobEvent(tx, {
        orgId: input.orgId,
        jobId: existing.id,
        eventType: "job.updated",
        title: `Job archived: ${existing.jobNumber}`,
        actorUserId: input.actor.userId,
        metadata: { archivedAt: new Date().toISOString() },
      });
    });
  }

  async schedule(jobId: string, input: ScheduleJobInput): Promise<JobDTO & { athenaEvent?: AthenaJobEventRef }> {
    assertManager(input.actor.role);
    const job = await this.applySchedule(jobId, input, false);
    const athenaEvent = await this.publishJobEvent({
      orgId: input.orgId,
      type: "JobScheduled",
      entity: { type: "job", id: job.id },
      actor: { type: "user", id: input.actor.userId },
      payload: { jobId: job.id, projectId: job.projectId, customerId: job.customerId, scheduledStart: job.scheduledStart, scheduledEnd: job.scheduledEnd },
      idempotencyKey: `job:${job.id}:scheduled:${job.scheduledStart}:v1`,
    });
    return { ...job, athenaEvent };
  }

  async reschedule(jobId: string, input: ScheduleJobInput): Promise<JobDTO> {
    assertManager(input.actor.role);
    return this.applySchedule(jobId, input, true);
  }

  // A8 event publish (docs/athena/10-events/README.md "Publisher And
  // Subscriber Rules"): the application service is the sole publisher of
  // canonical business events - Athena tools never publish directly, only
  // reference what a service already published (see athena-tool-sdk/events.ts).
  // Publish failures never block or roll back the already-committed mutation,
  // matching proposals/service.ts's send() posture. Returns the published
  // event's own {type, id} (undefined on publish failure) so a caller in
  // athena-tools/ can wrap it with eventRef() - never fabricated, never
  // re-derived from the idempotency key.
  private async publishJobEvent(input: { orgId: string; type: string; entity: { type: string; id: string }; actor: { type: "user" | "system"; id: string | null }; payload: unknown; idempotencyKey: string }): Promise<AthenaJobEventRef | undefined> {
    try {
      const { event } = await getDefaultAthenaEventService().publish({
        orgId: input.orgId,
        type: input.type,
        version: "1.0.0",
        entity: input.entity,
        actor: input.actor,
        payload: input.payload,
        correlationId: randomUUID(),
        idempotencyKey: input.idempotencyKey,
      });
      return { type: event.type, id: event.id };
    } catch (error) {
      console.error(`[athena-events] failed to publish ${input.type} event`, error);
      return undefined;
    }
  }

  async listAssignments(jobId: string, orgId: string, actor: { userId: string; role: string }): Promise<JobAssignmentDTO[]> {
    await this.findJobOrThrow(this.db, jobId, orgId, actor, false);
    const rows = await this.db.jobAssignment.findMany({
      where: { jobId, orgId, removedAt: null },
      include: { user: true },
      orderBy: [{ isLead: "desc" }, { createdAt: "asc" }],
    });
    return rows.map(toAssignmentDTO);
  }

  async addAssignment(jobId: string, input: AddJobAssignmentInput): Promise<JobAssignmentDTO & { athenaEvent?: AthenaJobEventRef }> {
    assertManager(input.actor.role);
    const assignment = await runInDatabaseTransaction(this.db, async (tx) => {
      const job = await this.findJobOrThrow(tx, jobId, input.orgId, input.actor, false);
      if (job.archivedAt) throw new ApiError(409, `Job ${jobId} is archived`);
      const [membership] = await this.assertAssignableTechnicians(tx, input.orgId, [input.userId]);
      const isLead = input.isLead ?? input.assignmentRole === "lead";
      if (membership.role !== "technician") {
        throw new ApiError(409, `User ${input.userId} is not an active technician`);
      }

      const conflicts = await this.collectConflicts(tx, {
        orgId: input.orgId,
        technicianIds: [input.userId],
        scheduledStart: job.scheduledStart,
        scheduledEnd: job.scheduledEnd,
        currentJobId: job.id,
      });
      this.assertConflictsAllowed(conflicts, input.actor.role, input.overrideConflict, input.overrideReason);

      try {
        const row = await tx.jobAssignment.create({
          data: {
            orgId: input.orgId,
            jobId: job.id,
            userId: input.userId,
            assignmentRole: input.assignmentRole,
            isLead,
            assignedById: input.actor.userId,
          },
          include: { user: true },
        });

        await this.recordJobEvent(tx, {
          orgId: input.orgId,
          jobId: job.id,
          eventType: "job.assignment_added",
          title: `Assignment added to ${job.jobNumber}`,
          actorUserId: input.actor.userId,
          metadata: {
            assignmentId: row.id,
            userId: row.userId,
            assignmentRole: row.assignmentRole,
            isLead: row.isLead,
          },
        });

        if (conflicts.length > 0) {
          await this.recordJobEvent(tx, {
            orgId: input.orgId,
            jobId: job.id,
            eventType: "job.schedule_conflict_overridden",
            title: `Schedule conflict overridden for ${job.jobNumber}`,
            actorUserId: input.actor.userId,
            description: input.overrideReason?.trim(),
            metadata: { conflicts, assignmentUserId: input.userId },
          });
        }

        return toAssignmentDTO(row);
      } catch (error) {
        throw mapAssignmentConstraintError(error, input.userId);
      }
    });
    const athenaEvent = await this.publishJobEvent({
      orgId: input.orgId,
      type: "TechnicianAssigned",
      entity: { type: "job", id: jobId },
      actor: { type: "user", id: input.actor.userId },
      payload: { jobId, assignmentId: assignment.id, technicianId: assignment.userId, assignmentRole: assignment.assignmentRole, isLead: assignment.isLead },
      idempotencyKey: `job:${jobId}:technician-assigned:${assignment.id}:v1`,
    });
    return { ...assignment, athenaEvent };
  }

  async updateAssignment(jobId: string, assignmentId: string, input: UpdateJobAssignmentInput): Promise<JobAssignmentDTO> {
    assertManager(input.actor.role);
    return runInDatabaseTransaction(this.db, async (tx) => {
      const job = await this.findJobOrThrow(tx, jobId, input.orgId, input.actor, false);
      const existing = await tx.jobAssignment.findFirst({
        where: { id: assignmentId, jobId: job.id, orgId: input.orgId, removedAt: null },
        include: { user: true },
      });
      if (!existing) throw new ApiError(404, `Job assignment ${assignmentId} not found`);

      const nextRole = input.assignmentRole ?? existing.assignmentRole;
      const nextIsLead = input.isLead ?? existing.isLead;
      const conflicts = await this.collectConflicts(tx, {
        orgId: input.orgId,
        technicianIds: [existing.userId],
        scheduledStart: job.scheduledStart,
        scheduledEnd: job.scheduledEnd,
        currentJobId: job.id,
      });
      this.assertConflictsAllowed(conflicts, input.actor.role, input.overrideConflict, input.overrideReason);

      try {
        const row = await tx.jobAssignment.update({
          where: { id: existing.id },
          data: {
            assignmentRole: nextRole,
            isLead: nextIsLead,
          },
          include: { user: true },
        });
        await this.recordJobEvent(tx, {
          orgId: input.orgId,
          jobId: job.id,
          eventType: "job.updated",
          title: `Assignment updated on ${job.jobNumber}`,
          actorUserId: input.actor.userId,
          metadata: {
            assignmentId: row.id,
            previousAssignmentRole: existing.assignmentRole,
            nextAssignmentRole: row.assignmentRole,
            previousIsLead: existing.isLead,
            nextIsLead: row.isLead,
          },
        });
        return toAssignmentDTO(row);
      } catch (error) {
        throw mapAssignmentConstraintError(error, existing.userId);
      }
    });
  }

  async removeAssignment(jobId: string, assignmentId: string, input: JobTransitionInput): Promise<void> {
    assertManager(input.actor.role);
    await runInDatabaseTransaction(this.db, async (tx) => {
      const job = await this.findJobOrThrow(tx, jobId, input.orgId, input.actor, false);
      const existing = await tx.jobAssignment.findFirst({
        where: { id: assignmentId, jobId: job.id, orgId: input.orgId, removedAt: null },
      });
      if (!existing) throw new ApiError(404, `Job assignment ${assignmentId} not found`);
      await tx.jobAssignment.update({
        where: { id: existing.id },
        data: { removedAt: new Date() },
      });
      await this.recordJobEvent(tx, {
        orgId: input.orgId,
        jobId: job.id,
        eventType: "job.assignment_removed",
        title: `Assignment removed from ${job.jobNumber}`,
        actorUserId: input.actor.userId,
        metadata: {
          assignmentId: existing.id,
          userId: existing.userId,
        },
      });
    });
  }

  async acceptAssignment(jobId: string, assignmentId: string, input: JobTransitionInput): Promise<JobAssignmentDTO> {
    return this.respondToAssignment(jobId, assignmentId, input, "accept");
  }

  async declineAssignment(jobId: string, assignmentId: string, input: JobTransitionInput): Promise<JobAssignmentDTO> {
    return this.respondToAssignment(jobId, assignmentId, input, "decline");
  }

  async dispatch(jobId: string, input: JobTransitionInput): Promise<JobDTO> {
    assertManager(input.actor.role);
    return this.transition(jobId, input, "dispatch", "job.dispatched", {
      title: "Job dispatched",
      validate: async (tx, job) => {
        if (job.archivedAt || job.status === "cancelled") {
          throw new ApiError(409, `Job ${job.id} cannot be dispatched`);
        }
        if (!job.scheduledStart || !job.scheduledEnd) {
          throw new ApiError(409, `Job ${job.id} must be scheduled before dispatch`);
        }
        const count = await tx.jobAssignment.count({
          where: { jobId: job.id, orgId: input.orgId, removedAt: null, declinedAt: null },
        });
        if (count === 0) throw new ApiError(409, `Job ${job.id} must have at least one active assignment before dispatch`);
      },
    });
  }

  async startTravel(jobId: string, input: JobTransitionInput): Promise<JobDTO> {
    assertFieldWorker(input.actor.role);
    return this.transition(jobId, input, "startTravel", "job.travel_started", {
      title: "Travel started",
    });
  }

  async arrive(jobId: string, input: JobTransitionInput): Promise<JobDTO> {
    assertFieldWorker(input.actor.role);
    return this.transition(jobId, input, "arrive", "job.arrived", {
      title: "Arrived on site",
      data: (job) => ({
        actualStart: job.actualStart ?? new Date(),
      }),
    });
  }

  async pause(jobId: string, input: JobTransitionInput): Promise<JobDTO> {
    assertFieldWorker(input.actor.role);
    return this.transition(jobId, input, "pause", "job.paused", {
      title: "Job paused",
      requireReason: true,
    });
  }

  async resume(jobId: string, input: JobTransitionInput): Promise<JobDTO> {
    assertFieldWorker(input.actor.role);
    return this.transition(jobId, input, "resume", "job.resumed", {
      title: "Job resumed",
    });
  }

  async complete(jobId: string, input: JobTransitionInput): Promise<JobDTO & { athenaEvent?: AthenaJobEventRef }> {
    assertFieldWorker(input.actor.role);
    const job = await this.transition(jobId, input, "complete", "job.completed", {
      title: "Job completed",
      data: (job) => ({
        actualStart: job.actualStart ?? new Date(),
        actualEnd: new Date(),
        completedAt: new Date(),
        completedById: input.actor.userId,
      }),
    });
    const athenaEvent = await this.publishJobEvent({
      orgId: input.orgId,
      type: "WorkCompleted",
      entity: { type: "job", id: job.id },
      actor: { type: "user", id: input.actor.userId },
      payload: { jobId: job.id, projectId: job.projectId, customerId: job.customerId, completedAt: job.completedAt },
      idempotencyKey: `job:${job.id}:work-completed:v1`,
    });
    return { ...job, athenaEvent };
  }

  async cancel(jobId: string, input: JobTransitionInput): Promise<JobDTO> {
    assertManager(input.actor.role);
    return this.transition(jobId, input, "cancel", "job.cancelled", {
      title: "Job cancelled",
      requireReasonFor: ["dispatched", "paused"],
    });
  }

  async reopen(jobId: string, input: ReopenJobInput): Promise<JobDTO> {
    if (!REOPEN_ROLES.has(input.actor.role)) {
      throw new ApiError(403, "Only owners and admins can reopen completed jobs");
    }
    return runInDatabaseTransaction(this.db, async (tx) => {
      const job = await this.findJobOrThrow(tx, jobId, input.orgId, input.actor, false);
      const currentStatus = normalizeJobStatus(job.status);
      if (!isAllowedJobAction("reopen", currentStatus)) {
        throw new ApiError(409, `Job ${job.id} is not completed`);
      }
      const nextStatus = input.status ?? "unscheduled";
      if (!isAllowedJobStatusTransition(currentStatus, nextStatus)) {
        throw new ApiError(409, `Job ${job.id} cannot reopen to status ${nextStatus}`);
      }
      if (nextStatus === "scheduled" && (!job.scheduledStart || !job.scheduledEnd)) {
        throw new ApiError(409, `Job ${job.id} cannot reopen to scheduled without an existing schedule`);
      }
      const row = await tx.job.update({
        where: { id: job.id },
        data: {
          status: nextStatus,
          actualStart: null,
          actualEnd: null,
          completedAt: null,
          completedById: null,
          readyForInvoiceAt: null,
        },
        include: jobDetailInclude,
      });
      await this.recordJobEvent(tx, {
        orgId: input.orgId,
        jobId: row.id,
        eventType: "job.reopened",
        title: `Job reopened: ${row.jobNumber}`,
        actorUserId: input.actor.userId,
        description: input.reason?.trim(),
        metadata: {
          previousStatus: job.status,
          newStatus: nextStatus,
        },
      });
      return this.hydrateJobDTO(tx, input.orgId, row);
    });
  }

  async readyForInvoice(jobId: string, input: JobTransitionInput): Promise<JobDTO> {
    assertManager(input.actor.role);
    return runInDatabaseTransaction(this.db, async (tx) => {
      const job = await this.findJobOrThrow(tx, jobId, input.orgId, input.actor, false);
      const currentStatus = normalizeJobStatus(job.status);
      if (!isAllowedJobAction("readyForInvoice", currentStatus)) {
        throw new ApiError(409, `Job ${job.id} must be completed before it is ready for invoice`);
      }
      const row = await tx.job.update({
        where: { id: job.id },
        data: { readyForInvoiceAt: new Date() },
        include: jobDetailInclude,
      });
      await this.recordJobEvent(tx, {
        orgId: input.orgId,
        jobId: row.id,
        eventType: "job.ready_for_invoice",
        title: `Job ready for invoice: ${row.jobNumber}`,
        actorUserId: input.actor.userId,
      });
      return this.hydrateJobDTO(tx, input.orgId, row);
    });
  }

  async getScheduleConflicts(filters: {
    orgId: string;
    actor: { userId: string; role: string };
    technicianId?: string;
    scheduledFrom: Date;
    scheduledTo: Date;
  }): Promise<ScheduleConflictResultDTO> {
    assertManager(filters.actor.role);
    if (filters.scheduledTo <= filters.scheduledFrom) {
      throw new ApiError(400, "scheduledTo must be later than scheduledFrom");
    }

    if (filters.technicianId) {
      const conflicts = await this.collectConflicts(this.db, {
        orgId: filters.orgId,
        technicianIds: [filters.technicianId],
        scheduledStart: filters.scheduledFrom,
        scheduledEnd: filters.scheduledTo,
      });
      return { conflicts, overrideAllowed: OVERRIDE_ROLES.has(filters.actor.role) };
    }

    const assignments = await this.db.jobAssignment.findMany({
      where: {
        orgId: filters.orgId,
        removedAt: null,
        declinedAt: null,
        job: {
          archivedAt: null,
          status: { in: ACTIVE_SCHEDULE_STATUSES },
          scheduledStart: { lt: filters.scheduledTo },
          scheduledEnd: { gt: filters.scheduledFrom },
        },
      },
      include: {
        user: true,
        job: true,
      },
      orderBy: [{ userId: "asc" }, { job: { scheduledStart: "asc" } }],
    });

    const conflicts: ScheduleConflictDTO[] = [];
    const byTechnician = new Map<string, typeof assignments>();
    for (const assignment of assignments) {
      const group = byTechnician.get(assignment.userId) ?? [];
      group.push(assignment);
      byTechnician.set(assignment.userId, group);
    }
    for (const [, group] of byTechnician) {
      for (let index = 1; index < group.length; index += 1) {
        const previous = group[index - 1];
        const current = group[index];
        if (!previous.job.scheduledEnd || !current.job.scheduledStart) continue;
        if (previous.job.scheduledEnd > current.job.scheduledStart) {
          conflicts.push({
            type: "technician_overlap",
            technicianId: current.userId,
            technicianName: current.user.fullName,
            conflictingJobId: current.job.id,
            conflictingJobNumber: current.job.jobNumber,
            conflictingJobTitle: current.job.title,
            conflictingScheduledStart: current.job.scheduledStart?.toISOString() ?? "",
            conflictingScheduledEnd: current.job.scheduledEnd?.toISOString() ?? "",
          });
        }
      }
    }
    return { conflicts, overrideAllowed: OVERRIDE_ROLES.has(filters.actor.role) };
  }

  private async applySchedule(jobId: string, input: ScheduleJobInput, isReschedule: boolean): Promise<JobDTO> {
    return runInDatabaseTransaction(this.db, async (tx) => {
      const job = await this.findJobOrThrow(tx, jobId, input.orgId, input.actor, false);
      if (job.archivedAt) throw new ApiError(409, `Job ${job.id} is archived`);
      const currentStatus = normalizeJobStatus(job.status);
      if (currentStatus === "completed") {
        throw new ApiError(409, `Completed job ${job.id} must be reopened before rescheduling`);
      }
      if (currentStatus === "cancelled") {
        throw new ApiError(409, `Cancelled job ${job.id} must be reopened before rescheduling`);
      }
      if (!isAllowedJobAction("schedule", currentStatus)) {
        throw new ApiError(409, `Job ${job.id} cannot be rescheduled from status ${job.status}`);
      }

      validateScheduleRange(input.scheduledStart, input.scheduledEnd, input.arrivalWindowStart ?? null, input.arrivalWindowEnd ?? null);
      validateDuration(input.estimatedDurationMinutes ?? null);

      const assignments = await tx.jobAssignment.findMany({
        where: { jobId: job.id, orgId: input.orgId, removedAt: null, declinedAt: null },
        select: { userId: true },
      });
      const conflicts = await this.collectConflicts(tx, {
        orgId: input.orgId,
        technicianIds: assignments.map((assignment) => assignment.userId),
        scheduledStart: input.scheduledStart,
        scheduledEnd: input.scheduledEnd,
        currentJobId: job.id,
      });
      this.assertConflictsAllowed(conflicts, input.actor.role, input.overrideConflict, input.overrideReason);

      const nextStatus = JOB_ACTION_RULES.schedule.target;
      const row = await tx.job.update({
        where: { id: job.id },
        data: {
          status: nextStatus,
          scheduledStart: input.scheduledStart,
          scheduledEnd: input.scheduledEnd,
          arrivalWindowStart: input.arrivalWindowStart ?? null,
          arrivalWindowEnd: input.arrivalWindowEnd ?? null,
          estimatedDurationMinutes: input.estimatedDurationMinutes ?? null,
        },
        include: jobDetailInclude,
      });

      const eventType = isReschedule ? "job.rescheduled" : "job.scheduled";
      await this.recordJobEvent(tx, {
        orgId: input.orgId,
        jobId: row.id,
        eventType,
        title: `${isReschedule ? "Job rescheduled" : "Job scheduled"}: ${row.jobNumber}`,
        actorUserId: input.actor.userId,
        metadata: {
          previousStatus: job.status,
          newStatus: nextStatus,
          previousScheduledStart: job.scheduledStart?.toISOString() ?? null,
          previousScheduledEnd: job.scheduledEnd?.toISOString() ?? null,
          scheduledStart: input.scheduledStart.toISOString(),
          scheduledEnd: input.scheduledEnd.toISOString(),
        },
      });

      if (conflicts.length > 0) {
        await this.recordJobEvent(tx, {
          orgId: input.orgId,
          jobId: row.id,
          eventType: "job.schedule_conflict_overridden",
          title: `Schedule conflict overridden for ${row.jobNumber}`,
          actorUserId: input.actor.userId,
          description: input.overrideReason?.trim(),
          metadata: { conflicts },
        });
      }

      return this.hydrateJobDTO(tx, input.orgId, row);
    });
  }

  private async respondToAssignment(
    jobId: string,
    assignmentId: string,
    input: JobTransitionInput,
    action: "accept" | "decline"
  ): Promise<JobAssignmentDTO> {
    return runInDatabaseTransaction(this.db, async (tx) => {
      const job = await this.findJobOrThrow(tx, jobId, input.orgId, input.actor, false);
      const existing = await tx.jobAssignment.findFirst({
        where: {
          id: assignmentId,
          jobId: job.id,
          orgId: input.orgId,
          removedAt: null,
          userId: input.actor.userId,
        },
        include: { user: true },
      });
      if (!existing) throw new ApiError(404, `Job assignment ${assignmentId} not found`);

      const row = await tx.jobAssignment.update({
        where: { id: existing.id },
        data:
          action === "accept"
            ? { acceptedAt: new Date(), declinedAt: null }
            : { declinedAt: new Date(), acceptedAt: null },
        include: { user: true },
      });

      await this.recordJobEvent(tx, {
        orgId: input.orgId,
        jobId: job.id,
        eventType: action === "accept" ? "job.assignment_accepted" : "job.assignment_declined",
        title: `Assignment ${action === "accept" ? "accepted" : "declined"} for ${job.jobNumber}`,
        actorUserId: input.actor.userId,
        description: input.reason?.trim(),
        metadata: { assignmentId: row.id, userId: row.userId },
      });

      return toAssignmentDTO(row);
    });
  }

  private async transition(
    jobId: string,
    input: JobTransitionInput,
    action: Exclude<JobAction, "schedule" | "reopen" | "readyForInvoice">,
    eventType: string,
    options: {
      title: string;
      requireReason?: boolean;
      requireReasonFor?: JobStatus[];
      validate?: (tx: Prisma.TransactionClient, job: Prisma.JobGetPayload<{ include: typeof jobDetailInclude }>) => Promise<void>;
      data?: (job: Prisma.JobGetPayload<{ include: typeof jobDetailInclude }>) => Prisma.JobUpdateInput;
    }
  ): Promise<JobDTO> {
    return runInDatabaseTransaction(this.db, async (tx) => {
      const job = await this.findJobOrThrow(tx, jobId, input.orgId, input.actor, true);
      const currentStatus = normalizeJobStatus(job.status);
      const transition = JOB_ACTION_RULES[action];
      const nextStatus = transition.target;
      if (!isAllowedJobAction(action, currentStatus) || !isAllowedJobStatusTransition(currentStatus, nextStatus)) {
        throw new ApiError(409, `Job ${job.id} cannot transition from ${currentStatus} to ${nextStatus}`);
      }
      if (options.requireReason || options.requireReasonFor?.includes(currentStatus)) {
        if (!input.reason?.trim()) {
          throw new ApiError(400, "A reason is required for this action");
        }
      }
      if (job.archivedAt) throw new ApiError(409, `Job ${job.id} is archived`);
      if (input.actor.role === "technician") {
        await this.assertTechnicianAssigned(tx, input.orgId, job.id, input.actor.userId);
      }
      if (options.validate) {
        await options.validate(tx, job);
      }

      const row = await tx.job.update({
        where: { id: job.id },
        data: {
          status: nextStatus,
          ...(options.data ? options.data(job) : {}),
        },
        include: jobDetailInclude,
      });

      await this.recordJobEvent(tx, {
        orgId: input.orgId,
        jobId: row.id,
        eventType,
        title: `${options.title}: ${row.jobNumber}`,
        actorUserId: input.actor.userId,
        description: input.reason?.trim(),
        metadata: {
          previousStatus: currentStatus,
          newStatus: nextStatus,
        },
      });

      return this.hydrateJobDTO(tx, input.orgId, row);
    });
  }

  private async hydrateJobDTO(
    tx: Prisma.TransactionClient,
    orgId: string,
    row: Prisma.JobGetPayload<{ include: typeof jobDetailInclude }>
  ): Promise<JobDTO> {
    const [notes, recentActivity] = await Promise.all([
      tx.comment.findMany({
        where: { orgId, entityType: "job", entityId: row.id },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      this.activities.list({ orgId, entityType: "job", entityId: row.id, limit: 25 }),
    ]);
    return toJobDTO(row, notes, recentActivity);
  }

  private async recordJobEvent(
    tx: Prisma.TransactionClient,
    input: {
      orgId: string;
      jobId: string;
      eventType: string;
      title: string;
      actorUserId?: string;
      description?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    await tx.activityEvent.create({
      data: {
        orgId: input.orgId,
        entityType: "job",
        entityId: input.jobId,
        eventType: input.eventType,
        title: input.title,
        description: input.description,
        actorUserId: input.actorUserId,
        metadataJson: input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        occurredAt: new Date(),
      },
    });
  }

  private async findJobOrThrow(
    tx: Prisma.TransactionClient | PrismaClient,
    jobId: string,
    orgId: string,
    actor: { userId: string; role: string },
    includeDetails: boolean
  ) {
    const row = await tx.job.findFirst({
      where: { id: jobId, ...scopedJobAccessWhere(orgId, actor) },
      include: includeDetails ? jobDetailInclude : undefined,
    });
    if (!row) throw new ApiError(404, `Job ${jobId} not found`);
    return row as Prisma.JobGetPayload<{ include: typeof jobDetailInclude }>;
  }

  private async assertJobContext(
    tx: Prisma.TransactionClient,
    orgId: string,
    projectId: string,
    customerId: string,
    serviceAddressId: string
  ) {
    const [project, customer, serviceAddress] = await Promise.all([
      tx.project.findFirst({ where: { id: projectId, orgId } }),
      tx.customer.findFirst({ where: { id: customerId, orgId, deletedAt: null } }),
      tx.serviceAddress.findFirst({ where: { id: serviceAddressId, orgId, deletedAt: null } }),
    ]);
    if (!project) throw new ApiError(404, `Project ${projectId} not found`);
    if (!customer) throw new ApiError(404, `Customer ${customerId} not found`);
    if (!serviceAddress) throw new ApiError(404, `Service address ${serviceAddressId} not found`);
    if (serviceAddress.customerId !== customer.id) {
      throw new ApiError(409, `Service address ${serviceAddressId} does not belong to customer ${customerId}`);
    }
    if (project.customerId && project.customerId !== customer.id) {
      throw new ApiError(409, `Project ${projectId} does not belong to customer ${customerId}`);
    }
    return { project, customer, serviceAddress };
  }

  private async assertAssignableTechnicians(tx: Prisma.TransactionClient, orgId: string, userIds: string[]) {
    if (userIds.length === 0) return [];
    const rows = await tx.organizationMembership.findMany({
      where: {
        orgId,
        userId: { in: userIds },
        status: "active",
      },
      include: { user: true },
    });
    if (rows.length !== userIds.length) {
      throw new ApiError(409, "Assigned technicians must be active users in the same organization");
    }
    if (!rows.every((row) => row.user.isActive)) {
      throw new ApiError(409, "Assigned technicians must be active users in the same organization");
    }
    return rows;
  }

  private async assertTechnicianAssigned(tx: Prisma.TransactionClient, orgId: string, jobId: string, userId: string) {
    const assignment = await tx.jobAssignment.findFirst({
      where: { orgId, jobId, userId, removedAt: null, declinedAt: null },
      select: { id: true },
    });
    if (!assignment) {
      throw new ApiError(403, "You do not have permission to perform this action");
    }
  }

  private async syncJobEquipment(
    tx: Prisma.TransactionClient,
    orgId: string,
    jobId: string,
    customerId: string,
    serviceAddressId: string,
    equipmentIds?: string[]
  ) {
    if (equipmentIds === undefined) return;
    const ids = uniqueValues(equipmentIds);
    if (ids.length > 0) {
      const equipment = await tx.customerEquipment.findMany({
        where: {
          id: { in: ids },
          orgId,
          customerId,
          deletedAt: null,
          OR: [{ serviceAddressId: null }, { serviceAddressId }],
        },
      });
      if (equipment.length !== ids.length) {
        throw new ApiError(409, "Job equipment must belong to the same organization and customer");
      }
    }
    await tx.jobEquipment.deleteMany({ where: { jobId } });
    if (ids.length > 0) {
      await tx.jobEquipment.createMany({
        data: ids.map((equipmentId) => ({ jobId, equipmentId })),
      });
    }
  }

  private async collectConflicts(
    tx: Prisma.TransactionClient | PrismaClient,
    input: {
      orgId: string;
      technicianIds: string[];
      scheduledStart: Date | null;
      scheduledEnd: Date | null;
      currentJobId?: string;
    }
  ): Promise<ScheduleConflictDTO[]> {
    if (input.technicianIds.length === 0 || !input.scheduledStart || !input.scheduledEnd) return [];

    const rows = await tx.jobAssignment.findMany({
      where: {
        orgId: input.orgId,
        userId: { in: input.technicianIds },
        removedAt: null,
        declinedAt: null,
        job: {
          archivedAt: null,
          id: input.currentJobId ? { not: input.currentJobId } : undefined,
          status: { in: ACTIVE_SCHEDULE_STATUSES },
          scheduledStart: { lt: input.scheduledEnd },
          scheduledEnd: { gt: input.scheduledStart },
        },
      },
      include: { user: true, job: true },
      orderBy: [{ userId: "asc" }, { job: { scheduledStart: "asc" } }],
    });

    return rows.map((row) => ({
      type: "technician_overlap",
      technicianId: row.userId,
      technicianName: row.user.fullName,
      conflictingJobId: row.jobId,
      conflictingJobNumber: row.job.jobNumber,
      conflictingJobTitle: row.job.title,
      conflictingScheduledStart: row.job.scheduledStart?.toISOString() ?? "",
      conflictingScheduledEnd: row.job.scheduledEnd?.toISOString() ?? "",
    }));
  }

  private assertConflictsAllowed(
    conflicts: ScheduleConflictDTO[],
    role: string,
    overrideConflict?: boolean,
    overrideReason?: string
  ) {
    if (conflicts.length === 0) return;
    if (!overrideConflict) {
      throw new ApiError(409, "Schedule conflict detected", {
        code: "schedule_conflict",
        conflicts,
      });
    }
    if (!OVERRIDE_ROLES.has(role)) {
      throw new ApiError(403, "Only owners and admins can override schedule conflicts");
    }
    if (!overrideReason?.trim()) {
      throw new ApiError(400, "An override reason is required when overriding schedule conflicts");
    }
  }

  private async generateJobNumber(tx: Prisma.TransactionClient, orgId: string): Promise<string> {
    const year = new Date().getUTCFullYear();
    const lockKey = `job-number:${orgId}:${year}`;
    await tx.$queryRaw(Prisma.sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);
    const prefix = `JOB-${year}-`;
    const count = await tx.job.count({
      where: {
        orgId,
        jobNumber: {
          startsWith: prefix,
        },
      },
    });
    return `${prefix}${String(count + 1).padStart(6, "0")}`;
  }
}

function scopedJobAccessWhere(orgId: string, actor: { userId: string; role: string }): Prisma.JobWhereInput {
  if (actor.role === "technician") {
    return {
      orgId,
      assignments: {
        some: {
          userId: actor.userId,
          removedAt: null,
        },
      },
    };
  }
  return { orgId };
}

/**
 * Prisma where-clause form of dispatchRules.jobNeedsAttention, expressed as
 * a single OR'd condition since a JS predicate can't be passed into a
 * Prisma query. Shared by buildJobWhere (the ?needsAttention=true list
 * filter) and JobsService.getDispatchSummary (the needsAttention count) so
 * "which jobs need attention" is defined in exactly one place, not two
 * independently-maintained copies of the same OR array.
 */
function buildNeedsAttentionWhere(now: Date): Prisma.JobWhereInput {
  const terminalStatuses = [...TERMINAL_JOB_STATUSES];
  const inProgressStatuses = [...IN_PROGRESS_JOB_STATUSES];
  return {
    OR: [
      { status: { in: inProgressStatuses }, scheduledStart: { lt: now } },
      { status: { notIn: terminalStatuses }, assignments: { none: { removedAt: null } } },
      { status: "unscheduled" },
    ],
  };
}

function buildJobWhere(filters: JobListFilters, now: Date): Prisma.JobWhereInput {
  const search = filters.search?.trim();

  // Each optional predicate is pushed as its own object into a single AND
  // array rather than spread directly onto the returned where-object.
  // Several of these need their own top-level `OR` key (search,
  // needsAttention) or `assignments` key (technicianId, unassigned/assigned)
  // - a single JS object literal can only hold one value per key, so
  // spreading two of them together would let the later one silently
  // overwrite the earlier one instead of combining. Prisma's `AND` array
  // combines separate where-objects with real AND semantics even when they
  // share a key name, so this composes safely regardless of which optional
  // filters are active together.
  const conditions: Prisma.JobWhereInput[] = [];

  if (filters.scheduledFrom) conditions.push({ scheduledStart: { gte: filters.scheduledFrom } });
  if (filters.scheduledTo) conditions.push({ scheduledStart: { lte: filters.scheduledTo } });

  if (filters.technicianId) {
    conditions.push({
      assignments: {
        some: {
          userId: filters.technicianId,
          removedAt: null,
        },
      },
    });
  }

  // Tri-state: true -> only unassigned jobs, false -> only assigned jobs,
  // undefined (omitted) -> no assignment filter at all. Branching on strict
  // equality (not truthiness) is required here: `unassigned ? ... : {}`
  // would treat `false` the same as `undefined` and silently return every
  // job for an explicit "assigned" filter request.
  if (filters.unassigned === true) {
    conditions.push({ assignments: { none: { removedAt: null } } });
  } else if (filters.unassigned === false) {
    conditions.push({ assignments: { some: { removedAt: null } } });
  }

  if (filters.needsAttention === true) {
    conditions.push(buildNeedsAttentionWhere(now));
  }

  if (search) {
    conditions.push({
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { jobNumber: { contains: search, mode: "insensitive" } },
        { jobType: { contains: search, mode: "insensitive" } },
        { project: { name: { contains: search, mode: "insensitive" } } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
        { serviceAddress: { addressLine1: { contains: search, mode: "insensitive" } } },
      ],
    });
  }

  return {
    ...scopedJobAccessWhere(filters.orgId, filters.auth),
    status: filters.status,
    priority: filters.priority,
    projectId: filters.projectId,
    customerId: filters.customerId,
    archivedAt: filters.archived ? { not: null } : null,
    ...(conditions.length > 0 ? { AND: conditions } : {}),
  };
}

function assertManager(role: string) {
  if (!MANAGER_ROLES.has(role)) {
    throw new ApiError(403, "You do not have permission to perform this action");
  }
}

function assertFieldWorker(role: string) {
  if (!TECHNICIAN_FIELD_ROLES.has(role)) {
    throw new ApiError(403, "You do not have permission to perform this action");
  }
}

function validateScheduleRange(
  scheduledStart: Date | null,
  scheduledEnd: Date | null,
  arrivalWindowStart: Date | null,
  arrivalWindowEnd: Date | null
) {
  if ((scheduledStart && !scheduledEnd) || (!scheduledStart && scheduledEnd)) {
    throw new ApiError(400, "scheduledStart and scheduledEnd must both be provided");
  }
  if (scheduledStart && scheduledEnd && scheduledEnd <= scheduledStart) {
    throw new ApiError(400, "scheduledEnd must be later than scheduledStart");
  }
  if ((arrivalWindowStart && !arrivalWindowEnd) || (!arrivalWindowStart && arrivalWindowEnd)) {
    throw new ApiError(400, "arrivalWindowStart and arrivalWindowEnd must both be provided");
  }
  if (arrivalWindowStart && arrivalWindowEnd && arrivalWindowEnd <= arrivalWindowStart) {
    throw new ApiError(400, "arrivalWindowEnd must be later than arrivalWindowStart");
  }
  if (scheduledStart && scheduledEnd && arrivalWindowStart && arrivalWindowEnd) {
    if (arrivalWindowStart < startOfDay(scheduledStart) || arrivalWindowEnd > endOfDay(scheduledEnd)) {
      throw new ApiError(400, "Arrival window must be compatible with the scheduled date");
    }
  }
}

function validateDuration(estimatedDurationMinutes: number | null) {
  if (estimatedDurationMinutes !== null && estimatedDurationMinutes <= 0) {
    throw new ApiError(400, "estimatedDurationMinutes must be positive");
  }
}

function startOfDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0));
}

function endOfDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999));
}

function uniqueValues(values?: string[]): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function clamp(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || Number.isNaN(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

function mapAssignmentConstraintError(error: unknown, userId: string): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new ApiError(409, `User ${userId} already has an active assignment on this job`);
  }
  return error as Error;
}

function toJobSummaryDTO(row: {
  id: string;
  jobNumber: string;
  title: string;
  jobType: string;
  status: string;
  priority: string;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  archivedAt: Date | null;
}): JobSummaryDTO {
  return {
    id: row.id,
    jobNumber: row.jobNumber,
    title: row.title,
    jobType: row.jobType,
    status: normalizeJobStatus(row.status),
    priority: row.priority as JobPriority,
    scheduledStart: row.scheduledStart?.toISOString() ?? null,
    scheduledEnd: row.scheduledEnd?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
  };
}

// Enriches the base summary DTO with the dispatcher-workspace fields that
// only JobsService.list populates: parent project/customer summaries,
// currently-active assigned technicians, and the three dispatchRules-derived
// attention booleans. `now` is captured once per list() call by the caller
// and threaded through here so every row in a page is judged consistently.
function toDispatchAwareJobSummaryDTO(
  row: {
    id: string;
    jobNumber: string;
    title: string;
    jobType: string;
    status: string;
    priority: string;
    scheduledStart: Date | null;
    scheduledEnd: Date | null;
    archivedAt: Date | null;
    project: { id: string; name: string; siteAddress: string | null } | null;
    customer: { id: string; name: string } | null;
    assignments: { userId: string; user: { id: string; fullName: string | null; email: string } }[];
  },
  now: Date
): JobSummaryDTO {
  const activeAssignmentCount = row.assignments.length;
  return {
    ...toJobSummaryDTO(row),
    project: row.project
      ? { id: row.project.id, name: row.project.name, siteAddress: row.project.siteAddress }
      : null,
    customer: row.customer ? { id: row.customer.id, name: row.customer.name } : null,
    assignedTechnicians: row.assignments.map((assignment) => ({
      userId: assignment.userId,
      name: assignment.user.fullName ?? assignment.user.email,
    })),
    isOverdue: isJobOverdue({ status: row.status, scheduledStart: row.scheduledStart }, now),
    isUnassigned: isJobUnassigned({ status: row.status, activeAssignmentCount }),
    needsAttention: jobNeedsAttention(
      { status: row.status, scheduledStart: row.scheduledStart, activeAssignmentCount },
      now
    ),
  };
}

// Narrow, defensive read of `settings_json.timezone` — organizationSettings
// stores an arbitrary Partial<OrganizationSettingsSnapshot> as JSON (see
// modules/settings/service.ts's own isSettingsSnapshot guard), so this
// treats anything other than a present string field as "no timezone set"
// and lets dispatchRules.resolveOrgTimezone apply its own UTC fallback.
function readOrgTimezoneSetting(settingsJson: Prisma.JsonValue | null | undefined): string | null {
  if (!settingsJson || typeof settingsJson !== "object" || Array.isArray(settingsJson)) return null;
  const value = (settingsJson as Record<string, unknown>).timezone;
  return typeof value === "string" ? value : null;
}

function toAssignmentDTO(row: {
  id: string;
  jobId: string;
  userId: string;
  assignmentRole: string;
  isLead: boolean;
  assignedAt: Date;
  assignedById: string;
  acceptedAt: Date | null;
  declinedAt: Date | null;
  removedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; fullName: string | null; email: string };
}): JobAssignmentDTO {
  return {
    id: row.id,
    jobId: row.jobId,
    userId: row.userId,
    assignmentRole: row.assignmentRole as JobAssignmentDTO["assignmentRole"],
    isLead: row.isLead,
    assignedAt: row.assignedAt.toISOString(),
    assignedById: row.assignedById,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    declinedAt: row.declinedAt?.toISOString() ?? null,
    removedAt: row.removedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    user: {
      id: row.user.id,
      fullName: row.user.fullName,
      email: row.user.email,
    },
  };
}

function toJobDTO(
  row: Prisma.JobGetPayload<{ include: typeof jobDetailInclude }>,
  notes: Array<{ id: string; body: string; authorUserId: string | null; createdAt: Date; updatedAt: Date }>,
  recentActivity: Array<JobActivityDTO>
): JobDTO {
  return {
    ...toJobSummaryDTO(row),
    projectId: row.projectId,
    customerId: row.customerId,
    serviceAddressId: row.serviceAddressId,
    description: row.description,
    arrivalWindowStart: row.arrivalWindowStart?.toISOString() ?? null,
    arrivalWindowEnd: row.arrivalWindowEnd?.toISOString() ?? null,
    estimatedDurationMinutes: row.estimatedDurationMinutes,
    actualStart: row.actualStart?.toISOString() ?? null,
    actualEnd: row.actualEnd?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    completedById: row.completedById,
    readyForInvoiceAt: row.readyForInvoiceAt?.toISOString() ?? null,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    project: {
      id: row.project.id,
      name: row.project.name,
      status: row.project.status,
    },
    customer: {
      id: row.customer.id,
      name: row.customer.name,
      email: row.customer.email,
      phone: row.customer.phone,
    },
    serviceAddress: {
      id: row.serviceAddress.id,
      label: row.serviceAddress.label,
      addressLine1: row.serviceAddress.addressLine1,
      addressLine2: row.serviceAddress.addressLine2,
      city: row.serviceAddress.city,
      state: row.serviceAddress.state,
      postalCode: row.serviceAddress.postalCode,
      country: row.serviceAddress.country,
    },
    assignments: row.assignments.map(toAssignmentDTO),
    equipment: row.equipmentLinks.map(
      (link): JobEquipmentDTO => ({
        id: link.equipment.id,
        name: link.equipment.name,
        manufacturer: link.equipment.manufacturer,
        model: link.equipment.model,
        serialNumber: link.equipment.serialNumber,
        status: link.equipment.status,
      })
    ),
    tasks: row.tasks.map(
      (task): JobTaskDTO => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate?.toISOString() ?? null,
        assignedTo: task.assignedTo,
        completedAt: task.completedAt?.toISOString() ?? null,
        notes: task.notes,
      })
    ),
    siteVisits: row.siteVisits.map(
      (visit): JobSiteVisitDTO => ({
        id: visit.id,
        notes: visit.notes,
        transcript: visit.transcript,
        detailsJson: toRecord(visit.detailsJson),
        createdAt: visit.createdAt.toISOString(),
        updatedAt: visit.updatedAt.toISOString(),
      })
    ),
    notes: notes.map(
      (note): JobNoteDTO => ({
        id: note.id,
        body: note.body,
        authorUserId: note.authorUserId,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      })
    ),
    recentActivity,
  };
}

function normalizeJobStatus(status: string): JobStatus {
  if (!jobStatuses.includes(status as JobStatus)) {
    throw new ApiError(500, `Unknown job status ${status}`);
  }
  return status as JobStatus;
}

function toRecord(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
