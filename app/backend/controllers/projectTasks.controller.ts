import { Request, Response } from "express";
import { z } from "zod";
import { requireOrgId, requirePermissions } from "../requestContext";
import { ProjectTasksService } from "../../modules/project-tasks/service";
import { ActivityTimelineService } from "../../modules/intelligence/service";
import { projectTaskPriorities, projectTaskStatuses } from "../../modules/project-tasks/types";

const service = new ProjectTasksService();
const activityService = new ActivityTimelineService();

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  includeCompleted: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
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
    const auth = requirePermissions(req, ["crm.write"]);
    const body = createSchema.parse(req.body);
    const orgId = requireOrgId(req);
    const task = await service.create({
      orgId,
      projectId: req.params.id,
      jobId: body.jobId,
      title: body.title,
      assignedTo: body.assignedTo || undefined,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      priority: body.priority,
      notes: body.notes || undefined,
    });
    await activityService.record({
      orgId,
      entityType: "task",
      entityId: task.id,
      eventType: "task.created",
      title: `Task created: ${task.title}`,
      description: task.assignedTo ? `Assigned to ${task.assignedTo}.` : "Unassigned task added to the project queue.",
      actorUserId: auth.userId,
      metadata: {
        projectId: task.projectId,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
      },
    });
    res.status(201).json(task);
  },

  async update(req: Request, res: Response) {
    const auth = requirePermissions(req, ["crm.write"]);
    const body = updateSchema.parse(req.body);
    const orgId = requireOrgId(req);
    const before = await service.getById(req.params.taskId, orgId);
    const task = await service.update(req.params.taskId, {
      orgId,
      jobId: body.jobId,
      title: body.title,
      status: body.status,
      assignedTo: body.assignedTo,
      dueDate: body.dueDate === undefined ? undefined : body.dueDate === null ? null : new Date(body.dueDate),
      priority: body.priority,
      notes: body.notes,
    });
    await activityService.record({
      orgId,
      entityType: "task",
      entityId: task.id,
      eventType: body.status && body.status !== before.status ? `task.${body.status}` : "task.updated",
      title:
        body.status && body.status !== before.status
          ? `Task ${body.status.replaceAll("_", " ")}: ${task.title}`
          : `Task updated: ${task.title}`,
      description: [
        body.assignedTo !== undefined ? (task.assignedTo ? `Assigned to ${task.assignedTo}.` : "Task is unassigned.") : null,
        body.dueDate !== undefined ? (task.dueDate ? `Due ${task.dueDate}.` : "No due date.") : null,
      ]
        .filter(Boolean)
        .join(" "),
      actorUserId: auth.userId,
      metadata: {
        projectId: task.projectId,
        previousStatus: before.status,
        status: task.status,
        previousAssignedTo: before.assignedTo,
        assignedTo: task.assignedTo,
        previousDueDate: before.dueDate,
        dueDate: task.dueDate,
        priority: task.priority,
      },
    });
    res.json(task);
  },

  async remove(req: Request, res: Response) {
    const auth = requirePermissions(req, ["crm.write"]);
    const orgId = requireOrgId(req);
    const task = await service.getById(req.params.taskId, orgId);
    await service.remove(req.params.taskId, orgId);
    await activityService.record({
      orgId,
      entityType: "task",
      entityId: task.id,
      eventType: "task.deleted",
      title: `Task removed: ${task.title}`,
      description: task.assignedTo ? `Removed from ${task.assignedTo}'s queue.` : "Removed from the project queue.",
      actorUserId: auth.userId,
      metadata: {
        projectId: task.projectId,
        status: task.status,
        priority: task.priority,
      },
    });
    res.status(204).send();
  },
};
