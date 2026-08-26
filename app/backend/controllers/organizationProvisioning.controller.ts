import { Request, Response } from "express";
import { z } from "zod";
import { OrganizationProvisioningService } from "../../modules/organization-provisioning/service";

const service = new OrganizationProvisioningService();
const provisionOrganizationSchema = z.object({
  organizationName: z.string().trim().min(1).max(160),
  regionCode: z.string().trim().min(1).max(64).optional(),
  owner: z.object({
    authSubject: z.string().trim().min(1).max(255),
    email: z.string().trim().email().max(320),
    fullName: z.string().trim().min(1).max(160).optional(),
  }),
}).strict();

export const organizationProvisioningController = {
  async provision(req: Request, res: Response) {
    const input = provisionOrganizationSchema.parse(req.body);
    res.status(201).json(await service.provision(input));
  },
};
