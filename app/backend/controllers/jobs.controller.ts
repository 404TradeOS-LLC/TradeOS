import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../db/client";
import { requireAuthContext, requireOrgId } from "../requestContext";
import { jobStatuses } from "../../domain/contracts";
import { jobAssignmentRoles, jobPriorities } from "../../modules/jobs/types";
import { JobsService } from "../../modules/jobs/service";

const service = new JobsService();

const uuidArray = z.array(z.string().uuid()).optional();

const createJobSchema = z.object({
  projectId: z.string().uuid(),
  customerId: z.string().uuid(),
  serviceAddressId: z.string().uuid(),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  jobType: z.string().trim().min(1),
  priority: z.enum(jobPriorities).optional(),
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
  arrivalWindowStart: z.string().datetime().optional(),
  arrivalWindowEnd: z.string().datetime().optional(),
  estimatedDurationMinutes: z.coerce.number().int().positive().optional(),
  technicianIds: uuidArray,
  equipmentIds: uuidArray,
  overrideConflict: z.boolean().optional(),
  overrideReason: z.string().trim().optional(),
});

const updateJobSchema = z.object({
  projectId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  serviceAddressId: z.string().uuid().optional(),
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  jobType: z.string().trim().min(1).optional(),
  priority: z.enum(jobPriorities).optional(),
  equipmentIds: uuidArray,
});

const scheduleSchema = z.object({
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime(),
  arrivalWindowStart: z.string().datetime().optional(),
  arrivalWindowEnd: z.string().datetime().optional(),
  estimatedDurationMinutes: z.coerce.number().int().positive().optional(),
  overrideConflict: z.boolean().optional(),
  overrideReason: z.string().trim().optional(),
});

const assignmentSchema = z.object({
  userId: z.string().uuid(),
  assignmentRole: z.enum(jobAssignmentRoles),
  isLead: z.boolean().optional(),
  overrideConflict: z.boolean().optional(),
  overrideReason: z.string().trim().optional(),
});

const assignmentUpdateSchema = z.object({
  assignmentRole: z.enum(jobAssignmentRoles).optional(),
  isLead: z.boolean().optional(),
  overrideConflict: z.boolean().optional(),
  overrideReason: z.string().trim().optional(),
});

const reasonSchema = z.object({
  reason: z.string().trim().optional(),
});

const reopenSchema = reasonSchema.extend({
  status: z.enum(["unscheduled", "scheduled"]).optional(),
});

// z.coerce.boolean() is `Boolean(value)` under the hood, so any nonempty
// query string - including the literal string "false" - coerces to `true`.
// `unassigned` needs a genuine assigned/unassigned/omitted tri-state (the
// dispatcher UI sends `unassigned=false` for "Assigned"), so it gets a
// strict parser instead: only the exact strings "true"/"false" are
// accepted, anything else fails validation (ZodError -> the existing
// centralized 400 handling), consistent with how the rest of this schema
// already rejects malformed values rather than silently coercing them.
const strictOptionalBooleanParam = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();

