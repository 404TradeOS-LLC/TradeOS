import { Request, Response } from "express";
import { z } from "zod";
import { CustomerPortalRequest } from "../middleware/customerPortal";
import { requireAuthContext, requireOrgId, requirePermissions } from "../requestContext";
import { ApiError } from "../middleware/errorHandler";
import { CustomerPortalService } from "../../modules/customer-portal/service";

const service = new CustomerPortalService();

const redeemSchema = z.object({ token: z.string().min(40).max(128) });
const issueSchema = z.object({ customerId: z.string().uuid() });
const signSchema = z.object({
  signerName: z.string().trim().min(1).max(200),
  signatureDataUrl: z.string().max(2_000_000).optional(),
  signatureIpReported: z.string().trim().max(120).optional(),
  signatureUserAgentReported: z.string().trim().max(512).optional(),
});

export const customerPortalController = {
  async redeem(req: Request, res: Response) {
    const { token } = redeemSchema.parse(req.body);
    res.json(await service.redeemAccessToken(token));
  },

  async issue(req: Request, res: Response) {
    requirePermissions(req, ["documents.manage"]);
    const auth = requireAuthContext(req);
    const { customerId } = issueSchema.parse(req.body);
    const issued = await service.issueAccessToken({ orgId: requireOrgId(req), customerId, createdByUserId: auth.userId });
    res.status(201).json({ id: issued.id, customerId: issued.customerId, token: issued.token, expiresAt: issued.expiresAt });
  },

  async revoke(req: Request, res: Response) {
    requirePermissions(req, ["documents.manage"]);
    await service.revokeAccessToken(requireOrgId(req), req.params.id);
    res.status(204).send();
  },

  async session(req: CustomerPortalRequest, res: Response) {
    res.json({ sessionId: requirePortal(req).sessionId, customerId: requirePortal(req).customerId, orgId: requirePortal(req).orgId });
  },

  async listProjects(req: CustomerPortalRequest, res: Response) {
    res.json(await service.listProjects(requirePortal(req)));
  },

  async getProject(req: CustomerPortalRequest, res: Response) {
    res.json(await service.getProject(requirePortal(req), req.params.id));
  },

  async getProposal(req: CustomerPortalRequest, res: Response) {
    res.json(await service.getProposal(requirePortal(req), req.params.id));
  },

  async getInvoice(req: CustomerPortalRequest, res: Response) {
    res.json(await service.getInvoice(requirePortal(req), req.params.id));
  },

  async getContract(req: CustomerPortalRequest, res: Response) {
    res.json(await service.getContract(requirePortal(req), req.params.id));
  },

  async getProposalPdf(req: CustomerPortalRequest, res: Response) {
    const document = await service.getProposalPdf(requirePortal(req), req.params.id);
    sendPdf(res, document);
  },

  async getInvoicePdf(req: CustomerPortalRequest, res: Response) {
    const document = await service.getInvoicePdf(requirePortal(req), req.params.id);
    sendPdf(res, document);
  },

  async getContractPdf(req: CustomerPortalRequest, res: Response) {
    const document = await service.getContractPdf(requirePortal(req), req.params.id);
    sendPdf(res, document);
  },

  async signContract(req: CustomerPortalRequest, res: Response) {
    const body = signSchema.parse(req.body);
    const portal = requirePortal(req);
    res.json(await service.signContract(portal, req.params.id, body));
  },
};

function requirePortal(req: CustomerPortalRequest) {
  if (!req.customerPortal) throw new ApiError(401, "Customer portal session is required");
  return req.customerPortal;
}

function sendPdf(res: Response, document: { buffer: Buffer; contentType: string; filename: string }): void {
  res.setHeader("Content-Type", document.contentType);
  res.setHeader("Content-Disposition", `inline; filename="${document.filename}"`);
  res.send(document.buffer);
}
