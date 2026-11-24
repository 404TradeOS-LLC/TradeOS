import { Request, Response } from "express";
import { z } from "zod";
import { CloseoutService } from "../../modules/closeout/service";
import { sanitizeDownloadFilename } from "../../modules/documents/format";
import { requireOrgId, requirePermissions, requireRoles } from "../requestContext";

const service = new CloseoutService();

const MANAGER_ROLES = ["owner", "admin", "dispatcher"] as const;

const createPunchSchema = z.object({
  jobId: z.guid().nullable().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  assignedUserId: z.guid().nullable().optional(),
  assignedTo: z.string().trim().optional(),
  dueDate: z.string().datetime().optional(),
});

const updatePunchSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  assignedUserId: z.guid().nullable().optional(),
  assignedTo: z.string().trim().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

const createCloseoutSchema = z.object({
  notes: z.string().trim().optional(),
});

const createWarrantySchema = z.object({
  jobId: z.guid().nullable().optional(),
  contractId: z.guid().nullable().optional(),
  invoiceId: z.guid().nullable().optional(),
  title: z.string().min(1),
  coverageText: z.string().min(1),
  sourceType: z.enum(["contract", "invoice", "other"]),
  sourceId: z.string().trim().nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

const updateWarrantySchema = z.object({
  title: z.string().min(1).optional(),
  coverageText: z.string().min(1).optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

export const closeoutController = {
  // ---- Project closeout ----
  async createCloseout(req: Request, res: Response) {
    const auth = requirePermissions(req, ["crm.write"]);
    const body = createCloseoutSchema.parse(req.body);
    res.status(201).json(
      await service.createCloseoutForProject({
        orgId: requireOrgId(req),
        projectId: req.params.projectId,
        notes: body.notes,
        actorUserId: auth.userId,
      }),
    );
  },
  async getCloseout(req: Request, res: Response) {
    requirePermissions(req, ["crm.read"]);
    res.json(await service.getCloseoutByProject(req.params.projectId, requireOrgId(req)));
  },
  async markReady(req: Request, res: Response) {
    const auth = requirePermissions(req, ["crm.write"]);
    requireRoles(req, [...MANAGER_ROLES]);
    res.json(await service.markCloseoutReady(req.params.projectId, requireOrgId(req), auth.userId, auth.role));
  },
  async markHandedOff(req: Request, res: Response) {
    const auth = requirePermissions(req, ["crm.write"]);
    requireRoles(req, [...MANAGER_ROLES]);
    res.json(await service.markCloseoutHandedOff(req.params.projectId, requireOrgId(req), auth.userId, auth.role));
  },
  async getDocument(req: Request, res: Response) {
    requirePermissions(req, ["crm.read"]);
    const document = await service.getCloseoutDocumentHtml(req.params.projectId, requireOrgId(req));
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="${sanitizeDownloadFilename(document.filename)}"`);
    res.send(document.html);
  },

  // ---- Punch items ----
  async createPunchItem(req: Request, res: Response) {
    const auth = requirePermissions(req, ["crm.write"]);
    const body = createPunchSchema.parse(req.body);
    res.status(201).json(
      await service.createPunchItem({
        ...body,
        orgId: requireOrgId(req),
        projectId: req.params.projectId,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        createdById: auth.userId,
      }),
    );
  },
  async listPunchItems(req: Request, res: Response) {
    requirePermissions(req, ["crm.read"]);
    res.json(await service.listPunchItemsByProject(req.params.projectId, requireOrgId(req)));
  },
  async getPunchItem(req: Request, res: Response) {
    requirePermissions(req, ["crm.read"]);
    res.json(await service.getPunchItemById(req.params.id, requireOrgId(req)));
  },
  async updatePunchItem(req: Request, res: Response) {
    const auth = requirePermissions(req, ["crm.write"]);
    const body = updatePunchSchema.parse(req.body);
    res.json(
      await service.updatePunchItem(req.params.id, {
        ...body,
        orgId: requireOrgId(req),
        dueDate: body.dueDate === undefined ? undefined : body.dueDate === null ? null : new Date(body.dueDate),
        actorUserId: auth.userId,
      }),
    );
  },
  async resolvePunchItem(req: Request, res: Response) {
    // No permission-key gate: the service enforces the field boundary —
    // a manager, or the technician assigned to this punch item. (The
    // shared permission keys cannot express "the assigned technician",
    // the same reason JobsService field transitions carry no key.)
    const auth = requireRoles(req, [...MANAGER_ROLES, "technician"]);
    res.json(await service.resolvePunchItem(req.params.id, requireOrgId(req), auth.userId, auth.role));
  },
  async verifyPunchItem(req: Request, res: Response) {
    const auth = requirePermissions(req, ["crm.write"]);
    requireRoles(req, [...MANAGER_ROLES]);
    res.json(await service.verifyPunchItem(req.params.id, requireOrgId(req), auth.userId, auth.role));
  },
  async reopenPunchItem(req: Request, res: Response) {
    const auth = requirePermissions(req, ["crm.write"]);
    requireRoles(req, [...MANAGER_ROLES]);
    res.json(await service.reopenPunchItem(req.params.id, requireOrgId(req), auth.userId, auth.role));
  },

  // ---- Warranty records ----
  async createWarranty(req: Request, res: Response) {
    const auth = requirePermissions(req, ["crm.write"]);
    const body = createWarrantySchema.parse(req.body);
    res.status(201).json(
      await service.createWarrantyRecord({
        ...body,
        orgId: requireOrgId(req),
        projectId: req.params.projectId,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
        createdById: auth.userId,
      }),
    );
  },
  async listWarranties(req: Request, res: Response) {
    requirePermissions(req, ["crm.read"]);
    res.json(await service.listWarrantyRecordsByProject(req.params.projectId, requireOrgId(req)));
  },
  async getWarranty(req: Request, res: Response) {
    requirePermissions(req, ["crm.read"]);
    res.json(await service.getWarrantyRecordById(req.params.id, requireOrgId(req)));
  },
  async updateWarranty(req: Request, res: Response) {
    const auth = requirePermissions(req, ["crm.write"]);
    const body = updateWarrantySchema.parse(req.body);
    res.json(
      await service.updateWarrantyRecord(req.params.id, {
        ...body,
        orgId: requireOrgId(req),
        startsAt: body.startsAt === undefined ? undefined : body.startsAt === null ? null : new Date(body.startsAt),
        endsAt: body.endsAt === undefined ? undefined : body.endsAt === null ? null : new Date(body.endsAt),
        actorUserId: auth.userId,
      }),
    );
  },
  async deleteWarranty(req: Request, res: Response) {
    const auth = requirePermissions(req, ["crm.write"]);
    await service.deleteWarrantyRecord(req.params.id, requireOrgId(req), auth.userId);
    res.status(204).send();
  },
};