const listJobsQuerySchema = z.object({
  status: z.enum(jobStatuses).optional(),
  priority: z.enum(jobPriorities).optional(),
  projectId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  technicianId: z.string().uuid().optional(),
  scheduledFrom: z.string().datetime().optional(),
  scheduledTo: z.string().datetime().optional(),
  archived: z.coerce.boolean().optional(),
  search: z.string().trim().optional(),
  unassigned: strictOptionalBooleanParam,
  needsAttention: strictOptionalBooleanParam,
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const scheduleConflictsQuerySchema = z.object({
  technicianId: z.string().uuid().optional(),
  scheduledFrom: z.string().datetime(),
  scheduledTo: z.string().datetime(),
});

const noteSchema = z.object({
  body: z.string().trim().min(1),
});

export const jobsController = {
  async create(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = createJobSchema.parse(req.body);
    res.status(201).json(
      await service.create({
        orgId: requireOrgId(req),
        actor: auth,
        projectId: body.projectId,
        customerId: body.customerId,
        serviceAddressId: body.serviceAddressId,
        title: body.title,
        description: body.description,
        jobType: body.jobType,
        priority: body.priority,
        scheduledStart: body.scheduledStart ? new Date(body.scheduledStart) : undefined,
        scheduledEnd: body.scheduledEnd ? new Date(body.scheduledEnd) : undefined,
        arrivalWindowStart: body.arrivalWindowStart ? new Date(body.arrivalWindowStart) : undefined,
        arrivalWindowEnd: body.arrivalWindowEnd ? new Date(body.arrivalWindowEnd) : undefined,
        estimatedDurationMinutes: body.estimatedDurationMinutes,
        technicianIds: body.technicianIds,
        equipmentIds: body.equipmentIds,
        overrideConflict: body.overrideConflict,
        overrideReason: body.overrideReason,
      })
    );
  },

  async list(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const query = listJobsQuerySchema.parse(req.query);
    res.json(
      await service.list({
        orgId: requireOrgId(req),
        auth,
        status: query.status,
        priority: query.priority,
        projectId: query.projectId,
        customerId: query.customerId,
        technicianId: query.technicianId,
        scheduledFrom: query.scheduledFrom ? new Date(query.scheduledFrom) : undefined,
        scheduledTo: query.scheduledTo ? new Date(query.scheduledTo) : undefined,
        archived: query.archived,
        search: query.search,
        unassigned: query.unassigned,
        needsAttention: query.needsAttention,
        page: query.page,
        pageSize: query.pageSize,
      })
    );
  },

  async dispatchSummary(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    res.json(await service.getDispatchSummary(requireOrgId(req), auth));
  },

  async getById(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    res.json(await service.getById(requireOrgId(req), req.params.jobId, auth));
  },

  async update(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = updateJobSchema.parse(req.body);
    res.json(
      await service.update(req.params.jobId, {
        orgId: requireOrgId(req),
        actor: auth,
        projectId: body.projectId,
        customerId: body.customerId,
        serviceAddressId: body.serviceAddressId,
        title: body.title,
        description: body.description,
        jobType: body.jobType,
        priority: body.priority,
        equipmentIds: body.equipmentIds,
      })
    );
  },

  async remove(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    await service.archive(req.params.jobId, {
      orgId: requireOrgId(req),
      actor: auth,
    });
    res.status(204).send();
  },

  async schedule(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = scheduleSchema.parse(req.body);
    res.json(
      await service.schedule(req.params.jobId, {
        orgId: requireOrgId(req),
        actor: auth,
        scheduledStart: new Date(body.scheduledStart),
        scheduledEnd: new Date(body.scheduledEnd),
        arrivalWindowStart: body.arrivalWindowStart ? new Date(body.arrivalWindowStart) : undefined,
        arrivalWindowEnd: body.arrivalWindowEnd ? new Date(body.arrivalWindowEnd) : undefined,
        estimatedDurationMinutes: body.estimatedDurationMinutes,
        overrideConflict: body.overrideConflict,
        overrideReason: body.overrideReason,
      })
    );
  },

  async reschedule(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = scheduleSchema.parse(req.body);
    res.json(
      await service.reschedule(req.params.jobId, {
        orgId: requireOrgId(req),
        actor: auth,
        scheduledStart: new Date(body.scheduledStart),
        scheduledEnd: new Date(body.scheduledEnd),
        arrivalWindowStart: body.arrivalWindowStart ? new Date(body.arrivalWindowStart) : undefined,
        arrivalWindowEnd: body.arrivalWindowEnd ? new Date(body.arrivalWindowEnd) : undefined,
        estimatedDurationMinutes: body.estimatedDurationMinutes,
        overrideConflict: body.overrideConflict,
        overrideReason: body.overrideReason,
      })
    );
  },

  async dispatch(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = reasonSchema.parse(req.body);
    res.json(await service.dispatch(req.params.jobId, { orgId: requireOrgId(req), actor: auth, reason: body.reason }));
  },

  async startTravel(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = reasonSchema.parse(req.body);
    res.json(await service.startTravel(req.params.jobId, { orgId: requireOrgId(req), actor: auth, reason: body.reason }));
  },

  async arrive(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = reasonSchema.parse(req.body);
    res.json(await service.arrive(req.params.jobId, { orgId: requireOrgId(req), actor: auth, reason: body.reason }));
  },

  async pause(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = reasonSchema.parse(req.body);
    res.json(await service.pause(req.params.jobId, { orgId: requireOrgId(req), actor: auth, reason: body.reason }));
  },

  async resume(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = reasonSchema.parse(req.body);
    res.json(await service.resume(req.params.jobId, { orgId: requireOrgId(req), actor: auth, reason: body.reason }));
  },

  async complete(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = reasonSchema.parse(req.body);
    res.json(await service.complete(req.params.jobId, { orgId: requireOrgId(req), actor: auth, reason: body.reason }));
  },

  async cancel(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = reasonSchema.parse(req.body);
    res.json(await service.cancel(req.params.jobId, { orgId: requireOrgId(req), actor: auth, reason: body.reason }));
  },

  async reopen(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = reopenSchema.parse(req.body);
    res.json(
      await service.reopen(req.params.jobId, {
        orgId: requireOrgId(req),
        actor: auth,
        reason: body.reason,
        status: body.status,
      })
    );
  },

  async readyForInvoice(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = reasonSchema.parse(req.body);
    res.json(await service.readyForInvoice(req.params.jobId, { orgId: requireOrgId(req), actor: auth, reason: body.reason }));
  },

  async listAssignments(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    res.json(await service.listAssignments(req.params.jobId, requireOrgId(req), auth));
  },

  async addAssignment(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = assignmentSchema.parse(req.body);
    res.status(201).json(
      await service.addAssignment(req.params.jobId, {
        orgId: requireOrgId(req),
        actor: auth,
        userId: body.userId,
        assignmentRole: body.assignmentRole,
        isLead: body.isLead,
        overrideConflict: body.overrideConflict,
        overrideReason: body.overrideReason,
      })
    );
  },

  async updateAssignment(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = assignmentUpdateSchema.parse(req.body);
    res.json(
      await service.updateAssignment(req.params.jobId, req.params.assignmentId, {
        orgId: requireOrgId(req),
        actor: auth,
        assignmentRole: body.assignmentRole,
        isLead: body.isLead,
        overrideConflict: body.overrideConflict,
        overrideReason: body.overrideReason,
      })
    );
  },

  async removeAssignment(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = reasonSchema.parse(req.body);
    await service.removeAssignment(req.params.jobId, req.params.assignmentId, {
      orgId: requireOrgId(req),
      actor: auth,
      reason: body.reason,
    });
    res.status(204).send();
  },

  async acceptAssignment(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = reasonSchema.parse(req.body);
    res.json(
      await service.acceptAssignment(req.params.jobId, req.params.assignmentId, {
        orgId: requireOrgId(req),
        actor: auth,
        reason: body.reason,
      })
    );
  },

  async declineAssignment(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = reasonSchema.parse(req.body);
    res.json(
      await service.declineAssignment(req.params.jobId, req.params.assignmentId, {
        orgId: requireOrgId(req),
        actor: auth,
        reason: body.reason,
      })
    );
  },

  async listNotes(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    await service.getById(requireOrgId(req), req.params.jobId, auth);
    res.json(
      await prisma.comment.findMany({
        where: { orgId: requireOrgId(req), entityType: "job", entityId: req.params.jobId },
        orderBy: { createdAt: "desc" },
      })
    );
  },

  async addNote(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = noteSchema.parse(req.body);
    await service.getById(requireOrgId(req), req.params.jobId, auth);
    res.status(201).json(
      await prisma.comment.create({
        data: {
          orgId: requireOrgId(req),
          entityType: "job",
          entityId: req.params.jobId,
          body: body.body,
          authorUserId: auth.userId,
        },
      })
    );
  },
};

export const scheduleController = {
  async list(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const query = listJobsQuerySchema.parse(req.query);
    res.json(
      await service.listSchedule({
        orgId: requireOrgId(req),
        auth,
        status: query.status,
        priority: query.priority,
        projectId: query.projectId,
        customerId: query.customerId,
        technicianId: query.technicianId,
        scheduledFrom: query.scheduledFrom ? new Date(query.scheduledFrom) : undefined,
        scheduledTo: query.scheduledTo ? new Date(query.scheduledTo) : undefined,
        archived: false,
        search: query.search,
        page: query.page,
        pageSize: query.pageSize,
      })
    );
  },

  async conflicts(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const query = scheduleConflictsQuerySchema.parse(req.query);
    res.json(
      await service.getScheduleConflicts({
        orgId: requireOrgId(req),
        actor: auth,
        technicianId: query.technicianId,
        scheduledFrom: new Date(query.scheduledFrom),
        scheduledTo: new Date(query.scheduledTo),
      })
    );
  },
};
