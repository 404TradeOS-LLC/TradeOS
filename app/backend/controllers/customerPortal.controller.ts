import { Request, Response } from "express";
import { z } from "zod";
import { CustomerPortalRequest } from "../middleware/customerPortal";
import { requireAuthContext, requireOrgId, requirePermissions } from "../requestContext";
import { ApiError } from "../middleware/errorHandler";
import { CustomerPortalService } from "../../modules/customer-portal/service";
import { sanitizeDownloadFilename } from "../../modules/documents/format";
import { isValidSignatureDataUrl } from "../../modules/proposals/signatureValidation";

const service = new CustomerPortalService();

const redeemSchema = z.object({ token: z.string().min(40).max(128) });
const issueSchema = z.object({ customerId: z.guid() });
const signSchema = z.object({
  signerName: z.string().trim().min(1).max(200),
  signatureDataUrl: z.string().max(2_000_000).optional(),
  signatureIpReported: z.string().trim().max(120).optional(),
  signatureUserAgentReported: z.string().trim().max(512).optional(),
});
// DES-10-F7: portal proposal acceptance requires a drawn signature — a
// typed name alone is not attributable. The data URL must decode to an
// actual image (see modules/proposals/signatureValidation.ts), and the
// response is bound to the revision the customer reviewed via
// expectedUpdatedAt (the proposal's updatedAt as rendered).
const acceptProposalSchema = z.object({
  signerName: z.string().trim().min(1).max(200),
  signatureDataUrl: z
    .string()
    .max(2_000_000)
    .refine(isValidSignatureDataUrl, { message: "A drawn signature is required" }),
  signatureIpReported: z.string().trim().max(120).optional(),
  signatureUserAgentReported: z.string().trim().max(512).optional(),
  expectedUpdatedAt: z.string().datetime().optional(),
});
const declineProposalSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  expectedUpdatedAt: z.string().datetime().optional(),
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

  async getCloseoutDocument(req: CustomerPortalRequest, res: Response) {
    const document = await service.getCloseoutDocument(requirePortal(req), req.params.id);
    sendHtml(res, document);
  },

  async signContract(req: CustomerPortalRequest, res: Response) {
    const body = signSchema.parse(req.body);
    const portal = requirePortal(req);
    res.json(await service.signContract(portal, req.params.id, body));
  },

  async acceptProposal(req: CustomerPortalRequest, res: Response) {
    const body = acceptProposalSchema.parse(req.body);
    const portal = requirePortal(req);
    res.json(await service.acceptProposal(portal, req.params.id, body));
  },

  async declineProposal(req: CustomerPortalRequest, res: Response) {
    const body = declineProposalSchema.parse(req.body);
    const portal = requirePortal(req);
    res.json(await service.declineProposal(portal, req.params.id, body));
  },
};

function requirePortal(req: CustomerPortalRequest) {
  if (!req.customerPortal) throw new ApiError(401, "Customer portal session is required");
  return req.customerPortal;
}

function sendPdf(res: Response, document: { buffer: Buffer; contentType: string; filename: string }): void {
  res.setHeader("Content-Type", document.contentType);
  res.setHeader("Content-Disposition", `inline; filename="${sanitizeDownloadFilename(document.filename)}"`);
  res.send(document.buffer);
}

function sendHtml(res: Response, document: { html: string; filename: string }): void {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `inline; filename="${sanitizeDownloadFilename(document.filename)}"`);
  res.send(document.html);
}
