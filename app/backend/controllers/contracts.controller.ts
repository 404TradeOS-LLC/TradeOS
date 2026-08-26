import { Request, Response } from "express";
import { z } from "zod";
import { ContractsService } from "../../modules/contracts/service";
import { requireAuthContext, requireOrgId } from "../requestContext";

const service = new ContractsService();

const createSchema = z.object({
  proposalId: z.string().uuid(),
  termsText: z.string().optional(),
});

const signSchema = z.object({
  signerName: z.string().min(1),
  signerEmail: z.string().email().optional(),
  signatureDataUrl: z.string().optional(),
});

export const contractsController = {
  async listByProject(req: Request, res: Response) {
    res.json(await service.listByProject(req.params.projectId, requireOrgId(req)));
  },
  async getById(req: Request, res: Response) {
    res.json(await service.getById(req.params.id, requireOrgId(req)));
  },
  async create(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    res
      .status(201)
      .json(await service.create({ ...createSchema.parse(req.body), orgId: requireOrgId(req), actorUserId: auth.userId, actorRole: auth.role }));
  },
  async getPdf(req: Request, res: Response) {
    const doc = await service.getPdf(req.params.id, requireOrgId(req));
    res.setHeader("Content-Type", doc.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${doc.filename}"`);
    res.send(doc.buffer);
  },
  async sign(req: Request, res: Response) {
    const body = signSchema.parse(req.body);
    const auth = requireAuthContext(req);
    res.json(
      await service.sign(req.params.id, {
        ...body,
        orgId: requireOrgId(req),
        actorUserId: auth.userId,
        actorRole: auth.role,
        signatureIp: req.ip,
      })
    );
  },
  async void(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    res.json(await service.void(req.params.id, requireOrgId(req), auth.userId, auth.role));
  },
};
