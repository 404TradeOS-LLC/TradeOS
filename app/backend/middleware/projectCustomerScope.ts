import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../db/client";
import { ApiError } from "./errorHandler";
import { requireOrgId, requirePermissions } from "../requestContext";

const customerIdSchema = z.string().uuid();

/**
 * Prevents project create/update requests from linking a project to a customer
 * owned by another organization. Invalid/missing IDs are left to the existing
 * controller Zod schemas; valid UUIDs must resolve inside the authenticated org.
 */
export async function requireProjectCustomerScope(req: Request, _res: Response, next: NextFunction) {
  requirePermissions(req, ["crm.write"]);

  const parsed = customerIdSchema.safeParse(req.body?.customerId);
  if (!parsed.success) {
    next();
    return;
  }

  const customer = await prisma.customer.findFirst({
    where: { id: parsed.data, orgId: requireOrgId(req), deletedAt: null },
    select: { id: true },
  });

  if (!customer) {
    throw new ApiError(404, `Customer ${parsed.data} not found`);
  }

  next();
}
