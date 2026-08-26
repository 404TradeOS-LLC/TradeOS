import { Request, Response } from "express";
import { z } from "zod";
import { verifyAuthToken } from "../auth/jwt";
import { resolveAuthContext } from "../auth/session";
import { ApiError } from "../middleware/errorHandler";
import { basePrisma } from "../../db/client";
import { runWithDatabaseSession } from "../../db/requestSession";
import { AdminDashboardService } from "../../modules/admin-dashboard/service";
import { adminShellCss, AdminPricingInput, renderAdminPricingShell } from "../views/adminShell.view";

const service = new AdminDashboardService();
const inputSchema = z.object({
  bearerToken: z.string().trim().min(1),
  orgId: z.string().uuid(),
  materialQuery: z.string().trim().max(160).optional(),
  source: z.string().trim().max(64).optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  staleSinceDays: z.coerce.number().int().positive().max(3650).default(30),
});

export const adminPricingUiController = {
  async show(_req: Request, res: Response) {
    res.type("html").send(renderAdminPricingShell());
  },
  async stylesheet(_req: Request, res: Response) {
    res.type("text/css").send(adminShellCss);
  },
  async submit(req: Request, res: Response) {
    const parsed = inputSchema.safeParse(req.body);
    const submittedInput = extractInput(req.body);
    if (!parsed.success) {
      res.status(400).type("html").send(renderAdminPricingShell({
        input: submittedInput,
        error: "Provide a valid bearer token and organization UUID.",
      }));
      return;
    }

    try {
      const input = parsed.data;
      const claims = verifyAuthToken(input.bearerToken, process.env.AUTH_JWT_SECRET ?? "");
      const auth = await resolveAuthContext(claims);
      if (auth.orgId !== input.orgId) throw new ApiError(403, "Cross-organization access is not allowed");
      if (!["owner", "admin"].includes(auth.role)) throw new ApiError(403, "Admin access required");

      const [summary, priceHistory, membershipActivity] = await runWithDatabaseSession(
        basePrisma,
        auth,
        () => Promise.all([
          service.getPricingUpdateSummary(input.orgId, input.staleSinceDays),
          service.listMaterialPriceHistory(input.orgId, {
            materialQuery: emptyToUndefined(input.materialQuery),
            source: emptyToUndefined(input.source),
            dateFrom: parseDate(input.dateFrom),
            dateTo: parseDate(input.dateTo, true),
            limit: 100,
          }),
          service.listRecentMembershipHistory(input.orgId),
        ]),
        "admin-ui:pricing-history"
      );
      res.type("html").send(renderAdminPricingShell({ input, auth, summary, priceHistory, membershipActivity }));
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).type("html").send(renderAdminPricingShell({ input: submittedInput, error: error.message }));
        return;
      }
      throw error;
    }
  },
};

function extractInput(body: unknown): AdminPricingInput | undefined {
  if (!body || typeof body !== "object") return undefined;
  const record = body as Record<string, unknown>;
  return {
    bearerToken: stringValue(record.bearerToken),
    orgId: stringValue(record.orgId),
    materialQuery: stringValue(record.materialQuery),
    source: stringValue(record.source),
    dateFrom: stringValue(record.dateFrom),
    dateTo: stringValue(record.dateTo),
    staleSinceDays: Number(record.staleSinceDays) || 30,
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function emptyToUndefined(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

function parseDate(value: string | undefined, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
  const parsed = new Date(`${value}${suffix}`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
