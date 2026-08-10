import { Request, Response } from "express";
import { z } from "zod";
import { requireOrgId, requirePermissions } from "../requestContext";
import { ProjectTasksService } from "../../modules/project-tasks/service";
import { projectTaskPriorities, projectTaskStatuses } from "../../modules/project-tasks/types";

const service = new ProjectTasksService();

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  includeCompleted: z.coerce.boolean().optional(),
});

const createSchema = z.object({
  jobId: z.string().uuid().optional(),
  title: z.string().min(1),
  assignedTo: z.string().trim().optional(),
  dueDate: z.string().datetime().optional(),
  priority: z.enum(projectTaskPriorities).optional(),
  notes: z.string().trim().optional(),
});

const updateSchema = z.object({
  jobId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).optional(),
  status: z.enum(projectTaskStatuses).optional(),
  assignedTo: z.string().trim().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  priority: z.enum(projectTaskPriorities).optional(),
  notes: z.string().trim().nullable().optional(),
});

export const projectTasksController = {
  async listByOrganization(req: Request, res: Response) {
    requirePermissions(req, ["crm.read"]);
    const query = listQuerySchema.parse(req.query);
    res.json(
      await service.listByOrganization({
        orgId: requireOrgId(req),
        limit: query.limit,
        includeCompleted: query.includeCompleted,
      })
    );
  },

  async listByProject(req: Request, res: Response) {
    requirePermissions(req, ["crm.read"]);
    res.json(await service.listByProject(req.params.id, requireOrgId(req)));
  },

  async create(req: Request, res: Response) {
    requirePermissions(req, ["crm.write"]);
    const body = createSchema.parse(req.body);
    res.status(201).json(
      await service.create({
        orgId: requireOrgId(req),
        projectId: req.params.id,
        jobId: body.jobId,
        title: body.title,
        assignedTo: body.assignedTo || undefined,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        priority: body.priority,
        notes: body.notes || undefined,
      })
    );
  },

  async update(req: Request, res: Response) {
    requirePermissions(req, ["crm.write"]);
    const body = updateSchema.parse(req.body);
    res.json(
      await service.update(req.params.taskId, {
        orgId: requireOrgId(req),
        jobId: body.jobId,
        title: body.title,
        status: body.status,
        assignedTo: body.assignedTo,
        dueDate: body.dueDate === undefined ? undefined : body.dueDate === null ? null : new Date(body.dueDate),
        priority: body.priority,
        notes: body.notes,
      })
    );
  },

  async remove(req: Request, res: Response) {
    requirePermissions(req, ["crm.write"]);
    await service.remove(req.params.taskId, requireOrgId(req));
    res.status(204).send();
  },
};
