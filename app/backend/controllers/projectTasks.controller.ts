import { Request, Response } from "express";
import { z } from "zod";
import { requireOrgId, requirePermissions } from "../requestContext";
import { prisma } from "../../db/client";
import { runInDatabaseTransaction } from "../../db/requestSession";
import { ProjectTasksService } from "../../modules/project-tasks/service";
import { ActivityTimelineService } from "../../modules/intelligence/service";
import { projectTaskPriorities, projectTaskStatuses } from "../../modules/project-tasks/types";

const service = new ProjectTasksService();

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
    const task = await runInDatabaseTransaction(prisma, async (transaction) => {
      const taskService = new ProjectTasksService(transaction as typeof prisma);
      const transactionActivityService = new ActivityTimelineService(transaction as typeof prisma);
      const createdTask = await taskService.create({
        orgId,
        projectId: req.params.id,
        jobId: body.jobId,
        title: body.title,
        assignedTo: body.assignedTo || undefined,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        priority: body.priority,
        notes: body.notes || undefined,
      });
      await transactionActivityService.record({
        orgId,
        entityType: "task",
        entityId: createdTask.id,
        eventType: "task.created",
        title: `Task created: ${createdTask.title}`,
        description: createdTask.assignedTo ? `Assigned to ${createdTask.assignedTo}.` : "Unassigned task added to the project queue.",
        actorUserId: auth.userId,
        metadata: {
          projectId: createdTask.projectId,
          status: createdTask.status,
          priority: createdTask.priority,
          dueDate: createdTask.dueDate,
        },
      });
      return createdTask;
    });
    res.status(201).json(task);
  },

  async update(req: Request, res: Response) {
    const auth = requirePermissions(req, ["crm.write"]);
    const body = updateSchema.parse(req.body);
    const orgId = requireOrgId(req);
    const task = await runInDatabaseTransaction(prisma, async (transaction) => {
      const taskService = new ProjectTasksService(transaction as typeof prisma);
      const transactionActivityService = new ActivityTimelineService(transaction as typeof prisma);
      const before = await taskService.getById(req.params.taskId, orgId);
      const updatedTask = await taskService.update(req.params.taskId, {
        orgId,
        jobId: body.jobId,
        title: body.title,
        status: body.status,
        assignedTo: body.assignedTo,
        dueDate: body.dueDate === undefined ? undefined : body.dueDate === null ? null : new Date(body.dueDate),
        priority: body.priority,
        notes: body.notes,
      });
      await transactionActivityService.record({
        orgId,
        entityType: "task",
        entityId: updatedTask.id,
        eventType: body.status && body.status !== before.status ? `task.${body.status}` : "task.updated",
        title:
          body.status && body.status !== before.status
            ? `Task ${body.status.replaceAll("_", " ")}: ${updatedTask.title}`
            : `Task updated: ${updatedTask.title}`,
        description: [
          body.assignedTo !== undefined ? (updatedTask.assignedTo ? `Assigned to ${updatedTask.assignedTo}.` : "Task is unassigned.") : null,
          body.dueDate !== undefined ? (updatedTask.dueDate ? `Due ${updatedTask.dueDate}.` : "No due date.") : null,
        ]
          .filter(Boolean)
          .join(" "),
        actorUserId: auth.userId,
        metadata: {
          projectId: updatedTask.projectId,
          previousStatus: before.status,
          status: updatedTask.status,
          previousAssignedTo: before.assignedTo,
          assignedTo: updatedTask.assignedTo,
          previousDueDate: before.dueDate,
          dueDate: updatedTask.dueDate,
          priority: updatedTask.priority,
        },
      });
      return updatedTask;
    });
    res.json(task);
  },

  async remove(req: Request, res: Response) {
    const auth = requirePermissions(req, ["crm.write"]);
    const orgId = requireOrgId(req);
    await runInDatabaseTransaction(prisma, async (transaction) => {
      const taskService = new ProjectTasksService(transaction as typeof prisma);
      const transactionActivityService = new ActivityTimelineService(transaction as typeof prisma);
      const task = await taskService.getById(req.params.taskId, orgId);
      await taskService.remove(req.params.taskId, orgId);
      await transactionActivityService.record({
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
    });
    res.status(204).send();
  },
};
