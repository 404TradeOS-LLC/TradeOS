import { Request, Response } from "express";
import { z } from "zod";
import { requireOrgId, requirePermissions } from "../requestContext";
import { ApiError } from "../middleware/errorHandler";
import { CodesPermitTasksService } from "../../modules/costbook/codes/permitTasks.service";
import { permitStatuses, permitTaskKinds } from "../../modules/costbook/codes/types";

const service = new CodesPermitTasksService();

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "dueDate must be a YYYY-MM-DD date")
  .refine(
    (value) => {
      const [year, month, day] = value.split("-").map(Number);
      const parsed = new Date(Date.UTC(year, month - 1, day));
      return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
    },
    { message: "dueDate must be a real calendar date" },
  );

const uuid = z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, "Invalid UUID");

const createSchema = z.object({
  projectId: uuid,
  assessmentId: uuid.nullable().optional(),
  taskKind: z.enum(permitTaskKinds),
  title: z.string().trim().min(1).max(300),
  permitNumber: z.string().trim().min(1).max(120).nullable().optional(),
  assigneeId: uuid.nullable().optional(),
  dueDate: dateOnly.optional(),
}).strict();

const evidenceSchema = z.object({
  label: z.string().trim().min(1).max(200),
  reference: z.string().trim().min(1).max(500),
  addedBy: z.string().min(1).max(200),
  addedAt: z.string().min(1).max(64),
}).strict();

const updateSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
  title: z.string().trim().min(1).max(300).optional(),
  permitNumber: z.string().trim().min(1).max(120).nullable().optional(),
  permitStatus: z.enum(permitStatuses).optional(),
  assigneeId: uuid.nullable().optional(),
  dueDate: dateOnly.nullable().optional(),
  addEvidence: z.array(evidenceSchema).max(20).optional(),
}).strict();

const submitSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
  confirm: z.boolean(),
}).strict();

function toDueDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export const codesPermitTasksController = {
  async list(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const projectId = req.query.projectId;
    if (typeof projectId !== "string" || !projectId) throw new ApiError(400, "projectId query parameter is required");
    res.json(await service.list(requireOrgId(req), auth.role, auth.userId, projectId));
  },
  async getById(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    res.json(await service.get(requireOrgId(req), auth.role, auth.userId, req.params.taskId));
  },
  async create(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const body = createSchema.parse(req.body);
    res.status(201).json(
      await service.create({
        orgId: requireOrgId(req),
        role: auth.role,
        actorId: auth.userId,
        projectId: body.projectId,
        assessmentId: body.assessmentId ?? null,
        taskKind: body.taskKind,
        title: body.title,
        permitNumber: body.permitNumber ?? null,
        assigneeId: body.assigneeId ?? null,
        dueDate: toDueDate(body.dueDate) ?? null,
      }),
    );
  },
  async update(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const body = updateSchema.parse(req.body);
    res.json(
      await service.update({
        orgId: requireOrgId(req),
        role: auth.role,
        actorId: auth.userId,
        taskId: req.params.taskId,
        expectedUpdatedAt: new Date(body.expectedUpdatedAt),
        title: body.title,
        permitNumber: body.permitNumber,
        permitStatus: body.permitStatus,
        assigneeId: body.assigneeId,
        dueDate: toDueDate(body.dueDate),
        addEvidence: body.addEvidence,
      }),
    );
  },
  async submit(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    const body = submitSchema.parse(req.body);
    res.json(
      await service.submit({
        orgId: requireOrgId(req),
        role: auth.role,
        actorId: auth.userId,
        taskId: req.params.taskId,
        expectedUpdatedAt: new Date(body.expectedUpdatedAt),
        confirm: body.confirm,
      }),
    );
  },
  async remove(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.read"]);
    await service.remove(requireOrgId(req), auth.role, req.params.taskId);
    res.status(204).send();
  },
};
