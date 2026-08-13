import { Request, Response } from "express";
import { z } from "zod";
import { TransactionalJobsService } from "../../modules/athena-events/transactionalPublishers";
import { jobAssignmentRoles } from "../../modules/jobs/types";
import { requireAuthContext, requireOrgId } from "../requestContext";
import { jobsController as baseJobsController, scheduleController } from "./jobs.controller";

const service = new TransactionalJobsService();

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

const reasonSchema = z.object({
  reason: z.string().trim().optional(),
});

export const jobsController = {
  ...baseJobsController,

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

  async complete(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = reasonSchema.parse(req.body);
    res.json(
      await service.complete(req.params.jobId, {
        orgId: requireOrgId(req),
        actor: auth,
        reason: body.reason,
      })
    );
  },
};

export { scheduleController };
