import { Request, Response } from "express";
import { z } from "zod";
import { AdminDashboardService } from "../../modules/admin-dashboard/service";
import { parsePositiveNumber, requireOrgAccess, requireOrgId } from "../requestContext";
import { organizationMemberRoles, organizationMemberStatuses } from "../../modules/admin-dashboard/types";

const service = new AdminDashboardService();

export const adminDashboardController = {
  async getOrganization(req: Request, res: Response) {
    requireOrgAccess(req, req.params.id);
    res.json(await service.getOrganization(req.params.id));
  },
  async updateOrganization(req: Request, res: Response) {
    requireOrgAccess(req, req.params.id);
    const schema = z.object({ name: z.string().optional(), regionCode: z.string().optional() });
    res.json(await service.updateOrganization(req.params.id, schema.parse(req.body)));
  },
  async pricingUpdateSummary(req: Request, res: Response) {
    const days = parsePositiveNumber(req.query.staleSinceDays, 30);
    res.json(await service.getPricingUpdateSummary(requireOrgId(req), days));
  },
  async materialPriceHistory(req: Request, res: Response) {
    requireOrgAccess(req, req.params.id);
    const schema = z.object({
      materialId: z.string().uuid().optional(),
      materialQuery: z.string().trim().min(1).max(160).optional(),
      source: z.string().trim().min(1).max(64).optional(),
      dateFrom: z.coerce.date().optional(),
      dateTo: z.coerce.date().optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
    }).refine((data) => !data.dateFrom || !data.dateTo || data.dateFrom <= data.dateTo, {
      message: "dateFrom must be less than or equal to dateTo",
      path: ["dateFrom"],
    });
    res.json(await service.listMaterialPriceHistory(req.params.id, schema.parse(req.query)));
  },
  async listMembers(req: Request, res: Response) {
    requireOrgAccess(req, req.params.id);
    res.json(await service.listOrganizationMembers(req.params.id));
  },
  async listMemberHistory(req: Request, res: Response) {
    requireOrgAccess(req, req.params.id);
    const schema = z.object({
      actionType: z.enum(["created", "updated", "disabled"]).optional(),
      dateFrom: z.coerce.date().optional(),
      dateTo: z.coerce.date().optional(),
    }).refine((data) => !data.dateFrom || !data.dateTo || data.dateFrom <= data.dateTo, {
      message: "dateFrom must be less than or equal to dateTo",
      path: ["dateFrom"],
    });
    const filters = schema.parse(req.query);
    res.json(await service.listOrganizationMemberHistory(req.params.id, req.params.membershipId, filters));
  },
  async upsertMember(req: Request, res: Response) {
    const auth = requireOrgAccess(req, req.params.id);
    const schema = z.object({
      authSubject: z.string().trim().min(1),
      email: z.string().trim().email(),
      fullName: z.string().trim().min(1).optional(),
      role: z.enum(organizationMemberRoles),
      status: z.enum(organizationMemberStatuses).optional(),
    });
    res.status(201).json(await service.upsertOrganizationMember(req.params.id, schema.parse(req.body), auth));
  },
  async updateMember(req: Request, res: Response) {
    const auth = requireOrgAccess(req, req.params.id);
    const schema = z.object({
      role: z.enum(organizationMemberRoles).optional(),
      status: z.enum(organizationMemberStatuses).optional(),
    }).refine((data) => data.role !== undefined || data.status !== undefined, {
      message: "At least one field must be provided",
    });
    res.json(await service.updateOrganizationMember(req.params.id, req.params.membershipId, schema.parse(req.body), auth));
  },
  async removeMember(req: Request, res: Response) {
    const auth = requireOrgAccess(req, req.params.id);
    await service.removeOrganizationMember(req.params.id, req.params.membershipId, auth);
    res.status(204).send();
  },
};
