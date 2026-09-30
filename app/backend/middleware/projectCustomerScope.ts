import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../db/client";
import { ApiError } from "./errorHandler";
import { requireOrgId, requirePermissions } from "../requestContext";

const relationIdSchema = z.string().uuid();

/**
 * Prevents project create/update requests from linking a project to customer or
 * pricing-region records owned by another organization. Invalid IDs are left to
 * the existing controller Zod schemas; valid UUIDs must resolve inside the
 * authenticated organization.
 */
export async function requireProjectCustomerScope(req: Request, _res: Response, next: NextFunction) {
  requirePermissions(req, ["crm.write"]);
  const orgId = requireOrgId(req);

  const customerId = relationIdSchema.safeParse(req.body?.customerId);
  if (customerId.success) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId.data, orgId, deletedAt: null },
      select: { id: true },
    });

    if (!customer) {
      throw new ApiError(404, `Customer ${customerId.data} not found`);
    }
  }

  const regionId = relationIdSchema.safeParse(req.body?.regionId);
  if (regionId.success) {
    const region = await prisma.region.findFirst({
      where: { id: regionId.data, orgId },
      select: { id: true },
    });

    if (!region) {
      throw new ApiError(404, `Region ${regionId.data} not found`);
    }
  }

  next();
}
